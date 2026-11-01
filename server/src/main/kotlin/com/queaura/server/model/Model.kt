package com.queaura.server.model

/** Data the host app sends when it starts a game (spec §4). Questions arrive resolved, inline. */

enum class AnswerType { NUMERIC, MULTIPLE_CHOICE, FREE_TEXT }

enum class Style { CLOSEST_WITHOUT_GOING_OVER, MULTIPLE_CHOICE, FASTEST_FINGER, QUESTIONNAIRE }

/** Auto: timed rounds. Manual: a questionnaire, each player at their own pace (spec §6.4). */
enum class Progression { AUTO, MANUAL }

enum class Scoring { NONE, ALL_OR_NOTHING, TIME_WEIGHTED }

data class Choice(val id: String, val text: String)

data class Question(
  val id: String,
  val text: String,
  val answerType: AnswerType,
  /** The real number, for numeric questions. */
  val correctNumber: Double? = null,
  /** The id of the right choice, for multiple-choice questions. */
  val correctChoiceId: String? = null,
  val choices: List<Choice> = emptyList(),
  val explanation: String? = null,
)

/** Per-round overrides of the style defaults; null means "use the default". */
data class Durations(
  val readingMs: Long? = null,
  val answerMs: Long? = null,
  val revealMs: Long? = null,
  val breakMs: Long? = null,
)

data class Round(val style: Style, val questions: List<Question>, val durations: Durations = Durations())

data class Game(
  val id: String,
  val title: String,
  val scoring: Scoring,
  val rounds: List<Round>,
  /** Close a question once every awake player has answered, instead of running to 0 (§6.2). */
  val closeEarly: Boolean = false,
  val progression: Progression = Progression.AUTO,
) {
  /** Why this game cannot be played, or null if it can. */
  fun problem(): String? {
    if (rounds.isEmpty()) return "The game has no rounds"
    // A questionnaire is exactly one round of questionnaire style; timed games never use that style.
    if (progression == Progression.MANUAL && (rounds.size != 1 || rounds[0].style != Style.QUESTIONNAIRE)) {
      return "A questionnaire has exactly one round"
    }
    if (progression == Progression.AUTO && rounds.any { it.style == Style.QUESTIONNAIRE }) {
      return "Only a questionnaire can have a questionnaire round"
    }
    rounds.forEachIndexed { i, round ->
      if (round.questions.isEmpty()) return "Round ${i + 1} has no questions"
      for (q in round.questions) {
        when (round.style) {
          Style.CLOSEST_WITHOUT_GOING_OVER ->
            if (q.answerType != AnswerType.NUMERIC || q.correctNumber == null) {
              return "Round ${i + 1} needs number answers for \"${q.text}\""
            }
          Style.MULTIPLE_CHOICE, Style.FASTEST_FINGER ->
            if (q.choices.size < 2 || q.choices.none { it.id == q.correctChoiceId }) {
              return "Round ${i + 1} needs choices with a right answer for \"${q.text}\""
            }
          // Any kind of question; there is no right answer to check, only choices to offer.
          Style.QUESTIONNAIRE ->
            if (q.answerType == AnswerType.MULTIPLE_CHOICE && q.choices.size < 2) {
              return "\"${q.text}\" needs at least two answers to choose from"
            }
        }
      }
    }
    return null
  }
}

sealed interface AnswerValue {
  data class Number(val value: Double) : AnswerValue
  data class Pick(val choiceId: String) : AnswerValue
  data class Text(val value: String) : AnswerValue
}
