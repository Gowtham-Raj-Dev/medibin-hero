// Player name and local leaderboard, kept in the browser's localStorage.
const PLAYER_KEY = 'medibin.player';
const SCORES_KEY = 'medibin.scores';
const MAX_PLAYERS = 50; // stored; the results screen shows the top few

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked — the game still works without it
  }
}

export function loadPlayer() {
  return read(PLAYER_KEY, { name: '', role: 'staff' });
}
export function savePlayer(player) {
  write(PLAYER_KEY, player);
}

// "Gowtham", "gowtham " and "GOWTHAM" are the same player.
const playerKey = (name) => String(name).trim().replace(/\s+/g, ' ').toLowerCase();

/** One row per player, keeping only that player's best score, highest first. */
function bestPerPlayer(list) {
  const best = new Map();
  for (const row of list) {
    if (!row || typeof row.name !== 'string' || typeof row.score !== 'number') continue;
    const key = playerKey(row.name);
    const current = best.get(key);
    if (!current || row.score > current.score) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || String(a.date).localeCompare(String(b.date)));
}

export function loadScores() {
  const list = read(SCORES_KEY, []);
  return Array.isArray(list) ? bestPerPlayer(list) : [];
}

/**
 * Records a finished game. A player keeps a single leaderboard row holding
 * their best score, so a lower score never adds a second row or replaces it.
 * Returns { scores, id, rank, best, previousBest, isPersonalBest }.
 */
export function saveScore(entry) {
  const key = playerKey(entry.name);
  const before = loadScores();
  const mine = before.find((row) => playerKey(row.name) === key);
  const previousBest = mine ? mine.score : 0;
  let scores = before;
  if (!mine || entry.score > mine.score) {
    const record = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: new Date().toISOString() };
    scores = bestPerPlayer([...before.filter((row) => row !== mine), record]).slice(0, MAX_PLAYERS);
  }
  write(SCORES_KEY, scores);
  const row = scores.find((r) => playerKey(r.name) === key);
  return {
    scores,
    id: row?.id,
    rank: row ? scores.indexOf(row) + 1 : 0,
    best: row ? row.score : entry.score,
    previousBest,
    isPersonalBest: entry.score > previousBest,
  };
}
