package com.queaura.server.engine

import com.queaura.server.model.AnswerType
import com.queaura.server.model.AnswerValue
import com.queaura.server.model.Choice
import com.queaura.server.model.Game
import com.queaura.server.model.Progression
import com.queaura.server.model.Question
import com.queaura.server.model.Round
import com.queaura.server.model.Scoring
import com.queaura.server.model.Style
import com.queaura.server.net.QuestionnaireJournal
import org.json.JSONObject
import java.nio.file.Files
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

class QuestionnaireTest {
  private var clock = 0L
  private lateinit var engine: Engine

  private val questions = listOf(
    Question("q1", "Your favourite film?", AnswerType.FREE_TEXT),
    Question("q2", "How many cups of tea a day?", AnswerType.NUMERIC),
    Question("q3", "Tea or coffee?", AnswerType.MULTIPLE_CHOICE, choices = listOf(Choice("a", "Tea"), Choice("b", "Coffee"))),
  )

  private fun survey(rounds: List<Round> = listOf(Round(Style.QUESTIONNAIRE, questions))) =
    Game("s", "Office survey", Scoring.NONE, rounds, progression = Progression.MANUAL)

  @BeforeTest
  fun setUp() {
    clock = 0
    engine = Engine { clock }
  }

  private fun seat(name: String) = engine.join(name, "🦊").also { engine.setPresence(it.id, connected = true, awake = true) }

  @Test
  fun `starts straight into the questionnaire with everyone on the first question`() {
    val ada = seat("Ada")
    assertNull(engine.start(survey()))
    assertEquals(Phase.QUESTIONNAIRE, engine.phase)
    assertNull(engine.nextWakeAt()) // no timers
    assertEquals(0, engine.positionOf(ada.id))
  }

  @Test
  fun `each answer is kept and moves the player on, at their own pace`() {
    val ada = seat("Ada")
    val bo = seat("Bo")
    engine.start(survey())
    assertNull(engine.questionnaireAnswer(ada.id, 0, AnswerValue.Text("  Up  ")))
    assertNull(engine.questionnaireAnswer(ada.id, 1, AnswerValue.Number(3.0)))
    assertEquals(2, engine.positionOf(ada.id))
    assertEquals(0, engine.positionOf(bo.id))
    assertEquals(AnswerValue.Text("Up"), engine.responseOf(ada.id, 0))
  }

  @Test
  fun `going back lets a player change an answer, and finishing counts`() {
    val ada = seat("Ada")
    seat("Bo")
    engine.start(survey())
    engine.questionnaireAnswer(ada.id, 0, AnswerValue.Text("Up"))
    engine.questionnaireAnswer(ada.id, 1, AnswerValue.Number(3.0))
    engine.questionnaireAnswer(ada.id, 2, AnswerValue.Pick("a"))
    assertEquals(1, engine.finishedCount())
    engine.questionnaireGo(ada.id, 1)
    engine.questionnaireAnswer(ada.id, 1, AnswerValue.Number(5.0))
    assertEquals(AnswerValue.Number(5.0), engine.responseOf(ada.id, 1))
    assertEquals(2, engine.positionOf(ada.id))
  }

  @Test
  fun `answers must fit their question`() {
    val ada = seat("Ada")
    engine.start(survey())
    assertEquals("That answer does not fit this question", engine.questionnaireAnswer(ada.id, 0, AnswerValue.Text("   ")))
    assertEquals("That answer does not fit this question", engine.questionnaireAnswer(ada.id, 0, AnswerValue.Text("x".repeat(Engine.MAX_TEXT + 1))))
    assertEquals("That answer does not fit this question", engine.questionnaireAnswer(ada.id, 2, AnswerValue.Pick("z")))
    assertEquals("That question doesn't exist", engine.questionnaireAnswer(ada.id, 9, AnswerValue.Text("Hi")))
  }

  @Test
  fun `the host ending it goes to the play-another window, not as a stopped game`() {
    val ada = seat("Ada")
    engine.start(survey())
    engine.stop()
    assertEquals(Phase.FINAL_SCORES, engine.phase)
    assertFalse(engine.stopped)
    assertEquals("The questionnaire has ended", engine.questionnaireAnswer(ada.id, 0, AnswerValue.Text("late")))
  }

  @Test
  fun `a questionnaire is exactly one questionnaire round, and timed games never use that style`() {
    val two = survey(listOf(Round(Style.QUESTIONNAIRE, questions), Round(Style.QUESTIONNAIRE, questions)))
    assertEquals("A questionnaire has exactly one round", engine.start(two))
    val timed = Game("t", "Timed", Scoring.NONE, listOf(Round(Style.QUESTIONNAIRE, questions)))
    assertEquals("Only a questionnaire can have a questionnaire round", engine.start(timed))
    val freeTextInQuiz = Game("q", "Quiz", Scoring.NONE, listOf(Round(Style.MULTIPLE_CHOICE, listOf(questions[0]))))
    assertEquals("Round 1 needs choices with a right answer for \"Your favourite film?\"", engine.start(freeTextInQuiz))
  }

  @Test
  fun `the journal records the questions, every answer and the end`() {
    val dir = Files.createTempDirectory("journal").toFile()
    val ada = seat("Ada")
    val journal = QuestionnaireJournal(dir, survey())
    journal.answer(ada, "q1", AnswerValue.Text("Up"))
    journal.answer(ada, "q2", AnswerValue.Number(3.0))
    journal.end()
    val lines = journal.file.readLines().map { JSONObject(it) }
    assertEquals(listOf("start", "answer", "answer", "end"), lines.map { it.getString("kind") })
    assertEquals(3, lines[0].getJSONArray("questions").length())
    assertEquals("Up", lines[1].getJSONObject("value").getString("text"))
    assertEquals("Ada", lines[1].getString("name"))
  }
}
