package com.queaura.server.moderation

import java.text.Normalizer
import java.util.Locale

/**
 * The on-device moderation tier (spec §9): an openly licensed English word list. Matching is by
 * whole word or phrase, so "Scunthorpe" and "cocktail" pass, after undoing the usual tricks:
 * case, accents, digits for letters ("sh1t"), stretched letters ("fuuuck") and spaced letters
 * ("f.u.c.k"). A few unambiguous roots also match inside words. It will miss things; Kick and
 * Skip are the human backstops.
 */
class WordFilter(blocked: List<String>, excluded: Set<String>, private val roots: List<String>) {
  private val words = HashSet<String>()
  private val phrases = ArrayList<List<String>>()
  /** Entries with no letters or digits, like an emoji, matched anywhere in the text. */
  private val symbols = ArrayList<String>()

  init {
    val skip = excluded.map { it.lowercase(Locale.ROOT) }.toSet()
    for (raw in blocked) {
      val entry = raw.trim().lowercase(Locale.ROOT)
      if (entry.isEmpty() || entry in skip) continue
      val t = tokens(entry)
      when {
        t.isEmpty() -> symbols += entry
        t.size == 1 -> words += t[0]
        else -> phrases += t
      }
    }
  }

  /** The first blocked word or phrase in [text], or null if it is clean. */
  fun find(text: String): String? {
    symbols.firstOrNull { text.contains(it) }?.let { return it }
    val toks = tokens(text).map { variants(it) }
    for (vs in toks) {
      vs.firstOrNull { it in words }?.let { return it }
      for (v in vs) roots.firstOrNull { v.contains(it) }?.let { return it }
    }
    for (phrase in phrases) {
      for (start in 0..toks.size - phrase.size) {
        if (phrase.indices.all { phrase[it] in toks[start + it] }) return phrase.joinToString(" ")
      }
    }
    return null
  }

  companion object {
    /** The shipped list with our exclusions (resources/moderation, see its README). */
    val english: WordFilter by lazy {
      WordFilter(lines("en.txt"), lines("exclusions.txt").toSet(), lines("roots.txt"))
    }

    private fun lines(name: String): List<String> {
      val stream = WordFilter::class.java.getResourceAsStream("/moderation/$name") ?: error("Missing moderation/$name")
      return stream.bufferedReader(Charsets.UTF_8).readLines()
        .map { it.substringBefore('#').trim() }
        .filter { it.isNotEmpty() }
    }

    private val LEET = mapOf('0' to 'o', '1' to 'i', '3' to 'e', '4' to 'a', '5' to 's', '7' to 't', '8' to 'b', '@' to 'a', '$' to 's')

    /**
     * Lowercase words without accents. Letters typed one at a time with gaps ("f u c k",
     * "f.u.c.k") are joined back into one word.
     */
    internal fun tokens(text: String): List<String> {
      val plain = Normalizer.normalize(text, Normalizer.Form.NFKD).replace(Regex("\\p{M}+"), "").lowercase(Locale.ROOT)
      val raw = Regex("[\\p{L}\\p{N}@$]+").findAll(plain).map { it.value }.toList()
      val out = ArrayList<String>()
      var letters = StringBuilder()
      for (t in raw) {
        if (t.length == 1 && t[0].isLetter()) {
          letters.append(t)
          continue
        }
        if (letters.isNotEmpty()) out += letters.toString().also { letters = StringBuilder() }
        out += t
      }
      if (letters.isNotEmpty()) out += letters.toString()
      return out
    }

    /** The word as typed, with digits read as letters, and with stretched letters shortened. */
    private fun variants(token: String): Set<String> {
      val base = mutableSetOf(token)
      if (token.any { it.isLetter() } && token.any { it in LEET }) base += token.map { LEET[it] ?: it }.joinToString("")
      val out = HashSet<String>()
      for (b in base) {
        out += b
        out += b.replace(Regex("(.)\\1{2,}"), "$1")
        out += b.replace(Regex("(.)\\1{2,}"), "$1$1")
      }
      return out
    }
  }
}
