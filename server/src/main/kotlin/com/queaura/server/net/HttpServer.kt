package com.queaura.server.net

import fi.iki.elonen.NanoHTTPD

/** Serves the web client and /config.json (which port the WebSocket listens on). */
class HttpServer(port: Int, private val wsPort: Int, private val assets: AssetSource) : NanoHTTPD(port) {

  override fun serve(session: IHTTPSession): Response {
    val path = session.uri.trimStart('/')
    return when (path) {
      "config.json" -> newFixedLengthResponse(Response.Status.OK, "application/json", """{"wsPort":$wsPort}""").noStore()
      "" -> asset("index.html")
      else -> asset(path)
    }
  }

  private fun asset(path: String): Response {
    val stream = assets.open(path)
      ?: return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not found").noStore()
    val response = newChunkedResponse(Response.Status.OK, mimeOf(path), stream)
    // Vite fingerprints everything under assets/, so those can be cached forever; the page itself never.
    if (path.startsWith("assets/")) response.addHeader("Cache-Control", "public, max-age=31536000, immutable")
    else response.noStore()
    return response
  }

  private fun Response.noStore() = apply { addHeader("Cache-Control", "no-store") }

  private fun mimeOf(path: String) = when (path.substringAfterLast('.', "").lowercase()) {
    "html" -> "text/html; charset=utf-8"
    "js", "mjs" -> "application/javascript; charset=utf-8"
    "css" -> "text/css; charset=utf-8"
    "json" -> "application/json"
    "svg" -> "image/svg+xml"
    "png" -> "image/png"
    "ico" -> "image/x-icon"
    "woff2" -> "font/woff2"
    else -> "application/octet-stream"
  }
}
