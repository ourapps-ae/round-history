import {appendRound, appendVoided, create, totalsByPlayer, type History} from "../implementation/server/history.ts";

// A game records each finished round; a cancelled round is recorded as voided.
export function recordSession(): History {
  let history = create({maxRounds: 3});
  history = appendRound(history, {no: 1, level: 1, winners: [{playerId: "ann", amount: 120}], voided: false});
  history = appendRound(history, {no: 2, level: 1, winners: [{playerId: "bo", amount: 80}, {playerId: "ann", amount: 20}], voided: false});
  history = appendVoided(history, 3, 2);
  history = appendRound(history, {no: 4, level: 2, winners: [{playerId: "ann", amount: 300}], voided: false});
  return history;
}

export const leaderboard = (history: History) => Object.entries(totalsByPlayer(history)).sort((a, b) => b[1].won - a[1].won);
