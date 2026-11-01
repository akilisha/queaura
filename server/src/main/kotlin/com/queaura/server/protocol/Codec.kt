package com.queaura.server.protocol

import com.queaura.server.engine.Engine
import com.queaura.server.engine.Phase
import com.queaura.server.engine.Player
import com.queaura.server.engine.PlayerResult
import com.queaura.server.model.AnswerType
import com.queaura.server.model.AnswerValue
import com.queaura.server.model.Choice
import com.queaura.server.model.Durations
import com.queaura.server.model.Game
import com.queaura.server.model.Progression
import com.queaura.server.model.Question
import com.queaura.server.model.Round
import com.queaura.server.model.Scoring
import com.queaura.server.model.Style
import org.json.JSONArray
import org.json.JSONObject

/**
 * JSON for the wire. The TypeScript mirror is protocol/src/index.ts; keep the two in step.
 * Enums travel as camelCase strings ("closestWithoutGoingOver", "timeWeighted", ...).
 */
object Codec {

  // --- Inbound -------------------------------------------------------------------------------

  fun game(json: JSONObject): Game = Game(
    id = json.getString("id"),
    title = json.getString("title"),
    scoring = enumOf<Scoring>(json.getString("scoring")),
    rounds = json.getJSONArray("rounds").objects().map(::round),
    closeEarly = json.optBoolean("closeEarly", false),
    progression = json.optString("progression").ifEmpty { null }?.let { enumOf<Progression>(it) } ?: Progression.AUTO,
  )

  private fun round(json: JSONObject) = Round(
    style = enumOf<Style>(json.getString("style")),
    questions = json.getJSONArray("questions").objects().map(::question),
    durations = json.optJSONObject("durations")?.let {
      Durations(it.optLongOrNull("readingMs"), it.optLongOrNull("answerMs"), it.optLongOrNull("revealMs"), it.optLongOrNull("breakMs"))
    } ?: Durations(),
  )

  private fun question(json: JSONObject) = Question(
    id = json.getString("id"),
    text = json.getString("text"),
    answerType = enumOf<AnswerType>(json.getString("answerType")),
    correctNumber = if (json.has("correctNumber")) json.getDouble("correctNumber") else null,
    correctChoiceId = json.optString("correctChoiceId").ifEmpty { null },
    choices = json.optJSONArray("choices")?.objects()?.map { Choice(it.getString("id"), it.getString("text")) } ?: emptyList(),
    explanation = json.optString("explanation").ifEmpty { null },
  )

  /** `{"number": 42}`, `{"choice": "b"}` or `{"text": "..."}`. */
  fun answerValue(json: JSONObject): AnswerValue? = when {
    json.has("number") -> json.optDouble("number").takeIf { it.isFinite() }?.let { AnswerValue.Number(it) }
    json.has("choice") -> AnswerValue.Pick(json.getString("choice"))
    json.has("text") -> AnswerValue.Text(json.getString("text"))
    else -> null
  }

  // --- Outbound ------------------------------------------------------------------------------

  /** Who a state message is for. Players get their own seat; the host also gets the answers. */
  sealed interface Audience {
    data class ForPlayer(val id: Int) : Audience
    data object Tv : Audience
    data object Host : Audience
  }

  /** The parts of the state everyone sees, built once per broadcast. */
  fun publicState(engine: Engine): JSONObject {
    val json = JSONObject()
      .put("t", "state")
      .put("phase", camel(engine.phase.name))
      .put("paused", engine.paused)
      .put("remainingMs", engine.remainingMs() ?: JSONObject.NULL)
      .put("durationMs", engine.durationMs() ?: JSONObject.NULL)
      .put("stopped", engine.stopped)
      .put("scores", JSONArray(engine.scoreboard().map(::playerJson)))
    val game = engine.game
    if (game != null) {
      json.put("title", game.title).put("scoring", camel(game.scoring.name))
      val round = engine.round!!
      json.put(
        "round",
        JSONObject().put("number", engine.roundIndex + 1).put("count", game.rounds.size)
          .put("style", camel(round.style.name)).put("questionCount", round.questions.size),
      )
    }
    if (engine.isQuestionnaire) {
      json.put("progression", "manual")
      json.put(
        "questionnaire",
        JSONObject().put("count", engine.questionnaireLength).put("finished", engine.finishedCount()),
      )
    }
    if (engine.phase in QUESTION_PHASES) {
      val q = engine.question!!
      json.put(
        "question",
        JSONObject()
          .put("seq", engine.questionSeq)
          .put("number", engine.questionIndex + 1)
          .put("text", q.text)
          .put("answerType", camel(q.answerType.name))
          .put("choices", JSONArray(q.choices.map { JSONObject().put("id", it.id).put("text", it.text) }))
          .put("readingMs", engine.readingMs)
          .put("answerMs", engine.answerMs),
      )
      json.put("answeredCount", engine.answeredIds.count { it in engine.eligibleIds })
      json.put("eligibleCount", engine.eligibleIds.size)
    }
    if (engine.phase == Phase.REVEAL) {
      val outcome = engine.outcome!!
      json.put(
        "reveal",
        JSONObject()
          .put("voided", outcome.voided)
          .put("correctNumber", outcome.question.correctNumber ?: JSONObject.NULL)
          .put("correctChoiceId", outcome.question.correctChoiceId ?: JSONObject.NULL)
          .put("explanation", outcome.question.explanation ?: JSONObject.NULL)
          .put("choiceCounts", JSONObject(outcome.choiceCounts as Map<*, *>))
          .put(
            "ranking",
            JSONArray(
              outcome.ranking.mapNotNull { id ->
                val r = outcome.results[id] ?: return@mapNotNull null
                resultJson(r).put("playerId", id)
              },
            ),
          ),
      )
    }
    return json
  }

