package com.queaura.server.engine

import com.queaura.server.model.AnswerType
import com.queaura.server.model.AnswerValue
import com.queaura.server.model.Question
import com.queaura.server.model.Scoring
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ScoringRulesTest {
  private val q = Question("q", "How many?", AnswerType.NUMERIC, correctNumber = 100.0)

  private fun closest(vararg guesses: Pair<Int, Double>, scoring: Scoring = Scoring.ALL_OR_NOTHING) =
    ScoringRules.closest(
      q, guesses.map { it.first } + listOf(99), // player 99 never answered
      guesses.associate { (id, g) -> id to Answer(AnswerValue.Number(g), 0) },
      scoring, readingMs = 1_000, answerMs = 10_000,
    )

  @Test
  fun `time weighting is full in the reading buffer and falls to the floor at the end`() {
    assertEquals(100, ScoringRules.weight(Scoring.TIME_WEIGHTED, 500, 1_000, 10_000))
    assertEquals(100, ScoringRules.weight(Scoring.TIME_WEIGHTED, 1_000, 1_000, 10_000))
    assertEquals(55, ScoringRules.weight(Scoring.TIME_WEIGHTED, 6_000, 1_000, 10_000))
    assertEquals(10, ScoringRules.weight(Scoring.TIME_WEIGHTED, 11_000, 1_000, 10_000))
    assertEquals(0, ScoringRules.weight(Scoring.NONE, 0, 1_000, 10_000))
  }

  @Test
  fun `closest guess not over wins, busts score nothing`() {
    val r = closest(1 to 90.0, 2 to 95.0, 3 to 101.0)
    assertEquals(0, r[1]!!.points)
    assertEquals(100, r[2]!!.points)
    assertTrue(r[3]!!.bust)
    assertEquals(0, r[3]!!.points)
    assertEquals(false, r[99]!!.answered)
  }

  @Test
  fun `tied winners each earn full points`() {
    val r = closest(1 to 95.0, 2 to 95.0)
    assertEquals(100, r[1]!!.points)
    assertEquals(100, r[2]!!.points)
  }

  @Test
  fun `an exact guess earns the bonus`() {
    val r = closest(1 to 100.0, 2 to 50.0)
    assertTrue(r[1]!!.exact)
    assertEquals(150, r[1]!!.points)
    assertEquals(0, r[2]!!.points)
  }

  @Test
  fun `if everyone busts nobody scores`() {
    val r = closest(1 to 120.0, 2 to 101.0)
    assertTrue(r.values.all { it.points == 0 })
  }

  @Test
  fun `scoring none reveals winners without points`() {
    val r = closest(1 to 100.0, scoring = Scoring.NONE)
    assertTrue(r[1]!!.correct)
    assertEquals(0, r[1]!!.points)
  }

  @Test
  fun `reveal ranking lists valid guesses nearest first, then busts least over first`() {
    val r = closest(1 to 50.0, 2 to 130.0, 3 to 99.0, 4 to 101.0)
    assertEquals(listOf(3, 1, 4, 2), ScoringRules.closestRanking(q, r))
  }
}
