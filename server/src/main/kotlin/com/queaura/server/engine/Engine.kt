package com.queaura.server.engine

import com.queaura.server.model.AnswerValue
import com.queaura.server.model.Game
import com.queaura.server.model.Question
import com.queaura.server.model.Round
import com.queaura.server.model.Style
import java.util.UUID

/** Phases of spec §6.2. FINAL_SCORES also carries the play-another window. */
enum class Phase { LOBBY, GAME_STARTING, ROUND_INTRO, QUESTION, TIMES_UP, REVEAL, ROUND_SCORES, ROUND_BREAK, FINAL_SCORES, ENDED }

/** Game events that sound can attach to later (spec §10). */
enum class Cue { QUESTION_SHOWN, COUNTDOWN_STARTED, LAST_SECONDS, REVEAL, ROUND_END }

class Player(val id: Int, val token: String, val name: String, val emoji: String) {
  var total = 0
  var roundPoints = 0
  /** Points from the most recent question this player could answer; null before any. */
  var lastPoints: Int? = null
  var connected = false
  /** False while the player's screen is off (spec §3.4). */
  var awake = true
}

/** Everything known about a question once it has closed. */
data class Outcome(
  val seq: Int,
  val question: Question,
  val style: Style,
  val voided: Boolean,
  val results: Map<Int, PlayerResult>,
  /** Reveal order (player ids): closest guesses nearest first, or fastest correct answers first; empty for multiple choice. */
  val ranking: List<Int>,
  val choiceCounts: Map<String, Int>,
)

/**
 * The authoritative game: session roster, state machine, timers and scoring. Pure and
 * single-threaded: the server calls it from its game-loop thread, calls [tick] at [nextWakeAt],
 * and broadcasts whenever [version] changes. Time comes only from [now], the server's clock.
 */
class Engine(private val now: () -> Long) {
  private val roster = LinkedHashMap<Int, Player>()
  private val byToken = HashMap<String, Player>()
  private val kickedTokens = HashSet<String>()
  private var nextPlayerId = 1

  var phase = Phase.LOBBY
    private set
  var game: Game? = null
    private set
  var roundIndex = 0
    private set
  var questionIndex = 0
    private set
  /** Increments with every question shown, so an answer meant for an earlier one is refused. */
  var questionSeq = 0
    private set
  /** True when the host stopped the game before its end. */
  var stopped = false
    private set
  /** The most recent closed (or skipped) question. */
  var outcome: Outcome? = null
    private set
  /** Changes whenever anything a client can see changes. */
  var version = 0L
    private set

  private var phaseStart = 0L
  private var phaseDuration: Long? = null
  private var pausedAt: Long? = null
  var readingMs = 0L
    private set
  var answerMs = 0L
    private set
  private var countdownCued = false
  private var lastSecondsCued = false
  private var eligible: Set<Int> = emptySet()
  private val answers = LinkedHashMap<Int, Answer>()
  private val cues = ArrayList<Cue>()

  val players: Collection<Player> get() = roster.values
  val paused: Boolean get() = pausedAt != null
  val round: Round? get() = game?.rounds?.getOrNull(roundIndex)
  val question: Question? get() = round?.questions?.getOrNull(questionIndex)
  val answeredIds: Set<Int> get() = answers.keys
  val eligibleIds: Set<Int> get() = eligible

  fun player(id: Int): Player? = roster[id]
  fun playerByToken(token: String): Player? = byToken[token]
  fun isKicked(token: String) = token in kickedTokens
  fun answerOf(id: Int): Answer? = if (phase == Phase.QUESTION || phase == Phase.TIMES_UP) answers[id] else null

  /** Milliseconds left in the current phase (frozen while paused), or null for untimed phases. */
  fun remainingMs(): Long? = phaseDuration?.let { (it - elapsed()).coerceAtLeast(0) }
  fun durationMs(): Long? = phaseDuration

  fun scoreboard(): List<Player> = roster.values.sortedWith(compareByDescending<Player> { it.total }.thenBy { it.id })

  fun drainCues(): List<Cue> = cues.toList().also { cues.clear() }

  // --- Roster -------------------------------------------------------------------------------

  /** Seats a new player; they can answer from the next question (spec §6.2). */
  fun join(name: String, emoji: String): Player {
    val player = Player(nextPlayerId++, UUID.randomUUID().toString(), name, emoji)
    roster[player.id] = player
    byToken[player.token] = player
    changed()
    return player
  }

