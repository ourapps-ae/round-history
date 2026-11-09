import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {appendRound, appendVoided, checkEntry, clearHistory, create, createHistoryApi, list, push, exportRounds, findRound, importRounds, recentRounds, totalsByPlayer, validateSettings, type RoundEntry} from "../implementation/server/history.ts";
import {leaderboard, recordSession} from "../examples/consumer.ts";

const text = readFileSync(new URL("fixtures/rounds.json", import.meta.url), "utf8");
const fixture = JSON.parse(text) as {maxRounds: number; entries: RoundEntry[]; expectedKeptNumbers: number[]; expectedChipsWon: Record<string, number>};

function filled() {
  let h = create({maxRounds: fixture.maxRounds});
  for (const e of fixture.entries) h = appendRound(h, e);
  return h;
}

test("settings default to the recipe's 50 and reject nonsense", () => {
  assert.equal(create().maxRounds, 50);
  assert.equal(validateSettings({maxRounds: 1}).maxRounds, 1);
  for (const bad of [0, -3, 2.5, NaN]) assert.throws(() => validateSettings({maxRounds: bad}), RangeError);
});

test("only the newest maxRounds are kept, oldest dropped first, and the input history is unchanged", () => {
  const h = filled();
  assert.deepEqual(h.rounds.map((r) => r.no), fixture.expectedKeptNumbers);
  const before = create({maxRounds: 2});
  const after = appendRound(before, fixture.entries[0]);
  assert.equal(before.rounds.length, 0);
  assert.equal(after.rounds.length, 1);
  let big = create();
  for (let no = 1; no <= 120; no++) big = appendRound(big, {no, level: 1, winners: [], voided: true});
  assert.equal(big.rounds.length, 50);
  assert.equal(big.rounds[0].no, 71);
});

test("entries are checked", () => {
  const ok: RoundEntry = {no: 1, level: 1, winners: [{playerId: "a", amount: 5}], voided: false};
  assert.deepEqual(checkEntry(ok), ok);
  const bad: [Partial<RoundEntry>, RegExp][] = [
    [{no: 0}, /no must/], [{level: 0}, /level must/], [{voided: "no" as never}, /voided/], [{winners: "a" as never}, /list/],
    [{winners: [{playerId: "", amount: 1}]}, /playerId/], [{winners: [{playerId: "a", amount: -1}]}, /amount/], [{winners: [{playerId: "a", amount: 1.5}]}, /amount/],
    [{voided: true}, /voided round has no winners/],
  ];
  for (const [change, message] of bad) assert.throws(() => checkEntry({...ok, ...change}), message);
});

test("round numbers must rise", () => {
  const h = appendRound(create(), {no: 5, level: 1, winners: [], voided: true});
  assert.throws(() => appendRound(h, {no: 5, level: 1, winners: [], voided: true}), /must come after round 5/);
  assert.throws(() => appendRound(h, {no: 4, level: 1, winners: [], voided: true}), /must come after/);
  assert.equal(appendRound(h, {no: 6, level: 1, winners: [], voided: true}).rounds.length, 2);
});

test("voided rounds are recorded but count for nothing", () => {
  const h = filled();
  assert.equal(findRound(h, 3)!.voided, true);
  assert.deepEqual(totalsByPlayer(h), {a: {won: 450, rounds: 1}, c: {won: 1000, rounds: 1}});
  assert.deepEqual(Object.fromEntries(Object.entries(totalsByPlayer(h)).map(([k, v]) => [k, v.won])), fixture.expectedChipsWon);
  assert.equal(findRound(h, 1), null);
  assert.equal(appendVoided(create(), 1, 3).rounds[0].level, 3);
});

test("recent rounds and clearing", () => {
  const h = filled();
  assert.deepEqual(recentRounds(h, 2).map((r) => r.no), [4, 5]);
  assert.deepEqual(recentRounds(h, 0), []);
  assert.equal(recentRounds(h, 10).length, 3);
  assert.throws(() => recentRounds(h, -1), RangeError);
  const cleared = clearHistory(h);
  assert.equal(cleared.rounds.length, 0);
  assert.equal(cleared.maxRounds, 3);
});

test("ndjson export and import round trip with checksums", () => {
  const h = filled();
  const out = exportRounds(h);
  assert.equal(out.trim().split("\n").length, 4);
  assert.deepEqual(importRounds(out), h);
  assert.deepEqual(importRounds(out, {maxRounds: 2}).rounds.map((r) => r.no), [4, 5]);
  assert.throws(() => importRounds(out.replace('"amount":1000', '"amount":9999')), /checksum/);
  assert.throws(() => importRounds(out.split("\n").slice(1).join("\n")), /unexpected record|no history/);
  assert.throws(() => importRounds(""), /no history/);
});

