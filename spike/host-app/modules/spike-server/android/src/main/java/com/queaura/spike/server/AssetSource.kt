package com.queaura.spike.server

import java.io.File
import java.io.InputStream

/** Where the built Preact bundle comes from: Android assets on device, a folder on a desktop JVM. */
fun interface AssetSource {
  /** Returns the asset at [path] (no leading slash), or null if it does not exist. */
  fun open(path: String): InputStream?
}

class DirectoryAssetSource(private val root: File) : AssetSource {
  override fun open(path: String): InputStream? {
    val file = File(root, path).canonicalFile
    if (!file.path.startsWith(root.canonicalPath) || !file.isFile) return null
    return file.inputStream()
  }
}
