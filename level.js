import { generateLevel } from './generator.js';

export let level = null;
export let levelNumber = 1;

const MAX_LEVEL = 999;
const LEVEL_KEY = 'slovograi.currentLevel';
const USED_KEY = 'slovograi.usedByLen';
const RECENT_WORDS_LIMIT = 30;

let LAST_LEVEL_WORDS = new Set();
let RECENT_WORDS = [];
let WORDS_BY_LEN = new Map();
let HARD_BY_LEN = new Map();
let USED_BY_LEN = new Map();
let levelCache = new Map();
let loaded = false;

function saveUsedByLen() {
  try {
    const obj = {};
    for (const [len, set] of USED_BY_LEN) obj[len] = [...set];
    localStorage.setItem(USED_KEY, JSON.stringify(obj));
  } catch {}
}

function loadUsedByLen() {
  try {
    const raw = localStorage.getItem(USED_KEY);
    if (!raw) return;
    for (const [len, arr] of Object.entries(JSON.parse(raw)))
      USED_BY_LEN.set(Number(len), new Set(arr));
  } catch {}
}

function buildLenIndex(arr) {
  const m = new Map();
  for (const w of arr) {
    const a = m.get(w.length) || [];
    a.push(w);
    m.set(w.length, a);
  }
  return m;
}

function hardCountForLevel(n, total) {
  if (n <= 9) return 0;
  const pct = 0.60 * Math.max(0, Math.min(1, (n - 10) / 90));
  return Math.max(1, Math.min(total, Math.round(total * pct)));
}

function isBanned(w) {
  return LAST_LEVEL_WORDS.has(w) || RECENT_WORDS.includes(w);
}

function gridSizeForLevel(n) {
  if (n <= 14) return 5;
  if (n <= 26) return 6;
  if (n <= 38) return 7;
  if (n <= 50) return 8;
  if (n <= 62) return 9;
  return 10;
}

async function fetchWordList(url) {
  try {
    const data = await (await fetch(url)).json();
    const arr = Array.isArray(data) ? data : (data.words || []);
    return arr
      .map(w => String(w || '').trim().toUpperCase())
      .filter(w => w && /^[А-ЯІЇЄҐ'']+$/.test(w) && w.length >= 2);
  } catch { return []; }
}

function pickWord(pool, used, len) {
  let usedLen = USED_BY_LEN.get(len);
  if (!usedLen) { usedLen = new Set(); USED_BY_LEN.set(len, usedLen); }

  let candidates = pool.filter(w => !used.has(w) && !usedLen.has(w) && !isBanned(w));

  if (!candidates.length) {
    usedLen.clear();
    candidates = pool.filter(w => !used.has(w) && !usedLen.has(w));
  }
  if (!candidates.length) candidates = pool.filter(w => !used.has(w));
  if (!candidates.length) {
    console.warn('⚠️ no candidates for len', len);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const word = candidates[Math.floor(Math.random() * candidates.length)];
  used.add(word);
  usedLen.add(word);
  return word;
}

function buildLevel(n) {
  const safeN = Number.isFinite(n) ? n : 1;
  const size = gridSizeForLevel(safeN);
  const genLevel = Math.min(Math.max(1, safeN), 100);

  const gen = generateLevel({ cols: size, rows: size, levelNumber: genLevel });
  const lvl = {};
  const used = new Set();
  const hardNeed = hardCountForLevel(safeN, gen.targets.length);

  const hardIdx = new Set();
  for (let k = 0; k < hardNeed; k++)
    hardIdx.add(Math.floor((k * gen.targets.length) / hardNeed));

  const picked = gen.targets.map((t, idx) => {
    const pool = (hardIdx.has(idx) ? HARD_BY_LEN : WORDS_BY_LEN).get(t.path.length) || [];
    return pickWord(pool, used, t.path.length);
  });

  lvl.grid = gen.grid.slice();
  if (lvl.grid.length !== size * size) throw new Error('❌ Grid size mismatch');

  lvl.targets = gen.targets.map((t, idx) => {
    const word = picked[idx];
    if (!word) return null;

    let cells = t.path.slice();
    if (Math.random() < 0.5) cells = cells.reverse();
    cells.forEach((c, i) => { lvl.grid[c] = word[i]; });

    return { id: idx, length: word.length, path: cells, word, solved: false };
  }).filter(Boolean);

  lvl.number = n;
  lvl.size = size;
  lvl.cols = size;
  lvl.rows = size;

  LAST_LEVEL_WORDS = new Set(lvl.targets.map(t => t.word));
  RECENT_WORDS.push(...lvl.targets.map(t => t.word));
  if (RECENT_WORDS.length > RECENT_WORDS_LIMIT)
    RECENT_WORDS = RECENT_WORDS.slice(-RECENT_WORDS_LIMIT);

  levelCache.set(n, structuredClone(lvl));
  saveUsedByLen();

  const next = n + 1;
  if (!levelCache.has(next))
    setTimeout(() => { try { buildLevel(next); } catch {} }, 0);

  return lvl;
}

export async function initLevels() {
  if (!loaded) {
    const [words, hard] = await Promise.all([
      fetchWordList('./assets/dict/core.json'),
      fetchWordList('./assets/dict/hard.json')
    ]);
    WORDS_BY_LEN = buildLenIndex([...new Set(words)]);
    HARD_BY_LEN = buildLenIndex(hard);
    loadUsedByLen();
    loaded = true;
  }

  const saved = Number(localStorage.getItem(LEVEL_KEY));
  levelNumber = saved > 0 ? saved : 1;
  level = buildLevel(levelNumber);
  window.level = level;
  return level;
}

export function setLevelNumber(n) {
  const nn = Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(n) || 1)));
  levelNumber = nn;
  localStorage.setItem(LEVEL_KEY, String(nn));
  if (loaded) { level = buildLevel(nn); window.level = level; }
  return levelNumber;
}

export async function nextLevel() {
  if (!loaded) await initLevels();
  setLevelNumber(levelNumber + 1);
  window.level = level;
  return level;
}

export async function reloadLevel() {
  if (!loaded) await initLevels();
  const cached = levelCache.get(levelNumber);
  level = cached ? structuredClone(cached) : buildLevel(Math.min(levelNumber, 100));
  window.level = level;
  return level;
}
