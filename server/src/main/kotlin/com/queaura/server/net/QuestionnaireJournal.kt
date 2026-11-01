package com.queaura.server.net

import com.queaura.server.engine.Player
import com.queaura.server.model.AnswerValue
import com.queaura.server.model.Game
import com.queaura.server.protocol.Codec
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter

/**
 * A questionnaire's answers, saved to the host device the moment each arrives (spec §6.4), so
 * ending early or a crash loses nothing. One JSONL file per run: a "start" line with the
 * questions, an "answer" line per answer (the latest per player and question wins), and an "end"
 * line when the host ends it. The host app turns a file into a saved result, or discards it; a
 * file left behind by a crash is what its recovery prompt finds.
 */
class QuestionnaireJournal(dir: File, game: Game) {
  val file: File
  private val writer: BufferedWriter

  init {
    dir.mkdirs()
    val startedAt = System.currentTimeMillis()
    file = File(dir, "questionnaire-$startedAt.jsonl")
    writer = BufferedWriter(FileWriter(file, true))
    val questions = JSONArray(
      game.rounds.single().questions.map { q ->
        JSONObject()
          .put("id", q.id)
          .put("text", q.text)
          .put("answerType", Codec.camel(q.answerType.name))
          .put("choices", JSONArray(q.choices.map { JSONObject().put("id", it.id).put("text", it.text) }))
      },
    )
    write(JSONObject().put("kind", "start").put("gameId", game.id).put("title", game.title).put("startedAt", startedAt).put("questions", questions))
  }

  fun answer(player: Player, questionId: String, value: AnswerValue) {
    val v = when (value) {
      is AnswerValue.Number -> JSONObject().put("number", value.value)
      is AnswerValue.Pick -> JSONObject().put("choice", value.choiceId)
      is AnswerValue.Text -> JSONObject().put("text", value.value)
    }
    write(
      JSONObject().put("kind", "answer").put("at", System.currentTimeMillis())
        .put("playerId", player.id).put("name", player.name).put("emoji", player.emoji)
        .put("questionId", questionId).put("value", v),
    )
  }

  fun end() {
    write(JSONObject().put("kind", "end").put("at", System.currentTimeMillis()))
    close()
  }

  fun close() {
    runCatching { writer.close() }
  }

  @Synchronized
  private fun write(line: JSONObject) {
    runCatching {
      writer.write(line.toString())
      writer.newLine()
      writer.flush()
    }
  }
}
