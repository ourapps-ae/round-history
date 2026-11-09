// A bounded record of rounds and their results: oldest rounds fall off the end. No game knowledge.
import { createHash } from "node:crypto";

export type Winner = { playerId: string; amount: number };

// `level` is the stage the round was played at (a blind level in the recipe); a voided round has no winners.
// `extra` holds any other facts a game keeps about a round (plain JSON); `push` and `list` flatten it into the entry.
export type RoundEntry = { no: number; level: number; winners: Winner[]; voided: boolean; extra?: { [field: string]: unknown } };

export type History = { maxRounds: number; rounds: RoundEntry[] };

export type HistorySettings = { maxRounds: number };

export const DEFAULT_SETTINGS: HistorySettings = { maxRounds: 50 };

const isWhole = (n: unknown, min: number): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= min;

export function validateSettings(settings: Partial<HistorySettings> = {}): HistorySettings {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  if (!isWhole(s.maxRounds, 1)) throw new RangeError("maxRounds must be a whole number of at least 1");
  return s;
}

// A history with the default or the given settings.
export function create(settings: Partial<HistorySettings> = {}): History {
  return { maxRounds: validateSettings(settings).maxRounds, rounds: [] };
}

export function checkEntry(entry: RoundEntry): RoundEntry {
  if (!isWhole(entry?.no, 1)) throw new RangeError("no must be a whole number from 1");
  if (!isWhole(entry.level, 1)) throw new RangeError("level must be a whole number from 1");
  if (typeof entry.voided !== "boolean") throw new TypeError("voided must be true or false");
  if (!Array.isArray(entry.winners)) throw new TypeError("winners must be a list");
  for (const w of entry.winners) {
    if (typeof w?.playerId !== "string" || w.playerId === "") throw new TypeError("a winner needs a playerId");
    if (!isWhole(w.amount, 0)) throw new RangeError("a winner's amount must be a whole number of 0 or more");
  }
  if (entry.voided && entry.winners.length > 0) throw new Error("a voided round has no winners");
  const checked: RoundEntry = { no: entry.no, level: entry.level, winners: entry.winners.map((w) => ({ playerId: w.playerId, amount: w.amount })), voided: entry.voided };
  if (entry.extra !== undefined) {
    if (typeof entry.extra !== "object" || entry.extra === null || Array.isArray(entry.extra) || !isJson(entry.extra)) throw new TypeError("extra must be a plain object of JSON values");
    if (Object.keys(entry.extra).length > 0) checked.extra = JSON.parse(JSON.stringify(entry.extra));
  }
  return checked;
}

function isJson(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) return Object.values(value as object).every(isJson);
  return false;
}

// Add a round, keeping only the newest `maxRounds`. Round numbers must rise. Returns a new history.
export function appendRound(history: History, entry: RoundEntry): History {
  const e = checkEntry(entry);
  const last = history.rounds.at(-1);
  if (last && e.no <= last.no) throw new Error(`round ${e.no} must come after round ${last.no}`);
  const rounds = [...history.rounds, e];
  return { maxRounds: history.maxRounds, rounds: rounds.length > history.maxRounds ? rounds.slice(rounds.length - history.maxRounds) : rounds };
}

// ---- the engine's view: plain objects in, plain objects out ----

const CORE = ["no", "level", "voided", "winners"];

// Add a round given as a plain object {no, level, voided, winners?, ...any other game fields}. `winners` defaults to
// none; the other fields are kept and come back from `list`. Round numbers must rise; the newest `maxRounds` are kept.
export function push(history: History, entry: Record<string, unknown>): History {
  const extra: { [field: string]: unknown } = {};
  for (const [key, value] of Object.entries(entry ?? {})) if (!CORE.includes(key)) extra[key] = value;
  return appendRound(history, { no: entry?.no as number, level: entry?.level as number, winners: (entry?.winners ?? []) as Winner[], voided: (entry?.voided ?? false) as boolean, extra });
}

// Every round held, oldest first, as plain objects {no, level, voided, winners, ...game fields}.
export function list(history: History): Record<string, unknown>[] {
  return history.rounds.map((r) => ({ no: r.no, level: r.level, voided: r.voided, winners: r.winners.map((w) => ({ ...w })), ...structuredClone(r.extra ?? {}) }));
}

// The same three operations with `maxRounds` bound, for a caller that wants one object.
export function createHistoryApi(settings: Partial<HistorySettings> = {}) {
  const bound = validateSettings(settings);
  return { settings: bound, create: () => create(bound), push, list };
}

export function appendVoided(history: History, no: number, level: number): History {
  return appendRound(history, { no, level, winners: [], voided: true });
}

export function clearHistory(history: History): History {
  return { maxRounds: history.maxRounds, rounds: [] };
}

// The newest `count` rounds, oldest first.
export function recentRounds(history: History, count: number): RoundEntry[] {
  if (!isWhole(count, 0)) throw new RangeError("count must be a whole number of 0 or more");
  return count === 0 ? [] : history.rounds.slice(-count);
}

export function findRound(history: History, no: number): RoundEntry | null {
  return history.rounds.find((r) => r.no === no) ?? null;
}

// Chips won and rounds won per player over the rounds still held (voided rounds count for nothing).
export function totalsByPlayer(history: History): Record<string, { won: number; rounds: number }> {
  const totals: Record<string, { won: number; rounds: number }> = {};
  for (const round of history.rounds) {
    if (round.voided) continue;
    const perPlayer = new Map<string, number>();
    for (const w of round.winners) perPlayer.set(w.playerId, (perPlayer.get(w.playerId) ?? 0) + w.amount);
    for (const [id, amount] of perPlayer) {
      const t = (totals[id] ??= { won: 0, rounds: 0 });
      t.won += amount;
      t.rounds += 1;
    }
  }
  return totals;
}

// ---- portable export and import (ndjson, one record per line, sha256 of each record) ----

const digest = (record: unknown) => createHash("sha256").update(JSON.stringify(record)).digest("hex");

export function exportRounds(history: History): string {
  const lines = [{ kind: "history", record: { maxRounds: history.maxRounds } }, ...history.rounds.map((r) => ({ kind: "round", record: r }))];
  return lines.map((l) => JSON.stringify({ ...l, sha256: digest(l.record) })).join("\n") + "\n";
}

// Read an export. A file holding more rounds than `maxRounds` (given here or in the file) keeps the newest.
export function importRounds(text: string, settings: Partial<HistorySettings> = {}): History {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  let history: History | null = null;
  const rows: RoundEntry[] = [];
  for (const [index, line] of lines.entries()) {
    const row = JSON.parse(line) as { kind: string; record: unknown; sha256: string };
    if (digest(row.record) !== row.sha256) throw new Error(`line ${index + 1}: checksum does not match`);
    if (row.kind === "history" && index === 0) history = create({ maxRounds: (row.record as HistorySettings).maxRounds, ...settings });
    else if (row.kind === "round" && history) rows.push(row.record as RoundEntry);
    else throw new Error(`line ${index + 1}: unexpected record ${row.kind}`);
  }
  if (!history) throw new Error("no history record");
  return rows.reduce(appendRound, history);
}
