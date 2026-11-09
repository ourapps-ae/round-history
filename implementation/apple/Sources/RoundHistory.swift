import Foundation

// A round's result as the server sends it in the view's `history` list.
public struct HistoryWinner: Decodable, Hashable {
    public let playerId: String
    public let amount: Int
    public init(playerId: String, amount: Int) { self.playerId = playerId; self.amount = amount }
}

public struct HistoryEntry: Decodable, Hashable {
    public let no: Int
    // The stage the round was played at (a blind level in OurPoker).
    public let level: Int
    public let winners: [HistoryWinner]
    public let voided: Bool
    public init(no: Int, level: Int, winners: [HistoryWinner], voided: Bool) {
        self.no = no; self.level = level; self.winners = winners; self.voided = voided
    }
}

// Bounded list of rounds, newest last, same rule as the server: the oldest fall off.
public struct RoundHistory: Equatable {
    public let maxRounds: Int
    public private(set) var rounds: [HistoryEntry]

    public init(maxRounds: Int = 50, rounds: [HistoryEntry] = []) {
        precondition(maxRounds >= 1, "maxRounds must be at least 1")
        self.maxRounds = maxRounds
        self.rounds = Array(rounds.suffix(maxRounds))
    }

    public func appending(_ entry: HistoryEntry) -> RoundHistory {
        RoundHistory(maxRounds: maxRounds, rounds: rounds + [entry])
    }

    // Chips won per player over the rounds held; voided rounds count for nothing.
    public func chipsWon() -> [String: Int] {
        var totals: [String: Int] = [:]
        for round in rounds where !round.voided {
            for w in round.winners { totals[w.playerId, default: 0] += w.amount }
        }
        return totals
    }
}