test("the consumer example keeps three rounds and ranks winners", () => {
  const h = recordSession();
  assert.deepEqual(h.rounds.map((r) => r.no), [2, 3, 4]);
  assert.deepEqual(leaderboard(h).map(([id, t]) => [id, t.won]), [["ann", 320], ["bo", 80]]);
});

test("create, push and list: plain objects with any game fields in, the same objects out, oldest first", () => {
  let h = create();
  assert.deepEqual(list(h), []);
  h = push(h, {no: 1, level: 1, voided: false, winners: [{playerId: "a", amount: 70}], pot: 70, showdown: {kind: "kicker", hands: ["Pair of aces"]}});
  h = push(h, {no: 2, level: 1, voided: true});
  assert.deepEqual(list(h), [
    {no: 1, level: 1, voided: false, winners: [{playerId: "a", amount: 70}], pot: 70, showdown: {kind: "kicker", hands: ["Pair of aces"]}},
    {no: 2, level: 1, voided: true, winners: []},
  ]);
  assert.equal(h.rounds[1].extra, undefined, "no game fields: nothing extra stored");
});

test("push keeps the history rules: numbers must rise, the oldest fall off, and the input is unchanged", () => {
  const h0 = create({maxRounds: 2});
  let h = push(h0, {no: 1, level: 1, voided: false, winners: [], note: "x"});
  assert.equal(h0.rounds.length, 0);
  h = push(push(h, {no: 2, level: 1, voided: false}), {no: 3, level: 2, voided: false});
  assert.deepEqual(list(h).map((r) => r.no), [2, 3]);
  assert.throws(() => push(h, {no: 3, level: 2, voided: false}), /must come after/);
  assert.throws(() => push(h, {no: 4, level: 0, voided: false}), /level must/);
  assert.throws(() => push(h, {level: 1, voided: false}), /no must/);
  assert.throws(() => push(h, {no: 4, level: 1, voided: true, winners: [{playerId: "a", amount: 1}]}), /voided round has no winners/);
  assert.throws(() => push(h, {no: 4, level: 1, voided: "no"}), /voided/);
});

test("game fields must be plain JSON and listed copies cannot change the history", () => {
  const h = create();
  for (const bad of [() => 1, undefined, new Date(0), NaN, Symbol("x")]) assert.throws(() => push(h, {no: 1, level: 1, voided: false, field: bad}), TypeError, String(bad));
  assert.throws(() => checkEntry({no: 1, level: 1, voided: false, winners: [], extra: [1] as never}), TypeError);
  const kept = push(h, {no: 1, level: 1, voided: false, winners: [{playerId: "a", amount: 5}], nested: {a: [1, 2]}});
  const out = list(kept);
  (out[0].nested as {a: number[]}).a.push(3);
  (out[0].winners as {amount: number}[])[0].amount = 99;
  assert.deepEqual(list(kept)[0].nested, {a: [1, 2]});
  assert.equal(list(kept)[0].winners instanceof Array && (list(kept)[0].winners as {amount: number}[])[0].amount, 5);
});

test("game fields survive export and import, and the totals still read the winners", () => {
  const h = push(push(create({maxRounds: 5}), {no: 1, level: 1, voided: false, winners: [{playerId: "a", amount: 40}], pot: 40}), {no: 2, level: 1, voided: false, winners: [{playerId: "b", amount: 10}]});
  const back = importRounds(exportRounds(h));
  assert.deepEqual(back, h);
  assert.deepEqual(list(back)[0].pot, 40);
  assert.deepEqual(Object.fromEntries(Object.entries(totalsByPlayer(back)).map(([k, v]) => [k, v.won])), {a: 40, b: 10});
  assert.throws(() => importRounds(exportRounds(h).replace('"pot":40', '"pot":41')), /checksum/);
});

test("createHistoryApi binds maxRounds for the engine's create", () => {
  const api = createHistoryApi({maxRounds: 2});
  let h = api.create();
  for (let no = 1; no <= 4; no++) h = api.push(h, {no, level: 1, voided: true});
  assert.deepEqual(api.list(h).map((r) => r.no), [3, 4]);
  assert.equal(api.settings.maxRounds, 2);
  assert.throws(() => createHistoryApi({maxRounds: 0}), RangeError);
});
