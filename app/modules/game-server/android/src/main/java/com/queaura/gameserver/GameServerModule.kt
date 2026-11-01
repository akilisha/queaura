package com.queaura.gameserver

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.queaura.server.net.lanAddresses
import expo.modules.kotlin.Promise
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
        "hotspot" to Hotspot.info,
      )
    }

    AsyncFunction("startHotspot") { promise: Promise ->
      Hotspot.start(context, promise)
    }

    Function("stopHotspot") {
      Hotspot.stop()
    }

    /** True when Android may pause the app in the background (spec §3.1 walkthrough). */
    Function("isBatteryRestricted") {
      if (Build.VERSION.SDK_INT < 23) return@Function false
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      power.isIgnoringBatteryOptimizations(context.packageName).not()
    }

    /** The app's own settings page; on Samsung, Battery → Unrestricted is one tap from here. */
    Function("openAppSettings") {
      open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }

    Function("openWifiSettings") {
      open(Intent(Settings.ACTION_WIFI_SETTINGS))
    }
  }

  private fun open(intent: Intent) {
    val activity = appContext.currentActivity
    if (activity != null) activity.startActivity(intent) else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
}
