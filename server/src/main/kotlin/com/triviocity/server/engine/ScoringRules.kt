package com.triviocity.server.engine

import com.triviocity.server.model.AnswerValue
import com.triviocity.server.model.Question
import com.triviocity.server.model.Scoring
import kotlin.math.roundToInt

/** An answer as the server received it: the value and how far into the question it arrived. */
data class Answer(val value: AnswerValue, val elapsedMs: Long)

data class PlayerResult(
  val answered: Boolean,
  val value: AnswerValue?,
  val correct: Boolean,
  /** Closest-without-going-over only: the guess was over the real number. */
  val bust: Boolean = false,
  val exact: Boolean = false,
  val points: Int = 0,
)

/** Point rules from spec §6.5. */
object ScoringRules {
  const val FULL = 100
  const val FLOOR = 10
  const val EXACT_BONUS = 50

  /** Points for a correct answer that arrived [elapsedMs] into the question. */
  fun weight(scoring: Scoring, elapsedMs: Long, readingMs: Long, answerMs: Long): Int = when (scoring) {
    Scoring.NONE -> 0
    Scoring.ALL_OR_NOTHING -> FULL
    Scoring.TIME_WEIGHTED -> {
      // Full points during the reading buffer, then linear decay to FLOOR at the end of the window.
      val intoCountdown = (elapsedMs - readingMs).coerceAtLeast(0)
      val fraction = (intoCountdown.toDouble() / answerMs).coerceIn(0.0, 1.0)
      (FULL - (FULL - FLOOR) * fraction).roundToInt()
    }
  }

  fun multipleChoice(
    question: Question,
    players: Collection<Int>,
    answers: Map<Int, Answer>,
    scoring: Scoring,
    readingMs: Long,
    answerMs: Long,
  ): Map<Int, PlayerResult> = players.associateWith { id ->
    val answer = answers[id] ?: return@associateWith PlayerResult(answered = false, value = null, correct = false)
    val correct = (answer.value as? AnswerValue.Pick)?.choiceId == question.correctChoiceId
    PlayerResult(
      answered = true, value = answer.value, correct = correct,
      points = if (correct) weight(scoring, answer.elapsedMs, readingMs, answerMs) else 0,
    )
  }

  /**
   * The closest guess not over the real number wins; tied winners each earn full points; an exact
   * guess earns a bonus; guesses over the number (busts) earn nothing.
   */
  fun closest(
    question: Question,
    players: Collection<Int>,
    answers: Map<Int, Answer>,
    scoring: Scoring,
    readingMs: Long,
    answerMs: Long,
  ): Map<Int, PlayerResult> {
    val target = question.correctNumber ?: error("closest-guess question without a number")
    val guesses = answers.mapNotNull { (id, a) -> (a.value as? AnswerValue.Number)?.let { id to it.value } }.toMap()
    val best = guesses.values.filter { it <= target }.maxOrNull()
    return players.associateWith { id ->
      val answer = answers[id]
      val guess = guesses[id] ?: return@associateWith PlayerResult(answered = answer != null, value = answer?.value, correct = false)
      val bust = guess > target
      val won = !bust && guess == best
      val exact = guess == target
      val points = if (!won || scoring == Scoring.NONE) 0
      else weight(scoring, answer!!.elapsedMs, readingMs, answerMs) + if (exact) EXACT_BONUS else 0
      PlayerResult(answered = true, value = answer!!.value, correct = won, bust = bust, exact = exact, points = points)
    }
  }

  /** Reveal order for closest guesses: valid guesses nearest first, then busts least-over first. */
  fun closestRanking(question: Question, results: Map<Int, PlayerResult>): List<Int> {
    val target = question.correctNumber ?: return emptyList()
    return results.filterValues { it.value is AnswerValue.Number }.entries
      .sortedWith(compareBy({ it.value.bust }, { kotlin.math.abs(target - (it.value.value as AnswerValue.Number).value) }))
      .map { it.key }
  }
}
