package com.queaura.server.net

import com.queaura.server.engine.Engine
import com.queaura.server.engine.Phase
import com.queaura.server.protocol.Codec
import fi.iki.elonen.NanoHTTPD
import org.java_websocket.WebSocket
import org.json.JSONObject
import java.io.File
import java.security.SecureRandom
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/**
 * The session: HTTP for the web client, WebSocket for everyone (players, TV, and the host app),
 * and one game-loop thread that owns the [Engine]. Has no Android dependencies.
 */
class GameServer(
  val httpPort: Int,
  val wsPort: Int,
  assets: AssetSource,
  logDir: File,
) : WsServer.Handler {
  /** The host app proves itself with this key; players and the TV never see it. */
  val hostKey: String = ByteArray(16).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }

  val log = EventLog(logDir)
  private val loop = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "game-loop").apply { isDaemon = true } }
  private val engine = Engine { System.currentTimeMillis() }
  private val ws = WsServer(wsPort, ::post, this, log)
  private val http = HttpServer(httpPort, wsPort, assets)

  private enum class Role { UNKNOWN, PLAYER, TV, HOST }

  private class Client(val conn: WebSocket, val remote: String) {
    var role = Role.UNKNOWN
    var playerId: Int? = null
    var awake = true
  }

  private val clients = LinkedHashMap<WebSocket, Client>()
  private var sentVersion = -1L
  private var flushScheduled = false
  private var wake: ScheduledFuture<*>? = null

  @Volatile
  var summary = Summary(Phase.LOBBY, 0, 0)
    private set

  /** What the host app's native layer can read from any thread. */
  data class Summary(val phase: Phase, val players: Int, val playersOnline: Int)

  fun start() {
    log.write("server_start", mapOf("httpPort" to httpPort, "wsPort" to wsPort))
    // Java-WebSocket binds on its own thread and reports failure asynchronously; wait for it so a
    // taken port fails start() instead of leaving players with a page and no socket.
    ws.start()
    if (!ws.started.await(5, TimeUnit.SECONDS)) throw IllegalStateException("WebSocket server did not start on port $wsPort")
    ws.startError?.let { throw IllegalStateException("WebSocket port $wsPort: ${it.message}", it) }
    http.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
  }

  fun stop() {
    log.write("server_stop")
    runCatching { http.stop() }
    runCatching { ws.stop(1000) }
    loop.shutdownNow()
    log.close()
  }

  // --- WebSocket events (game-loop thread) ---------------------------------------------------

  override fun onOpen(conn: WebSocket, remote: String) {
    clients[conn] = Client(conn, remote)
  }

  override fun onClose(conn: WebSocket, code: Int) {
    val client = clients.remove(conn) ?: return
    val id = client.playerId
    if (id != null && clients.values.none { it.playerId == id }) engine.setPresence(id, connected = false, awake = client.awake)
    log.write("close", mapOf("remote" to client.remote, "role" to client.role.name, "player" to id, "code" to code))
    flushSoon()
  }

  override fun onMessage(conn: WebSocket, text: String) {
    val client = clients[conn] ?: return
    val msg = runCatching { JSONObject(text) }.getOrNull() ?: return
    when (msg.optString("t")) {
      "hello" -> hello(client, msg)
      "join" -> join(client, msg)
      "answer" -> answer(client, msg)
      "visibility" -> visibility(client, msg.optBoolean("hidden"))
      "ping" -> send(client, JSONObject().put("t", "pong").put("c", msg.opt("c") ?: 0))
      "host" -> if (client.role == Role.HOST) hostCommand(client, msg)
    }
    flushSoon()
  }

  private fun hello(client: Client, msg: JSONObject) {
    client.awake = !msg.optBoolean("hidden", false)
    when (msg.optString("role")) {
      "host" -> {
        if (msg.optString("hostKey") != hostKey) {
          client.conn.close(CLOSE_FORBIDDEN, "not the host")
          return
        }
        client.role = Role.HOST
        send(client, JSONObject().put("t", "welcome").put("role", "host"))
      }
      "tv" -> {
        client.role = Role.TV
        send(client, JSONObject().put("t", "welcome").put("role", "tv"))
      }
      else -> {
        client.role = Role.PLAYER
        val token = msg.optString("token")
        when {
          token.isNotEmpty() && engine.isKicked(token) -> kickedOut(client)
          token.isNotEmpty() && engine.playerByToken(token) != null -> seat(client, engine.playerByToken(token)!!.id, resumed = true)
          engine.phase == Phase.ENDED -> send(client, JSONObject().put("t", "ended"))
          else -> send(client, JSONObject().put("t", "needJoin"))
        }
      }
    }
    sendState(client)
  }

  private fun join(client: Client, msg: JSONObject) {
    if (client.role != Role.PLAYER || client.playerId != null) return
    if (engine.phase == Phase.ENDED) {
      send(client, JSONObject().put("t", "ended"))
      return
    }
    val name = msg.optString("name").trim().take(MAX_NAME)
    if (name.isEmpty()) {
      send(client, JSONObject().put("t", "error").put("message", "Please enter a nickname"))
      return
    }
    val player = engine.join(name, msg.optString("emoji").take(MAX_EMOJI))
    seat(client, player.id, resumed = false)
  }

  private fun seat(client: Client, playerId: Int, resumed: Boolean) {
    // A newer tab or a reconnect that beat the old socket's timeout takes over the seat.
    for (other in clients.values.toList()) {
      if (other !== client && other.playerId == playerId) {
        other.playerId = null
        runCatching { other.conn.close(CLOSE_REPLACED, "replaced") }
      }
    }
    client.playerId = playerId
    val player = engine.player(playerId)!!
    engine.setPresence(playerId, connected = true, awake = client.awake)
    send(client, JSONObject().put("t", "welcome").put("role", "player").put("token", player.token).put("resumed", resumed).put("playerId", playerId))
    log.write(if (resumed) "resume" else "join", mapOf("remote" to client.remote, "player" to playerId, "name" to player.name))
  }

  private fun answer(client: Client, msg: JSONObject) {
    val id = client.playerId ?: return
    val value = Codec.answerValue(msg)
    val refused = if (value == null) "That answer does not fit this question" else engine.answer(id, msg.optInt("seq"), value)
    if (refused != null) send(client, JSONObject().put("t", "error").put("message", refused))
  }

  private fun visibility(client: Client, hidden: Boolean) {
    client.awake = !hidden
    client.playerId?.let { engine.setPresence(it, connected = true, awake = client.awake) }
  }

  private fun hostCommand(client: Client, msg: JSONObject) {
    when (msg.optString("cmd")) {
      "start" -> {
        val problem = runCatching { engine.start(Codec.game(msg.getJSONObject("game"))) }
          .getOrElse { "That game could not be read (${it.message})" }
        if (problem != null) send(client, JSONObject().put("t", "error").put("message", problem))
      }
      "pause" -> engine.pause()
      "resume" -> engine.resume()
      "skip" -> engine.skip()
      "stop" -> engine.stop()
      "playAnother" -> engine.playAnother()
      "endSession" -> engine.endSession()
      "kick" -> engine.kick(msg.optInt("playerId"))?.let { kicked ->
        for (c in clients.values.filter { it.playerId == kicked.id }) kickedOut(c)
        log.write("kick", mapOf("player" to kicked.id, "name" to kicked.name))
      }
    }
  }

  private fun kickedOut(client: Client) {
    client.playerId = null
    send(client, JSONObject().put("t", "kicked"))
    runCatching { client.conn.close(CLOSE_KICKED, "kicked") }
  }

  // --- Broadcasting --------------------------------------------------------------------------

  /** Coalesces bursts (many answers at once) into one broadcast per [FLUSH_MS]. */
  private fun flushSoon() {
    if (flushScheduled) return
    flushScheduled = true
    loop.schedule(guarded("flush") { flush() }, FLUSH_MS, TimeUnit.MILLISECONDS)
  }

  private fun flush() {
    flushScheduled = false
    val cues = engine.drainCues()
    if (engine.version != sentVersion) {
      sentVersion = engine.version
      val base = Codec.publicState(engine)
      for (client in clients.values) sendState(client, base)
    }
    for (cue in cues) broadcast(JSONObject().put("t", "cue").put("name", Codec.camel(cue.name)).toString())
    summary = Summary(engine.phase, engine.players.size, engine.players.count { it.connected })
    scheduleWake()
  }

  private fun sendState(client: Client, base: JSONObject = Codec.publicState(engine)) {
    val audience = when (client.role) {
      Role.HOST -> Codec.Audience.Host
      Role.TV -> Codec.Audience.Tv
      Role.PLAYER -> client.playerId?.let { Codec.Audience.ForPlayer(it) } ?: Codec.Audience.Tv
      Role.UNKNOWN -> return
    }
    sendText(client, Codec.stateFor(base, engine, audience))
  }

  /** Wakes the engine exactly when its next phase boundary or cue is due. */
  private fun scheduleWake() {
    wake?.cancel(false)
    val at = engine.nextWakeAt() ?: return
    val delay = (at - System.currentTimeMillis()).coerceAtLeast(0)
    wake = loop.schedule(guarded("tick") {
      engine.tick()
      flush()
    }, delay, TimeUnit.MILLISECONDS)
  }

  private fun broadcast(text: String) {
    for (client in clients.values) if (client.role != Role.UNKNOWN) sendText(client, text)
  }

  private fun send(client: Client, msg: JSONObject) = sendText(client, msg.toString())

  private fun sendText(client: Client, text: String) {
    if (client.conn.isOpen) runCatching { client.conn.send(text) }
  }

  private fun post(task: () -> Unit) {
    try {
      loop.execute(guarded("event", task))
    } catch (_: RejectedExecutionException) {
      // Shutting down.
    }
  }

  private fun guarded(what: String, task: () -> Unit) = Runnable {
    try {
      task()
    } catch (e: Exception) {
      log.write("loop_error", mapOf("in" to what, "error" to e.toString()))
    }
  }

  companion object {
    const val CLOSE_REPLACED = 4000
    const val CLOSE_KICKED = 4001
    const val CLOSE_FORBIDDEN = 4003
    private const val FLUSH_MS = 30L
    private const val MAX_NAME = 20
    private const val MAX_EMOJI = 8
  }
}
