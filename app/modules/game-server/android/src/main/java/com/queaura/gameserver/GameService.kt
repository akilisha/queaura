package com.queaura.gameserver

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import com.queaura.server.net.AssetSource
import com.queaura.server.net.GameServer
import java.io.File

/**
 * Foreground service that owns the game server, so a session does not depend on the React Native
 * activity. Holds a partial wake lock and a Wi-Fi lock so the CPU and radio stay up.
 */
class GameService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP || intent == null) {
      // A null intent is Android restarting a killed service: the session (and its players) is
      // gone, so do not come back as an empty server nobody asked for.
      shutdown()
      stopSelf()
      return START_NOT_STICKY
    }
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
    } else {
      startForeground(NOTIFICATION_ID, notification())
    }
    if (server == null && !startServer()) {
      stopSelf()
      return START_NOT_STICKY
    }
    return START_NOT_STICKY
  }

  /** Returns false if the server could not start, for example because a port is taken. */
  private fun startServer(): Boolean {
    val assets = AssetSource { path -> runCatching { this.assets.open("web/$path") }.getOrNull() }
    val s = GameServer(HTTP_PORT, WS_PORT, assets, File(getExternalFilesDir(null) ?: filesDir, "logs"))
    try {
      s.start()
    } catch (e: Exception) {
      s.log.write("server_start_failed", mapOf("error" to e.toString()))
      s.stop()
      lastError = "The game server could not start: ${e.message}"
      return false
    }
    lastError = null
    server = s
    acquireLocks()
    return true
  }

  private fun acquireLocks() {
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "queaura:server").apply { acquire() }
    val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    @Suppress("DEPRECATION")
    val mode = if (Build.VERSION.SDK_INT >= 29) WifiManager.WIFI_MODE_FULL_LOW_LATENCY else WifiManager.WIFI_MODE_FULL_HIGH_PERF
    wifiLock = wifi.createWifiLock(mode, "queaura:server").apply { acquire() }
  }

  private fun shutdown() {
    server?.stop()
    server = null
    wakeLock?.takeIf { it.isHeld }?.release()
    wifiLock?.takeIf { it.isHeld }?.release()
    wakeLock = null
    wifiLock = null
  }

  override fun onDestroy() {
    shutdown()
    super.onDestroy()
  }

  private fun notification(): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Game in progress", NotificationManager.IMPORTANCE_LOW))
    }
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE)
    }
    val builder = if (Build.VERSION.SDK_INT >= 26) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setContentTitle("Hosting a game")
      .setContentText("Players can join on this network")
      .setSmallIcon(android.R.drawable.stat_sys_upload_done)
      .setContentIntent(open)
      .setOngoing(true)
      .build()
  }

  companion object {
    const val HTTP_PORT = 8080
    // Not 8081: that is Metro's port, which a development build forwards to the phone over adb.
    const val WS_PORT = 8090
    private const val ACTION_STOP = "com.queaura.gameserver.STOP"
    private const val CHANNEL_ID = "game"
    private const val NOTIFICATION_ID = 1

    /** The running server, shared with the Expo module in the same process. */
    @Volatile
    var server: GameServer? = null
      private set

    /** Why the last start failed, shown in the host app. */
    @Volatile
    var lastError: String? = null
      private set

    fun start(context: Context) {
      val intent = Intent(context, GameService::class.java)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
    }

    fun stop(context: Context) {
      context.startService(Intent(context, GameService::class.java).setAction(ACTION_STOP))
    }
  }
}
