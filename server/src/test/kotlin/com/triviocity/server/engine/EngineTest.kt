package com.triviocity.server.engine

import com.triviocity.server.model.AnswerType
import com.triviocity.server.model.AnswerValue
import com.triviocity.server.model.Choice
import com.triviocity.server.model.Durations
import com.triviocity.server.model.Game
import com.triviocity.server.model.Question
import com.triviocity.server.model.Round
import com.triviocity.server.model.Scoring
import com.triviocity.server.model.Style
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class EngineTest {
  private var clock = 0L
  private lateinit var engine: Engine

  // Fixed timings keep the arithmetic readable: 3 s reading, 10 s answering, 5 s reveal, 6 s break.
  private val timing = Durations(readingMs = 3_000, answerMs = 10_000, revealMs = 5_000, breakMs = 6_000)

  private fun mc(id: String) = Question(
    id, "Pick one", AnswerType.MULTIPLE_CHOICE,
    correctChoiceId = "a", choices = listOf(Choice("a", "Right"), Choice("b", "Wrong")),
  )

  private fun numeric(id: String, answer: Double) = Question(id, "Guess", AnswerType.NUMERIC, correctNumber = answer)

  private fun game(scoring: Scoring = Scoring.ALL_OR_NOTHING, closeEarly: Boolean = false) = Game(
    "g", "Test", scoring,
    listOf(
      Round(Style.MULTIPLE_CHOICE, listOf(mc("q1"), mc("q2")), timing),
      Round(Style.CLOSEST_WITHOUT_GOING_OVER, listOf(numeric("q3", 100.0)), timing),
    ),
    closeEarly,
  )

  /** Moves the clock forward and lets the engine catch up, as the server's wake timer would. */
  private fun advance(ms: Long) {
    val target = clock + ms
    while (true) {
      val wake = engine.nextWakeAt()
      if (wake == null || wake > target) break
      clock = maxOf(clock, wake)
      engine.tick()
    }
    clock = target
    engine.tick()
  }

  private fun pick(p: Player, choice: String) = engine.answer(p.id, engine.questionSeq, AnswerValue.Pick(choice))
  private fun guess(p: Player, n: Double) = engine.answer(p.id, engine.questionSeq, AnswerValue.Number(n))

  @BeforeTest
  fun setUp() {
    clock = 0
    engine = Engine { clock }
  }

  private fun seat(name: String) = engine.join(name, "🦊").also { engine.setPresence(it.id, connected = true, awake = true) }

  private fun startAndReachFirstQuestion(g: Game = game()) {
    assertNull(engine.start(g))
    assertEquals(Phase.GAME_STARTING, engine.phase)
    advance(Timing.GET_READY)
    assertEquals(Phase.ROUND_INTRO, engine.phase)
    advance(Timing.ROUND_INTRO)
    assertEquals(Phase.QUESTION, engine.phase)
  }

  @Test
  fun `a full game walks every phase in order`() {
    val ada = seat("Ada")
    startAndReachFirstQuestion()
    assertNull(pick(ada, "a"))
    advance(13_000) // reading + answer: the clock runs out
    assertEquals(Phase.TIMES_UP, engine.phase)
    advance(Timing.TIMES_UP)
    assertEquals(Phase.REVEAL, engine.phase)
    advance(5_000)
    assertEquals(Phase.QUESTION, engine.phase) // q2
    advance(13_000 + Timing.TIMES_UP + 5_000)
    assertEquals(Phase.ROUND_SCORES, engine.phase)
    advance(Timing.ROUND_SCORES)
    assertEquals(Phase.ROUND_BREAK, engine.phase)
    advance(6_000)
    assertEquals(Phase.ROUND_INTRO, engine.phase)
    assertEquals(1, engine.roundIndex)
    advance(Timing.ROUND_INTRO + 13_000 + Timing.TIMES_UP + 5_000)
    assertEquals(Phase.ROUND_SCORES, engine.phase)
    advance(Timing.ROUND_SCORES)
    assertEquals(Phase.FINAL_SCORES, engine.phase) // no break after the last round
    advance(Timing.PLAY_ANOTHER_WINDOW)
    assertEquals(Phase.ENDED, engine.phase)
  }

  @Test
  fun `the window stays open until the clock hits zero by default`() {
    val ada = seat("Ada")
    seat("Bo")
    startAndReachFirstQuestion()
    pick(ada, "a")
    engine.players.forEach { if (it.id != ada.id) pick(it, "b") }
    assertEquals(Phase.QUESTION, engine.phase) // everyone answered, still open
    advance(12_999)
    assertEquals(Phase.QUESTION, engine.phase)
    advance(1)
    assertEquals(Phase.TIMES_UP, engine.phase)
  }

  @Test
  fun `early close skips the time's-up hold and ignores sleeping players`() {
    val ada = seat("Ada")
    val bo = seat("Bo")
    startAndReachFirstQuestion(game(closeEarly = true))
    engine.setPresence(bo.id, connected = true, awake = false) // Bo's screen is off
    pick(ada, "a")
    assertEquals(Phase.REVEAL, engine.phase)
  }

  @Test
  fun `answers are refused after the clock hits zero`() {
    val ada = seat("Ada")
    startAndReachFirstQuestion()
    advance(13_000)
    assertEquals("This question is closed", pick(ada, "a"))
  }

  @Test
  fun `pause freezes the clock and refuses answers, resume continues where it stopped`() {
    val ada = seat("Ada")
    startAndReachFirstQuestion()
    advance(4_000)
    engine.pause()
    assertEquals(9_000, engine.remainingMs())
    assertNull(engine.nextWakeAt())
    clock += 60_000 // a long pause
    engine.tick()
    assertEquals(9_000, engine.remainingMs())
    assertEquals("The game is paused", pick(ada, "a"))
    engine.resume()
    advance(8_999)
    assertEquals(Phase.QUESTION, engine.phase)
    advance(1)
    assertEquals(Phase.TIMES_UP, engine.phase)
  }

  @Test
  fun `skip voids the question and moves straight to the next one`() {
    val ada = seat("Ada")
    startAndReachFirstQuestion()
    pick(ada, "a")
    val seq = engine.questionSeq
    engine.skip()
    assertEquals(Phase.QUESTION, engine.phase)
    assertEquals(seq + 1, engine.questionSeq)
    assertTrue(engine.outcome!!.voided)
    assertEquals(0, ada.total)
  }

  @Test
  fun `late joiners wait for the next question`() {
    seat("Ada")
    startAndReachFirstQuestion()
    val late = seat("Late")
    assertEquals("You can answer from the next question", pick(late, "a"))
    advance(13_000 + Timing.TIMES_UP + 5_000)
    assertNull(pick(late, "a"))
  }

  @Test
  fun `kicked players lose their seat and their token stays blocked`() {
    val ada = seat("Ada")
    startAndReachFirstQuestion()
    engine.kick(ada.id)
    assertNull(engine.player(ada.id))
    assertNull(engine.playerByToken(ada.token))
    assertTrue(engine.isKicked(ada.token))
  }

  @Test
  fun `stop goes to final scores, play another returns to the lobby with scores reset on start`() {
    val ada = seat("Ada")
    startAndReachFirstQuestion()
    pick(ada, "a")
    advance(13_000)
    assertEquals(100, ada.total)
    engine.stop()
    assertEquals(Phase.FINAL_SCORES, engine.phase)
    assertTrue(engine.stopped)
    engine.playAnother()
    assertEquals(Phase.LOBBY, engine.phase)
    startAndReachFirstQuestion()
    assertEquals(0, ada.total)
  }

  @Test
  fun `cues fire for question shown, countdown, last seconds, reveal and round end`() {
    seat("Ada")
    startAndReachFirstQuestion()
    assertEquals(listOf(Cue.QUESTION_SHOWN), engine.drainCues())
    advance(3_000)
    assertEquals(listOf(Cue.COUNTDOWN_STARTED), engine.drainCues())
    advance(5_000)
    assertEquals(listOf(Cue.LAST_SECONDS), engine.drainCues())
    advance(5_000 + Timing.TIMES_UP)
    assertEquals(listOf(Cue.REVEAL), engine.drainCues())
  }

  @Test
  fun `points land on totals and the round tally`() {
    val ada = seat("Ada")
    val bo = seat("Bo")
    startAndReachFirstQuestion(game(Scoring.TIME_WEIGHTED))
    pick(ada, "a") // during reading: full points
    advance(8_000) // 5 s into a 10 s countdown
    pick(bo, "a")
    advance(5_000)
    assertEquals(100, ada.total)
    assertEquals(55, bo.total) // halfway from 100 to the floor of 10
    assertEquals(55, bo.roundPoints)
    assertNotNull(engine.outcome)
  }

  @Test
  fun `a game with an empty round cannot start`() {
    val broken = Game("g", "Broken", Scoring.ALL_OR_NOTHING, listOf(Round(Style.MULTIPLE_CHOICE, emptyList())))
    assertEquals("Round 1 has no questions", engine.start(broken))
    assertEquals(Phase.LOBBY, engine.phase)
  }
}
