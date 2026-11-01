package com.queaura.server.net

import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.net.InetSocketAddress
import java.util.concurrent.CountDownLatch

/** Java-WebSocket transport. Hands every event to the game loop; holds no state of its own. */
class WsServer(
  port: Int,
  private val post: (() -> Unit) -> Unit,
  private val handler: Handler,
  private val log: EventLog,
) : WebSocketServer(InetSocketAddress(port)) {

  interface Handler {
    fun onOpen(conn: WebSocket, remote: String)
    fun onMessage(conn: WebSocket, text: String)
    fun onClose(conn: WebSocket, code: Int)
  }

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
    started.countDown()
  }

  override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
    val remote = conn.remoteSocketAddress?.address?.hostAddress ?: "unknown"
    post { handler.onOpen(conn, remote) }
  }

  override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) {
    post { handler.onClose(conn, code) }
  }

  override fun onMessage(conn: WebSocket, message: String) {
    post { handler.onMessage(conn, message) }
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
