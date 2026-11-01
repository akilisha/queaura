package com.queaura.spike.server

import org.java_websocket.WebSocket
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Snapshot the host UI can read from any thread. */
data class Snapshot(
  val players: Int,
  val playersOnline: Int,
  val viewers: Int,
  val unexpectedCloses: Int,
  val sleepCloses: Int,
  val ticks: Long,
  val maxTickLateMs: Double,
)

class Player(val id: Int, val token: String, var name: String, var emoji: String) {
  var taps = 0
  var session: Session? = null
}

class Session(val conn: WebSocket, val remote: String, val openedAt: Long) {
  var mode = "unknown"
  var player: Player? = null

  /** The page reported itself hidden (screen off, app switched) and has not come back. */
  var hidden = false
}

/**
 * Spike game state: a counter broadcast every second, a tap tally per player, and seat
 * resumption by token. Every method runs on the single game-loop thread, so there is no locking.
 */
class Game(private val log: EventLog) {
  private val players = LinkedHashMap<String, Player>() // by token
  private val sessions = LinkedHashMap<WebSocket, Session>()
  private var nextPlayerId = 1
  private var totalTaps = 0
  private var dirty = false

  private var ticks = 0L
  private var tickStartNanos = 0L
  private val tickLateMs = ArrayList<Double>()
  private var minuteMaxLateMs = 0.0
  private var closes = 0
  private var unexpectedCloses = 0
  private var sleepCloses = 0
  private var pageHides = 0
  private val closeCodes = HashMap<Int, Int>()
  private val rttMs = ArrayList<Int>()
  private val joinMs = ArrayList<Int>()
  private val reconnectMs = ArrayList<Int>()
  private val startedAt = System.currentTimeMillis()

  @Volatile
  var snapshot = Snapshot(0, 0, 0, 0, 0, 0, 0.0)
    private set

  fun onOpen(conn: WebSocket, remote: String) {
    sessions[conn] = Session(conn, remote, System.currentTimeMillis())
    log.write("ws_open", mapOf("remote" to remote, "sessions" to sessions.size))
  }

  fun onClose(conn: WebSocket, code: Int, reason: String?, byRemote: Boolean) {
    val session = sessions.remove(conn) ?: return
    val player = session.player
    if (player != null && player.session === session) {
      player.session = null
      dirty = true
    }
    closes++
    closeCodes[code] = (closeCodes[code] ?: 0) + 1
    // 1000/1001 are clean closes (tab closed, navigated away, page refreshed); 4000 is our seat handover.
    // A drop after the page said it was hidden is the phone sleeping, which is normal (spec §3.4);
    // anything else is a network or server drop.
    val clean = code == 1000 || code == 1001 || code == CLOSE_REPLACED
    if (!clean && session.hidden) sleepCloses++
    if (!clean && !session.hidden) unexpectedCloses++
    log.write(
      "ws_close",
      mapOf(
        "remote" to session.remote, "mode" to session.mode, "player" to player?.id, "code" to code,
        "reason" to reason, "byRemote" to byRemote, "durationMs" to System.currentTimeMillis() - session.openedAt,
        "hidden" to session.hidden,
      ),
    )
    publish()
  }

  fun onMessage(conn: WebSocket, text: String) {
    val session = sessions[conn] ?: return
    val msg = runCatching { JSONObject(text) }.getOrElse {
      log.write("bad_message", mapOf("remote" to session.remote))
      return
    }
    when (msg.optString("t")) {
      "hello" -> hello(session, msg)
      "join" -> join(session, msg)
      "tap" -> tap(session)
      "ping" -> ping(session, msg)
      "metric" -> metric(session, msg)
      "visibility" -> visibility(session, msg)
    }
  }

  private fun hello(session: Session, msg: JSONObject) {
    session.mode = msg.optString("mode", "player")
    session.hidden = msg.optBoolean("hidden", false)
    log.write("hello", mapOf("remote" to session.remote, "mode" to session.mode, "ua" to msg.optString("ua")))
    if (session.mode != "player") {
      send(session, JSONObject().put("t", "welcome").put("role", "viewer"))
      send(session, stateMessage())
      publish()
      return
    }
    val player = msg.optString("token").takeIf { it.isNotEmpty() }?.let { players[it] }
    if (player == null) {
      send(session, JSONObject().put("t", "needJoin"))
      return
    }
    seat(session, player, resumed = true)
  }

  private fun join(session: Session, msg: JSONObject) {
    val name = msg.optString("name").trim().take(MAX_NAME)
    if (name.isEmpty()) {
      send(session, JSONObject().put("t", "error").put("message", "Nickname is required"))
      return
    }
    val player = Player(nextPlayerId++, UUID.randomUUID().toString(), name, msg.optString("emoji").take(8))
    players[player.token] = player
    seat(session, player, resumed = false)
  }

  private fun seat(session: Session, player: Player, resumed: Boolean) {
    // A second tab or a reconnect that beat the old socket's timeout takes over the seat.
    player.session?.takeIf { it !== session }?.let { old ->
      old.player = null
      runCatching { old.conn.close(CLOSE_REPLACED, "replaced") }
    }
    session.mode = "player"
    session.player = player
    player.session = session
    send(
      session,
      JSONObject().put("t", "welcome").put("role", "player").put("token", player.token)
        .put("resumed", resumed).put("player", playerJson(player)),
    )
    log.write(if (resumed) "resume" else "join", mapOf("remote" to session.remote, "player" to player.id, "name" to player.name))
    dirty = true
    publish()
  }