  /** [base] plus the audience's own part. */
  fun stateFor(base: JSONObject, engine: Engine, audience: Audience): String {
    val json = JSONObject(base.toString())
    when (audience) {
      is Audience.ForPlayer -> engine.player(audience.id)?.let { json.put("you", youJson(engine, it)) }
      Audience.Tv -> Unit
      Audience.Host -> json.put("host", hostJson(engine))
    }
    return json.toString()
  }

  private fun youJson(engine: Engine, p: Player): JSONObject {
    val json = playerJson(p)
    val canAnswer = engine.phase == Phase.QUESTION && !engine.paused && p.id in engine.eligibleIds && p.id !in engine.answeredIds
    json.put("canAnswer", canAnswer)
    json.put("waitingForNextQuestion", engine.phase in QUESTION_PHASES && p.id !in engine.eligibleIds)
    engine.answerOf(p.id)?.let { json.put("answer", valueJson(it.value)) }
    if (engine.phase == Phase.REVEAL) engine.outcome?.results?.get(p.id)?.let { json.put("result", resultJson(it)) }
    if (engine.phase == Phase.QUESTIONNAIRE) {
      val position = engine.positionOf(p.id)
      val mine = JSONObject().put("position", position)
      engine.round!!.questions.getOrNull(position)?.let { q ->
        mine.put("question", questionnaireQuestion(q, position))
        engine.responseOf(p.id, position)?.let { mine.put("answer", valueJson(it)) }
      }
      json.put("questionnaire", mine)
    }
    return json
  }

  private fun hostJson(engine: Engine): JSONObject {
    val json = JSONObject()
    engine.question?.takeIf { engine.phase in QUESTION_PHASES }?.let { q ->
      json.put("correctNumber", q.correctNumber ?: JSONObject.NULL)
      json.put("correctChoiceId", q.correctChoiceId ?: JSONObject.NULL)
      json.put("explanation", q.explanation ?: JSONObject.NULL)
    }
    json.put("answeredIds", JSONArray(engine.answeredIds.toList()))
    if (engine.phase == Phase.QUESTIONNAIRE) {
      json.put("progress", JSONObject(engine.players.associate { it.id.toString() to engine.positionOf(it.id) } as Map<*, *>))
    }
    return json
  }

  private fun questionnaireQuestion(q: Question, index: Int) = JSONObject()
    .put("index", index)
    .put("text", q.text)
    .put("answerType", camel(q.answerType.name))
    .put("choices", JSONArray(q.choices.map { JSONObject().put("id", it.id).put("text", it.text) }))

  private fun playerJson(p: Player) = JSONObject()
    .put("id", p.id).put("name", p.name).put("emoji", p.emoji)
    .put("total", p.total).put("roundPoints", p.roundPoints).put("lastPoints", p.lastPoints ?: JSONObject.NULL)
    .put("online", p.connected).put("awake", p.awake)

  private fun resultJson(r: PlayerResult) = JSONObject()
    .put("answered", r.answered).put("correct", r.correct).put("bust", r.bust).put("exact", r.exact).put("points", r.points)
    .put("value", r.value?.let(::valueJson) ?: JSONObject.NULL)

  private fun valueJson(v: AnswerValue) = when (v) {
    is AnswerValue.Number -> JSONObject().put("number", v.value)
    is AnswerValue.Pick -> JSONObject().put("choice", v.choiceId)
    is AnswerValue.Text -> JSONObject().put("text", v.value)
  }

  private val QUESTION_PHASES = setOf(Phase.QUESTION, Phase.TIMES_UP, Phase.REVEAL)

  // --- Helpers -------------------------------------------------------------------------------

  /** CLOSEST_WITHOUT_GOING_OVER -> closestWithoutGoingOver */
  fun camel(constant: String): String {
    val parts = constant.lowercase().split('_')
    return parts.first() + parts.drop(1).joinToString("") { it.replaceFirstChar(Char::uppercase) }
  }

  private inline fun <reified E : Enum<E>> enumOf(camelName: String): E =
    enumValues<E>().firstOrNull { camel(it.name) == camelName } ?: throw IllegalArgumentException("Unknown value \"$camelName\"")

  private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

  private fun JSONObject.optLongOrNull(key: String): Long? = if (has(key) && !isNull(key)) getLong(key) else null
}
