package com.queaura.spike

import android.content.Context
import android.net.wifi.SoftApConfiguration
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise

/**
 * Android LocalOnlyHotspot (spec §3.3 option A): the app creates its own network with
 * generated credentials. The reservation must stay referenced or the hotspot goes down.
 */
object Hotspot {
  private var reservation: WifiManager.LocalOnlyHotspotReservation? = null
  private var info: Map<String, Any?>? = null

  fun start(context: Context, promise: Promise) {
    if (Build.VERSION.SDK_INT < 26) {
      promise.reject("ERR_UNSUPPORTED", "LocalOnlyHotspot needs Android 8 or later", null)
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
          promise.reject("ERR_HOTSPOT_FAILED", "LocalOnlyHotspot failed (reason $reason)", null)
        }
      }, Handler(Looper.getMainLooper()))
    } catch (e: SecurityException) {
      promise.reject("ERR_PERMISSION", e.message ?: "Missing permission", e)
    } catch (e: IllegalStateException) {
      promise.reject("ERR_HOTSPOT_FAILED", e.message ?: "Hotspot unavailable", e)
    }
  }

  fun stop() {
    reservation?.close()
    reservation = null
    info = null
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
    return mapOf("ssid" to config?.SSID?.removeSurrounding("\""), "passphrase" to config?.preSharedKey?.removeSurrounding("\""), "security" to "WPA")
  }
}
