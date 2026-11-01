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

  @Test
  fun `catches words, phrases and the usual disguises`() {
    for (text in listOf("fuck you", "What the SHIT", "Sh1t happens", "a55hole", "fuuuuck", "f.u.c.k", "F U C K", "fuckface", "big tits", "Big   Tits!", "Shït", "🖕")) {
      assertNotNull(filter.find(text), text)
    }
    assertEquals("asshole", filter.find("You a55hole"))
  }

  @Test
  fun `passes ordinary trivia`() {
    val clean = listOf(
      "Who wrote Moby Dick?", "Scunthorpe United", "Cassandra", "Which bird is a blue tit?", "Ford Escort",
      "Super Bowl XXX", "Which Bond film is Octopussy?", "Apollo 11", "Push it", "Uranus", "The Girl on the Train",
      "shiitake", "Hitchcock", "a cocktail", "class assessment", "How many chromosomes? XX or XY", "Rio Negro",
      "What is 3 + 4?", "Skeet shooting", "Alan Cumming", "Barenaked Ladies", "Sexual reproduction in plants",
    )
    for (text in clean) assertNull(filter.find(text), text)
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
