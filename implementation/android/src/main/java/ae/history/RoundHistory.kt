package ae.history

// A round's result as the server sends it in the view's `history` list. Add kotlinx.serialization's
// @Serializable to both classes when decoding the wire format directly (the recipe does).
data class HistoryWinner(val playerId: String, val amount: Int)

// `level` is the stage the round was played at (a blind level in OurPoker).
data class HistoryEntry(val no: Int, val level: Int, val winners: List<HistoryWinner>, val voided: Boolean)

// Bounded list of rounds, newest last, same rule as the server: the oldest fall off.
class RoundHistory(val maxRounds: Int = 50, rounds: List<HistoryEntry> = emptyList()) {
    val rounds: List<HistoryEntry>

    init {
        require(maxRounds >= 1) { "maxRounds must be at least 1" }
        this.rounds = rounds.takeLast(maxRounds)
    }

    fun appending(entry: HistoryEntry): RoundHistory = RoundHistory(maxRounds, rounds + entry)

    // Chips won per player over the rounds held; voided rounds count for nothing.
    fun chipsWon(): Map<String, Int> {
        val totals = mutableMapOf<String, Int>()
        for (round in rounds) {
            if (round.voided) continue
            for (w in round.winners) totals[w.playerId] = (totals[w.playerId] ?: 0) + w.amount
        }
        return totals
    }
}
