import Foundation

let data = try Data(contentsOf: URL(fileURLWithPath: "tests/fixtures/rounds.json"))
let fixture = try JSONSerialization.jsonObject(with: data) as! [String: Any]
var checks = 0
func expect(_ condition: Bool, _ message: String) {
    if !condition { FileHandle.standardError.write(Data("FAIL \(message)\n".utf8)); exit(1) }
    checks += 1
}
struct Fixture: Decodable { let maxRounds: Int; let entries: [HistoryEntry] }
let decoded = try JSONDecoder().decode(Fixture.self, from: data)
expect(decoded.entries.count == 5, "decoded five entries")
expect(decoded.entries[2].voided && decoded.entries[2].winners.isEmpty, "voided entry")
var history = RoundHistory(maxRounds: decoded.maxRounds)
for entry in decoded.entries { history = history.appending(entry) }
expect(history.rounds.map(\.no) == (fixture["expectedKeptNumbers"] as! [Int]), "kept numbers")
let expected = fixture["expectedChipsWon"] as! [String: Int]
expect(history.chipsWon() == expected, "chips won \(history.chipsWon())")
expect(RoundHistory(maxRounds: 2, rounds: decoded.entries).rounds.map(\.no) == [4, 5], "init trims")
print("\(checks) round history assertions passed")
