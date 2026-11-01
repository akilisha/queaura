package com.queaura.spike.server

import fi.iki.elonen.NanoHTTPD

/**
 * NanoHTTPD serves the Preact bundle plus three spike endpoints:
 * /config.json (where the WebSocket listens), /stats.json (live summary), /log.jsonl (raw evidence).
 */
class HttpServer(
  port: Int,
  private val wsPort: Int,
  private val assets: AssetSource,
  private val log: EventLog,
  private val stats: () -> String,
) : NanoHTTPD(port) {

  override fun serve(session: IHTTPSession): Response {
    val path = session.uri.trimStart('/')
    return when (path) {
      "config.json" -> json("""{"wsPort":$wsPort}""")
      "stats.json" -> json(runCatching(stats).getOrElse { """{"error":"${it.javaClass.simpleName}"}""" })
      "log.jsonl" -> newChunkedResponse(Response.Status.OK, "application/x-ndjson", log.file.inputStream())
        .noStore()
      "", "index.html" -> {
        log.write("page_load", mapOf("remote" to session.remoteIpAddress, "query" to session.queryParameterString))
        asset("index.html")
      }
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

  private fun json(body: String) = newFixedLengthResponse(Response.Status.OK, "application/json", body).noStore()

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
