package com.queaura.spike

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.queaura.spike.server.lanAddresses

class SpikeServerModule : Module() {
  private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SpikeServer")

    Function("start") {
      SpikeService.start(context)
    }

    Function("stop") {
      SpikeService.stop(context)
    }

    Function("getStatus") {
      val server = SpikeService.server
      val snapshot = server?.snapshot
      mapOf(
        "running" to (server != null),
        "httpPort" to SpikeService.HTTP_PORT,
        "addresses" to lanAddresses().map { mapOf("name" to it.name, "ip" to it.ip, "kind" to it.kind) },
        "players" to (snapshot?.players ?: 0),
        "playersOnline" to (snapshot?.playersOnline ?: 0),
        "viewers" to (snapshot?.viewers ?: 0),
        "unexpectedCloses" to (snapshot?.unexpectedCloses ?: 0),
        "sleepCloses" to (snapshot?.sleepCloses ?: 0),
        "ticks" to (snapshot?.ticks ?: 0L).toDouble(),
        "maxTickLateMs" to (snapshot?.maxTickLateMs ?: 0.0),
        "logFile" to server?.log?.file?.absolutePath,
        "error" to SpikeService.lastError,
      )
    }

    AsyncFunction("startHotspot") { promise: Promise ->
      Hotspot.start(context, promise)
    }

    Function("stopHotspot") {
      Hotspot.stop()
    }
  }
}
