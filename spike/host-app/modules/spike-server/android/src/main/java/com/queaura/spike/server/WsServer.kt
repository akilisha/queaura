package com.queaura.spike.server

import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.net.InetSocketAddress
import java.util.concurrent.CountDownLatch

/** Java-WebSocket transport. It only hands events to the game loop; it holds no state. */
class WsServer(
  port: Int,
  private val post: (() -> Unit) -> Unit,
  private val game: Game,
  private val log: EventLog,
) : WebSocketServer(InetSocketAddress(port)) {
  /** Released once the listener is bound or has failed to bind; see [startError]. */
  val started = CountDownLatch(1)

  @Volatile
  var startError: Exception? = null
    private set

  init {
    isReuseAddr = true
    isTcpNoDelay = true
    // Server-side ping; a client that stops answering is closed after this many seconds.
    connectionLostTimeout = 15
  }

  override fun onStart() {
    log.write("ws_listening", mapOf("port" to port))
    started.countDown()
  }

  override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
    val remote = conn.remoteSocketAddress?.address?.hostAddress ?: "unknown"
    post { game.onOpen(conn, remote) }
  }

  override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) {
    post { game.onClose(conn, code, reason, remote) }
  }

  override fun onMessage(conn: WebSocket, message: String) {
    post { game.onMessage(conn, message) }
  }

  override fun onError(conn: WebSocket?, ex: Exception) {
    log.write("ws_error", mapOf("error" to ex.toString()))
    // No connection means the server itself failed, for example the port is already taken.
    if (conn == null && started.count > 0) {
      startError = ex
      started.countDown()
    }
  }
}
