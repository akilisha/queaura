package com.queaura.spike.server

import org.json.JSONObject
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter

/**
 * Append-only JSONL log of everything the spike measures. Every line is flushed as it is
 * written so a crash or a killed process keeps the evidence. Served at /log.jsonl.
 */
class EventLog(val file: File) {
  private val writer: BufferedWriter = BufferedWriter(FileWriter(file, true))

  @Synchronized
  fun write(event: String, fields: Map<String, Any?> = emptyMap()) {
    val line = JSONObject()
    line.put("ts", System.currentTimeMillis())
    line.put("ev", event)
    for ((k, v) in fields) line.put(k, v ?: JSONObject.NULL)
    writer.write(line.toString())
    writer.newLine()
    writer.flush()
  }

  @Synchronized
  fun close() {
    runCatching { writer.close() }
  }
}
