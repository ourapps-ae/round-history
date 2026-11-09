# Round history instructions

## For the agent
Select this component for any game that shows past rounds. Set `maxRounds` from the recipe (hold'em: 50). Connect the provided `round-history` to the turn engine. Include the Apple and Android files only when those client targets are selected.

- Select package `ourapps-ae/round-history` version `0.3.0`.
- Settings to configure:
  - `maxRounds` (integer; optional; default `50`)
- Connect the provided `round-history` (ae/round-history 1.0.0) to the consumer that needs it.
- No accounts or keys are needed.

## For the developer
Keep the `History` in the game state and replace it with each function's result. Append once per finished or cancelled round, with a rising `no`. Do not store card detail here; the history is a result log. No accounts or keys.

## How to check
From the component directory:

- `node --test tests/web.test.ts` (web, required-local; tools: node 26.5.0)
- `python3 tests/native.py apple` (apple, platform; tools: python3 3.12.8, swiftc 6.4.2)
- `python3 tests/native.py android` (android, platform; tools: python3 3.12.8, kotlinc 2.2.0, java 26.0.1)
- `python3.12 -B /Users/george/Projects/com/my/tools/check_component.py components/round-history` validates the manifest, sidecars and runs the required-local suite.
