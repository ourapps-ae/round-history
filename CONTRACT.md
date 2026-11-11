# Round history component

## Purpose and facilities
Players want to see how the last rounds went. This component keeps a list of rounds, each `{no, level, winners: [{playerId, amount}], voided}`, bounded to the newest `maxRounds` (the oldest fall off). A cancelled round is recorded as voided with no winners. It answers who won how much over the rounds held, finds a round by number, and exports and imports the list as ndjson with a checksum per line. It knows nothing about the game: `level` is simply the stage the round was played at. A game that records its own fields beside the result (the pot, the showdown kind) pushes a plain object and gets the same object back from `list`.

Facilities: `round-history` (Append rounds, keep the newest N, query and export them).

## User inputs
The installer collects one setting: `maxRounds`, how many rounds to keep (whole number, at least 1; default 50, as in the recipe).

- `maxRounds` (integer; optional; default `50`)

## Artefacts and dependencies
`component.json` maps every `implementation/` source into `components/round-history/`:

- `implementation/android/src/main/java/ae/history/RoundHistory.kt` -> `components/round-history/android/src/main/java/ae/history/RoundHistory.kt`
- `implementation/apple/Sources/RoundHistory.swift` -> `components/round-history/apple/Sources/RoundHistory.swift`
- `implementation/server/history.ts` -> `components/round-history/server/history.ts`

Dependencies: none.
`tools.lock.json` pins verification tools: node 26.5, python3 3.12, swiftc 6.4, kotlinc 2.2, java 26.0. Licence: `Apache-2.0` (`LICENCE`, `NOTICE`).

## Provided interfaces
- `interfaces/round-history.json` defines `round-history` (ae/round-history) version 1.0.0: an OpenRPC 1.3.2 document, one method per function (a member of a created object is `<Type>.<member>`), with parameter, result and data types as JSON Schema 2020-12 (`components.schemas`) and thrown errors under `errors`.
- `interfaces/round.schema.json` (ae/round-history-records 1.0.0) is a JSON Schema 2020-12 document of one line of the ndjson export.

## Required interfaces
None.

## Integration
The server appends an entry when a round ends (the recipe does this where a hand is settled and where a hand is cancelled) and puts `history.rounds` in the view it sends. Round numbers must rise within one history, so a new game starts a new history with `clearHistory`. Apple and Android clients use `HistoryEntry` to read the list from the view and `RoundHistory` to keep a bounded copy; the Apple type is `Decodable` like the recipe's, the Kotlin classes are plain data classes to which `@Serializable` is added where the wire format is decoded. `turn-engine` requires this interface. The engine form is `create()`, `push(history, {no, level, voided, ...game fields})` and `list(history)` (oldest first); `createHistoryApi({maxRounds})` binds the setting. Game fields are kept in `extra` and must be plain JSON; Apple and Android read the four typed fields and ignore `extra`.

## Visual definition and connected examples
`visual/definition.json` maps its ports to the provided and required interfaces. `visual/examples/connected.json` connects the component to an illustrative application consumer. Both image formats and a text description are retained under `visual/output/`.

## Infrastructure
No deployed service and no accounts. The history is plain data kept in the game state; export and import move it between hosts.

## Verification
`tests/web.test.ts` (required-local) checks bounds, validation, rising round numbers, voided rounds, totals, queries, ndjson round trip with a tampered line rejected, the engine form (create, push, list with game fields, rising numbers, plain-JSON check, copies, export and import with game fields) and the consumer example. `tests/native.py apple` compiles `RoundHistory.swift` with swiftc, decodes `tests/fixtures/rounds.json` as JSON and checks the bound and totals (run and passed on this machine). `tests/native.py android` does the same with kotlinc; kotlinc is not installed here, so it was written but not run.

- `node --test tests/web.test.ts` (web, required-local; tools: node 26.5)
- `python3 tests/native.py apple` (apple, platform; tools: python3 3.12, swiftc 6.4)
- `python3 tests/native.py android` (android, platform; tools: python3 3.12, kotlinc 2.2, java 26.0)

## Scenarios and presentation
A hold'em tournament shows the last 50 hands. A short party game keeps 10 rounds. A support engineer exports the history of a disputed game. A new game clears the list.

## Updates and removal
Patch updates replace the files only. The ndjson record layout is in `interfaces/round.schema.json` and `migration.json`. After removal, exported files are described by the schema.
