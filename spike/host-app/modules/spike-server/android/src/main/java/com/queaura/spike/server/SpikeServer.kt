package com.queaura.spike.server

import fi.iki.elonen.NanoHTTPD
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

/**
 * HTTP + WebSocket server with a single game-loop thread that owns all state.
 * Has no Android dependencies so it can be soak-tested on a desktop JVM.
 */
class SpikeServer(
  val httpPort: Int,
  val wsPort: Int,
  assets: AssetSource,
  logDir: File,
) {
  val log = EventLog(File(logDir, "spike-" + SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date()) + ".jsonl"))
  private val loop = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "game-loop").apply { isDaemon = true } }
  private val game = Game(log)
  private val ws = WsServer(wsPort, ::post, game, log)
  private val http = HttpServer(httpPort, wsPort, assets, log, ::statsJson)

  val snapshot: Snapshot get() = game.snapshot

  fun start() {
    log.write("server_start", mapOf("httpPort" to httpPort, "wsPort" to wsPort))
    // Java-WebSocket binds on its own thread and reports failure asynchronously; wait for it so a
    // taken port fails start() instead of leaving players with a page and no socket.
    ws.start()
    if (!ws.started.await(5, TimeUnit.SECONDS)) throw IllegalStateException("WebSocket server did not start on port $wsPort")
    ws.startError?.let { throw IllegalStateException("WebSocket port $wsPort: ${it.message}", it) }
    http.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
    // A task that throws is silently cancelled by the executor, so guard the periodic ones.
    loop.scheduleAtFixedRate(guarded("tick") { game.tick() }, 1, 1, TimeUnit.SECONDS)
    loop.scheduleWithFixedDelay(guarded("flush") { game.flush() }, 100, 100, TimeUnit.MILLISECONDS)
  }

  fun stop() {
    log.write("server_stop")
    runCatching { http.stop() }
    runCatching { ws.stop(1000) }
    loop.shutdownNow()
    log.close()
  }

  private fun post(task: () -> Unit) {
    try {
      loop.execute(guarded("event", task))
    } catch (_: RejectedExecutionException) {
      // Shutting down.
    }
  }

  private fun statsJson(): String = loop.submit(Callable { game.stats().toString(2) }).get(2, TimeUnit.SECONDS)

  private fun guarded(what: String, task: () -> Unit) = Runnable {
    try {
      task()
    } catch (e: Exception) {
      log.write("loop_error", mapOf("in" to what, "error" to e.toString()))
    }
  }
}