  fun setPresence(id: Int, connected: Boolean, awake: Boolean) {
    val player = roster[id] ?: return
    if (player.connected == connected && player.awake == awake) return
    player.connected = connected
    player.awake = awake
    changed()
    closeEarlyIfAllAnswered()
  }

  /** Removes the player and blocks their token for the rest of the session (spec §5.5). */
  fun kick(id: Int): Player? {
    val player = roster.remove(id) ?: return null
    byToken.remove(player.token)
    kickedTokens.add(player.token)
    answers.remove(id)
    eligible = eligible - id
    changed()
    closeEarlyIfAllAnswered()
    return player
  }

  // --- Host controls ------------------------------------------------------------------------

  /** Starts [newGame] from the lobby. Returns why it cannot start, or null. */
  fun start(newGame: Game): String? {
    if (phase == Phase.ENDED) return "This session has ended"
    if (phase != Phase.LOBBY) return "A game is already running"
    newGame.problem()?.let { return it }
    game = newGame
    stopped = false
    outcome = null
    for (p in roster.values) {
      p.total = 0
      p.roundPoints = 0
      p.lastPoints = null
    }
    enter(Phase.GAME_STARTING, Timing.GET_READY)
    return null
  }

  fun pause() {
    if (paused || phaseDuration == null || phase == Phase.FINAL_SCORES) return
    pausedAt = now()
    changed()
  }

  fun resume() {
    val at = pausedAt ?: return
    phaseStart += now() - at
    pausedAt = null
    changed()
  }

  /** Voids the current question: nobody scores, and play moves on (spec §6.2). */
  fun skip() {
    if (phase != Phase.QUESTION) return
    val q = question ?: return
    outcome = Outcome(questionSeq, q, round!!.style, voided = true, results = emptyMap(), ranking = emptyList(), choiceCounts = emptyMap())
    for (id in eligible) roster[id]?.lastPoints = null
    pausedAt = null
    afterQuestion()
  }

  fun stop() {
    if (phase == Phase.LOBBY || phase == Phase.FINAL_SCORES || phase == Phase.ENDED) return
    stopped = true
    enter(Phase.FINAL_SCORES, Timing.PLAY_ANOTHER_WINDOW)
  }

  /** From final scores back to the lobby; players stay connected (spec §5.6). */
  fun playAnother() {
    if (phase != Phase.FINAL_SCORES) return
    game = null
    outcome = null
    enter(Phase.LOBBY, null)
  }

  fun endSession() {
    if (phase == Phase.ENDED) return
    enter(Phase.ENDED, null)
  }

  // --- Answers ------------------------------------------------------------------------------

  /** Records an answer. Returns why it was refused, or null. The arrival time is what counts. */
  fun answer(playerId: Int, seq: Int, value: AnswerValue): String? {
    if (phase != Phase.QUESTION || seq != questionSeq) return "This question is closed"
    if (paused) return "The game is paused"
    if (playerId !in eligible) return "You can answer from the next question"
    if (playerId in answers) return "Your answer is already locked in"
    val q = question!!
    val valid = when (round!!.style) {
      Style.CLOSEST_WITHOUT_GOING_OVER -> value is AnswerValue.Number && value.value.isFinite()
      Style.MULTIPLE_CHOICE, Style.FASTEST_FINGER -> value is AnswerValue.Pick && q.choices.any { it.id == value.choiceId }
    }
    if (!valid) return "That answer does not fit this question"
    answers[playerId] = Answer(value, elapsed())
    changed()
    closeEarlyIfAllAnswered()
    return null
  }

  // --- Time ---------------------------------------------------------------------------------

  /** When the server must call [tick] next, or null if nothing is scheduled (untimed or paused). */
  fun nextWakeAt(): Long? {
    val duration = phaseDuration ?: return null
    if (paused) return null
    val marks = mutableListOf(phaseStart + duration)
    if (phase == Phase.QUESTION) {
      if (!countdownCued) marks.add(phaseStart + readingMs)
      if (!lastSecondsCued && answerMs > Timing.LAST_SECONDS) marks.add(phaseStart + duration - Timing.LAST_SECONDS)
    }
    return marks.min()
  }

  /** Advances through every phase boundary and cue that is due. */
  fun tick() {
    while (!paused) {
      val duration = phaseDuration ?: return
      val elapsed = elapsed()
      if (phase == Phase.QUESTION) {
        if (!countdownCued && elapsed >= readingMs) {
          countdownCued = true
          cue(Cue.COUNTDOWN_STARTED)
        }
        if (!lastSecondsCued && answerMs > Timing.LAST_SECONDS && duration - elapsed <= Timing.LAST_SECONDS) {
          lastSecondsCued = true
          cue(Cue.LAST_SECONDS)
        }
      }
      if (elapsed < duration) return
      phaseEnded()
    }
  }

