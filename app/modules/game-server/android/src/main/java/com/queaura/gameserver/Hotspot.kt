package com.queaura.gameserver

import android.content.Context
import android.net.wifi.SoftApConfiguration
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise

/**
 * Android LocalOnlyHotspot (spec §3.3): the phone creates its own Wi-Fi network with generated
 * credentials, which bypasses venue Wi-Fi that stops phones seeing each other. The reservation
 * must stay referenced or Android takes the network down.
 */
object Hotspot {
  private var reservation: WifiManager.LocalOnlyHotspotReservation? = null

  /** The network players join while it is up; null otherwise. */
  @Volatile
  var info: Map<String, Any?>? = null
    private set

  fun start(context: Context, promise: Promise) {
    if (Build.VERSION.SDK_INT < 26) {
      promise.reject("ERR_UNSUPPORTED", "This phone's Android version can't create its own network.", null)
      return
    }
    info?.let {
      promise.resolve(it)
      return
    }
    val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    try {
      wifi.startLocalOnlyHotspot(object : WifiManager.LocalOnlyHotspotCallback() {
        override fun onStarted(res: WifiManager.LocalOnlyHotspotReservation) {
          reservation = res
          val details = describe(res)
          info = details
          promise.resolve(details)
        }

        override fun onStopped() {
          reservation = null
          info = null
        }

        override fun onFailed(reason: Int) {
          promise.reject("ERR_HOTSPOT_FAILED", failure(reason), null)
        }
      }, Handler(Looper.getMainLooper()))
    } catch (e: SecurityException) {
      promise.reject("ERR_PERMISSION", "QueAura needs permission to create a Wi-Fi network.", e)
    } catch (e: IllegalStateException) {
      promise.reject("ERR_HOTSPOT_FAILED", "The phone couldn't create a network right now. Try again in a moment.", e)
    }
  }

  fun stop() {
    reservation?.close()
    reservation = null
    info = null
  }

  /** Plain-language reasons for WifiManager.LocalOnlyHotspotCallback failure codes. */
  private fun failure(reason: Int): String = when (reason) {
    WifiManager.LocalOnlyHotspotCallback.ERROR_INCOMPATIBLE_MODE ->
      "The phone's regular hotspot is on. Turn it off, then try again."
    WifiManager.LocalOnlyHotspotCallback.ERROR_TETHERING_DISALLOWED ->
      "This phone doesn't allow creating a network (it may be blocked by a work profile or the carrier)."
    WifiManager.LocalOnlyHotspotCallback.ERROR_NO_CHANNEL ->
      "The phone couldn't find a free Wi-Fi channel. Try again in a moment."
    else -> "The phone couldn't create a network. Try again in a moment."
  }

  private fun describe(res: WifiManager.LocalOnlyHotspotReservation): Map<String, Any?> {
    if (Build.VERSION.SDK_INT >= 30) {
      val config = res.softApConfiguration
      val ssid = if (Build.VERSION.SDK_INT >= 33) {
        config.wifiSsid?.toString()?.removeSurrounding("\"")
      } else {
        @Suppress("DEPRECATION")
        config.ssid
      }
      val security = when (config.securityType) {
        SoftApConfiguration.SECURITY_TYPE_OPEN -> "nopass"
        SoftApConfiguration.SECURITY_TYPE_WPA3_SAE -> "SAE"
        else -> "WPA"
      }
      return mapOf("ssid" to ssid, "passphrase" to config.passphrase, "security" to security)
    }
    @Suppress("DEPRECATION")
    val config = res.wifiConfiguration
    @Suppress("DEPRECATION")
    return mapOf(
      "ssid" to config?.SSID?.removeSurrounding("\""),
      "passphrase" to config?.preSharedKey?.removeSurrounding("\""),
      "security" to "WPA",
    )
  }
}
