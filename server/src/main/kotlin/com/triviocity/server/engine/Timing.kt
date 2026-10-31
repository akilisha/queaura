package com.triviocity.server.engine

import com.triviocity.server.model.Durations
import com.triviocity.server.model.Question

/** Durations from spec §6.2 and §6.3, in milliseconds. */
object Timing {
  const val GET_READY = 3_000L
  const val ROUND_INTRO = 4_000L
  const val TIMES_UP = 3_000L
  const val ROUND_SCORES = 8_000L
  const val PLAY_ANOTHER_WINDOW = 60_000L

  const val DEFAULT_ANSWER = 20_000L
  const val DEFAULT_REVEAL = 8_000L
  const val DEFAULT_BREAK = 15_000L

  /** The "last 5 seconds" sound cue (spec §10). */
  const val LAST_SECONDS = 5_000L

  /** 2 s plus 0.25 s per word, kept between 3 and 10 s. */
  fun readingBuffer(question: Question, overrides: Durations): Long {
    overrides.readingMs?.let { return it }
    val words = question.text.trim().split(Regex("\\s+")).count { it.isNotEmpty() }
    return (2_000L + words * 250L).coerceIn(3_000L, 10_000L)
  }

  fun answer(overrides: Durations) = overrides.answerMs ?: DEFAULT_ANSWER
  fun reveal(overrides: Durations) = overrides.revealMs ?: DEFAULT_REVEAL
  fun roundBreak(overrides: Durations) = overrides.breakMs ?: DEFAULT_BREAK
}