  private fun phaseEnded() {
    when (phase) {
      Phase.GAME_STARTING -> startRound(0)
      Phase.ROUND_INTRO -> startQuestion(0)
      Phase.QUESTION -> close(ranOut = true)
      Phase.TIMES_UP -> enter(Phase.REVEAL, Timing.reveal(round!!.durations))
      Phase.REVEAL -> afterQuestion()
      Phase.ROUND_SCORES ->
        if (roundIndex + 1 < game!!.rounds.size) enter(Phase.ROUND_BREAK, Timing.roundBreak(round!!.durations))
        else enter(Phase.FINAL_SCORES, Timing.PLAY_ANOTHER_WINDOW)
      Phase.ROUND_BREAK -> startRound(roundIndex + 1)
      Phase.FINAL_SCORES -> enter(Phase.ENDED, null)
      Phase.LOBBY, Phase.ENDED -> Unit
    }
  }

  private fun startRound(index: Int) {
    roundIndex = index
    for (p in roster.values) p.roundPoints = 0
    enter(Phase.ROUND_INTRO, Timing.ROUND_INTRO)
  }

  private fun startQuestion(index: Int) {
    questionIndex = index
    questionSeq++
    val r = round!!
    readingMs = Timing.readingBuffer(r.questions[index], r.durations)
    answerMs = Timing.answer(r.durations)
    // Late joiners wait for the next question; everyone seated now may answer this one.
    eligible = roster.keys.toSet()
    answers.clear()
    countdownCued = false
    lastSecondsCued = false
    enter(Phase.QUESTION, readingMs + answerMs)
    cue(Cue.QUESTION_SHOWN)
  }

  private fun close(ranOut: Boolean) {
    val r = round!!
    val q = question!!
    val scoring = game!!.scoring
    val ids = eligible.filter { it in roster }
    val results = when (r.style) {
      Style.MULTIPLE_CHOICE -> ScoringRules.multipleChoice(q, ids, answers, scoring, readingMs, answerMs)
      Style.FASTEST_FINGER -> ScoringRules.fastestFinger(q, ids, answers, scoring)
      Style.CLOSEST_WITHOUT_GOING_OVER -> ScoringRules.closest(q, ids, answers, scoring, readingMs, answerMs)
    }
    for ((id, result) in results) {
      val p = roster[id] ?: continue
      p.total += result.points
      p.roundPoints += result.points
      p.lastPoints = result.points
    }
    val counts = answers.values.mapNotNull { (it.value as? AnswerValue.Pick)?.choiceId }.groupingBy { it }.eachCount()
    val ranking = when (r.style) {
      Style.CLOSEST_WITHOUT_GOING_OVER -> ScoringRules.closestRanking(q, results)
      Style.FASTEST_FINGER -> ScoringRules.fastestRanking(answers, results)
      Style.MULTIPLE_CHOICE -> emptyList()
    }
    outcome = Outcome(questionSeq, q, r.style, voided = false, results = results, ranking = ranking, choiceCounts = counts)
    // A "time's up" breather only when the clock ran out (spec §6.2).
    if (ranOut) enter(Phase.TIMES_UP, Timing.TIMES_UP) else enter(Phase.REVEAL, Timing.reveal(r.durations))
  }

  private fun afterQuestion() {
    if (questionIndex + 1 < round!!.questions.size) {
      startQuestion(questionIndex + 1)
    } else {
      cue(Cue.ROUND_END)
      enter(Phase.ROUND_SCORES, Timing.ROUND_SCORES)
    }
  }

  private fun closeEarlyIfAllAnswered() {
    if (game?.closeEarly != true || phase != Phase.QUESTION || paused) return
    // Only players who are here and looking count; a sleeping phone never holds up the room.
    val present = eligible.filter { id -> roster[id]?.let { it.connected && it.awake } == true }
    if (present.isNotEmpty() && present.all { it in answers }) close(ranOut = false)
  }

  private fun enter(next: Phase, duration: Long?) {
    phase = next
    phaseStart = now()
    phaseDuration = duration
    pausedAt = null
    if (next == Phase.REVEAL) cue(Cue.REVEAL)
    changed()
  }

  private fun elapsed(): Long = (pausedAt ?: now()) - phaseStart

  private fun cue(c: Cue) {
    cues.add(c)
    changed()
  }

  private fun changed() {
    version++
  }
}
