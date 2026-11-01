package com.queaura.gameserver

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.queaura.server.moderation.WordFilter
import com.queaura.server.net.lanAddresses
import java.io.File
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

    /** The first word in [text] not allowed on shared screens (spec §9), or null. */
    Function("findBlocked") { text: String ->
      WordFilter.english.find(text)
    }

    /**
     * Questionnaire answer files (spec §6.4) waiting to be saved or discarded, oldest first. The
     * one the server is writing right now is marked active: it is not finished yet.
     */
    Function("listQuestionnaires") {
      val active = GameService.server?.activeQuestionnaire
      val files = GameService.questionnaireDir(context).listFiles { f -> JOURNAL_NAME.matches(f.name) }.orEmpty()
      files.sortedBy { it.name.removePrefix("questionnaire-").removeSuffix(".jsonl").toLongOrNull() ?: 0 }
        .map { mapOf("name" to it.name, "active" to (it.name == active)) }
    }

    Function("readQuestionnaire") { name: String ->
      journal(name).readText()
    }

    Function("deleteQuestionnaire") { name: String ->
      journal(name).delete()
    }

    /** Writes a file to share (a CSV export) into the app's cache and returns its file:// URI. */
    Function("writeShareFile") { name: String, content: String ->
      if (!SHARE_NAME.matches(name)) throw IllegalArgumentException("Not a file name: $name")
      val dir = File(context.cacheDir, "share").apply { mkdirs() }
      val file = File(dir, name)
      file.writeText(content)
      Uri.fromFile(file).toString()
    }
  }

  private fun journal(name: String): File {
    if (!JOURNAL_NAME.matches(name)) throw IllegalArgumentException("Not a questionnaire file: $name")
    return File(GameService.questionnaireDir(context), name)
  }

  private companion object {
    val JOURNAL_NAME = Regex("questionnaire-\\d+\\.jsonl")
    val SHARE_NAME = Regex("[A-Za-z0-9 ._-]{1,80}\\.csv")
  }

  private fun open(intent: Intent) {
    val activity = appContext.currentActivity
    if (activity != null) activity.startActivity(intent) else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
}