  private fun tap(session: Session) {
    val player = session.player ?: return
    player.taps++
    totalTaps++
    dirty = true
  }

  private fun ping(session: Session, msg: JSONObject) {
    send(
      session,
      // Echo the client's clock reading untouched; the client computes the round trip.
      JSONObject().put("t", "pong").put("id", msg.optInt("id")).put("c", msg.opt("c") ?: 0).put("s", System.currentTimeMillis()),
    )
    if (msg.has("lastRtt")) {
      val rtt = msg.optInt("lastRtt")
      rttMs.add(rtt)
      log.write("rtt", mapOf("player" to session.player?.id, "mode" to session.mode, "ms" to rtt))
    }
  }

  private fun visibility(session: Session, msg: JSONObject) {
    session.hidden = msg.optBoolean("hidden")
    if (session.hidden) pageHides++
    log.write("visibility", mapOf("remote" to session.remote, "player" to session.player?.id, "hidden" to session.hidden))
  }

  private fun metric(session: Session, msg: JSONObject) {
    when (msg.optString("kind")) {
      "join" -> joinMs.add(msg.optInt("totalMs"))
      // How long the player waited once looking at the screen again, not how long it was off.
      "reconnect" -> reconnectMs.add(msg.optInt("resumeMs", msg.optInt("downMs")))
    }
    val fields = HashMap<String, Any?>()
    for (key in msg.keys()) if (key != "t") fields[key] = msg.get(key)
    fields["remote"] = session.remote
    fields["player"] = session.player?.id
    log.write("metric", fields)
  }

  /** Called at a fixed 1 s rate. Lateness against the ideal schedule is the tick-drift metric. */
  fun tick() {
    val now = System.nanoTime()
    if (ticks == 0L) tickStartNanos = now - TICK_NANOS
    ticks++
    val lateMs = (now - tickStartNanos - ticks * TICK_NANOS) / 1_000_000.0
    tickLateMs.add(lateMs)
    if (lateMs > minuteMaxLateMs) minuteMaxLateMs = lateMs
    broadcast(JSONObject().put("t", "tick").put("n", ticks).put("st", System.currentTimeMillis()))
    if (ticks % 60 == 0L) {
      log.write(
        "tick_minute",
        mapOf("n" to ticks, "maxLateMs" to minuteMaxLateMs, "sessions" to sessions.size, "online" to playersOnline()),
      )
      minuteMaxLateMs = 0.0
    }
    publish()
  }

  /** Coalesces tap and roster changes into at most one state broadcast per flush interval. */
  fun flush() {
    if (!dirty) return
    dirty = false
    broadcast(stateMessage())
  }

  fun stats(): JSONObject = JSONObject()
    .put("uptimeS", (System.currentTimeMillis() - startedAt) / 1000)
    .put("players", players.size)
    .put("playersOnline", playersOnline())
    .put("viewers", viewers())
    .put("closes", closes)
    .put("unexpectedCloses", unexpectedCloses)
    .put("sleepCloses", sleepCloses)
    .put("pageHides", pageHides)
    .put("closeCodes", JSONObject(closeCodes.mapKeys { it.key.toString() }))
    .put("ticks", ticks)
    .put("tickLateMs", summary(tickLateMs))
    .put("rttMs", summary(rttMs.map { it.toDouble() }))
    .put("joinMs", JSONArray(joinMs))
    .put("reconnectMs", JSONArray(reconnectMs))

  private fun stateMessage(): JSONObject {
    val list = JSONArray()
    for (p in players.values) list.put(playerJson(p))
    return JSONObject().put("t", "state").put("players", list).put("total", totalTaps).put("viewers", viewers())
  }

  private fun playerJson(p: Player) = JSONObject()
    .put("id", p.id).put("name", p.name).put("emoji", p.emoji).put("taps", p.taps).put("online", p.session != null)

  private fun playersOnline() = players.values.count { it.session != null }
  private fun viewers() = sessions.values.count { it.mode == "tv" || it.mode == "diag" }

  private fun publish() {
    snapshot = Snapshot(
      players.size, playersOnline(), viewers(), unexpectedCloses, sleepCloses, ticks, tickLateMs.maxOrNull() ?: 0.0,
    )
  }

  private fun send(session: Session, msg: JSONObject) {
    if (session.conn.isOpen) runCatching { session.conn.send(msg.toString()) }
  }

  private fun broadcast(msg: JSONObject) {
    val text = msg.toString()
    for (s in sessions.values) if (s.conn.isOpen) runCatching { s.conn.send(text) }
  }

  private fun summary(values: List<Double>): JSONObject {
    if (values.isEmpty()) return JSONObject().put("n", 0)
    val sorted = values.sorted()
    fun pct(p: Double) = sorted[((sorted.size - 1) * p).toInt()]
    return JSONObject().put("n", sorted.size).put("median", pct(0.5)).put("p95", pct(0.95))
      .put("p99", pct(0.99)).put("max", sorted.last())
  }

  companion object {
    const val CLOSE_REPLACED = 4000
    private const val MAX_NAME = 20
    private const val TICK_NANOS = 1_000_000_000L
  }
}
