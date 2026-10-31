package com.triviocity.server.net

import org.json.JSONObject
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter

/**
 * Append-only JSONL log of connections and game events, kept on the host device for diagnosing
 * usability sessions. Only the newest [KEEP] logs are kept.
 */
class EventLog(dir: File) {
  val file: File = File(dir, "session-${System.currentTimeMillis()}.jsonl")
  private val writer: BufferedWriter

  init {
    dir.mkdirs()
    dir.listFiles { f -> f.name.startsWith("session-") && f.name.endsWith(".jsonl") }
      ?.sortedByDescending { it.name }?.drop(KEEP - 1)?.forEach { it.delete() }
    writer = BufferedWriter(FileWriter(file, true))
  }

  @Synchronized
  fun write(event: String, fields: Map<String, Any?> = emptyMap()) {
    val line = JSONObject().put("ts", System.currentTimeMillis()).put("ev", event)
    for ((k, v) in fields) line.put(k, v ?: JSONObject.NULL)
    runCatching {
      writer.write(line.toString())
      writer.newLine()
      writer.flush()
    }
  }

  @Synchronized
  fun close() {
    runCatching { writer.close() }
  }

  private companion object {
    const val KEEP = 10
  }
}
