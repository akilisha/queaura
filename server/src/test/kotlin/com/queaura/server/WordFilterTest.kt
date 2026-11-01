package com.queaura.server

import com.queaura.server.moderation.WordFilter
import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class WordFilterTest {
  private val filter = WordFilter.english

  private val cases = JSONObject(javaClass.getResource("/moderation-cases.json")!!.readText())

  @Test
  fun `catches words, phrases and the usual disguises`() {
    val blocked = cases.getJSONArray("blocked")
    for (i in 0 until blocked.length()) assertNotNull(filter.find(blocked.getString(i)), blocked.getString(i))
    val found = cases.getJSONObject("found")
    for (text in found.keys()) assertEquals(found.getString(text), filter.find(text))
  }

  @Test
  fun `passes ordinary trivia`() {
    val clean = cases.getJSONArray("clean")
    for (i in 0 until clean.length()) assertNull(filter.find(clean.getString(i)), clean.getString(i))
  }

  @Test
  fun `every starter question and game passes`() {
    val starter = JSONObject(File("../app/src/starter/starter.json").readText())
    val texts = mutableListOf<String>()
    val questions = starter.getJSONArray("questions")
    for (i in 0 until questions.length()) {
      val q = questions.getJSONObject(i)
      texts += q.getString("text")
      texts += q.optString("explanation")
      q.optJSONArray("choices")?.let { c -> for (j in 0 until c.length()) texts += c.getJSONObject(j).getString("text") }
    }
    val games = starter.getJSONArray("games")
    for (i in 0 until games.length()) texts += games.getJSONObject(i).getString("title")
    for (text in texts) assertNull(filter.find(text), text)
  }
}
