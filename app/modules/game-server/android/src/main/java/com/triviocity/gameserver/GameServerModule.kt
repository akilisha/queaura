package com.triviocity.gameserver

import com.triviocity.server.net.lanAddresses
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The bridge is deliberately thin: start, stop and status. Everything about the game itself goes
 * over the same WebSocket protocol players use, with the host key (see app/src/host/connection.ts).
 */
class GameServerModule : Module() {
  private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("GameServer")

    Function("start") {
      GameService.start(context)
    }

    Function("stop") {
      GameService.stop(context)
    }

    Function("getStatus") {
      val server = GameService.server
      mapOf(
        "running" to (server != null),
        "httpPort" to GameService.HTTP_PORT,
        "wsPort" to GameService.WS_PORT,
        "hostKey" to server?.hostKey,
        "addresses" to lanAddresses().map { mapOf("name" to it.name, "ip" to it.ip, "kind" to it.kind) },
        "error" to GameService.lastError,
      )
    }
  }
}
