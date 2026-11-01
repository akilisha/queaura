package com.queaura.server.net

import java.net.Inet4Address
import java.net.NetworkInterface

data class LanAddress(val name: String, val ip: String, val kind: String)

/** IPv4 addresses players could reach the host on, hotspot first. Cellular is excluded. */
fun lanAddresses(): List<LanAddress> {
  val interfaces = runCatching { NetworkInterface.getNetworkInterfaces()?.toList() }.getOrNull() ?: return emptyList()
  val result = mutableListOf<LanAddress>()
  for (nif in interfaces) {
    if (!nif.isUp || nif.isLoopback) continue
    val kind = kindOf(nif.name)
    if (kind == "cellular") continue
    for (addr in nif.inetAddresses.toList()) {
      if (addr is Inet4Address && !addr.isLoopbackAddress) result.add(LanAddress(nif.name, addr.hostAddress ?: continue, kind))
    }
  }
  return result.sortedBy { if (it.kind == "hotspot") 0 else if (it.kind == "wifi") 1 else 2 }
}

private fun kindOf(name: String): String = when {
  name.startsWith("rmnet") || name.startsWith("ccmni") || name.startsWith("pdp") -> "cellular"
  name.startsWith("swlan") || name.startsWith("ap") || name.startsWith("softap") || name == "wlan1" -> "hotspot"
  name.startsWith("wlan") -> "wifi"
  else -> "other"
}
