package com.triviocity.server

import com.triviocity.server.net.DirectoryAssetSource
import com.triviocity.server.net.GameServer
import com.triviocity.server.net.lanAddresses
import java.io.File

/** Desktop entry point: serves [args]`[0]` (the built web client) and prints the host key. */
fun main(args: Array<String>) {
  val server = GameServer(8080, 8090, DirectoryAssetSource(File(args.getOrElse(0) { "../web/dist" })), File("build/logs"))
  server.start()
  println("Players: http://localhost:8080  ${lanAddresses().joinToString { "http://${it.ip}:8080" }}")
  println("HOST_KEY=${server.hostKey}")
  Thread.currentThread().join()
}
