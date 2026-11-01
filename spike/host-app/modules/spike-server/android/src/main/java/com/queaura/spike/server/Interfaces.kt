package com.queaura.spike.server

import java.net.Inet4Address
import java.net.NetworkInterface

data class LanAddress(val name: String, val ip: String, val kind: String)

/** IPv4 addresses players could reach the host on. Cellular interfaces are excluded. */
fun lanAddresses(): List<LanAddress> {
  val result = mutableListOf<LanAddress>()
  val interfaces = runCatching { NetworkInterface.getNetworkInterfaces()?.toList() }.getOrNull() ?: return result
  for (nif in interfaces) {
    if (!nif.isUp || nif.isLoopback) continue
    val kind = kindOf(nif.name)
    if (kind == "cellular") continue
    for (addr in nif.inetAddresses.toList()) {
      if (addr is Inet4Address && !addr.isLoopbackAddress) result.add(LanAddress(nif.name, addr.hostAddress ?: continue, kind))
    }
  }
  // Hotspot first: when the host runs a hotspot, that is the network players are on.
  return result.sortedBy { if (it.kind == "hotspot") 0 else if (it.kind == "wifi") 1 else 2 }
}

private fun kindOf(name: String): String = when {
  name.startsWith("rmnet") || name.startsWith("ccmni") || name.startsWith("pdp") -> "cellular"
  name.startsWith("swlan") || name.startsWith("ap") || name.startsWith("softap") || name == "wlan1" -> "hotspot"
  name.startsWith("wlan") -> "wifi"
  else -> "other"
}
