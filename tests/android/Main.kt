import ae.history.HistoryEntry
import ae.history.HistoryWinner
import ae.history.RoundHistory
import java.io.File

// The fixture keeps one entry per line, so a line pattern is enough to read it without a JSON library.
fun main() {
    var checks = 0
    fun verify(condition: Boolean, message: String) {
        check(condition) { "FAIL $message" }
        checks++
    }
    val entry = Regex("""^\{"no":(\d+),"level":(\d+),"winners":\[(.*)\],"voided":(true|false)\},?$""")
    val winner = Regex("""\{"playerId":"([^"]+)","amount":(\d+)\}""")
    val entries = File("tests/fixtures/rounds.json").readLines().mapNotNull { line ->
        entry.matchEntire(line)?.let { m ->
            HistoryEntry(m.groupValues[1].toInt(), m.groupValues[2].toInt(),
                winner.findAll(m.groupValues[3]).map { HistoryWinner(it.groupValues[1], it.groupValues[2].toInt()) }.toList(),
                m.groupValues[4] == "true")
        }
    }
    verify(entries.size == 5, "read five entries, got ${entries.size}")
    var history = RoundHistory(maxRounds = 3)
    for (e in entries) history = history.appending(e)
    verify(history.rounds.map { it.no } == listOf(3, 4, 5), "kept numbers")
    verify(history.chipsWon() == mapOf("a" to 450, "c" to 1000), "chips won ${history.chipsWon()}")
    verify(RoundHistory(maxRounds = 2, rounds = entries).rounds.map { it.no } == listOf(4, 5), "init trims")
    println("$checks round history assertions passed")
}
