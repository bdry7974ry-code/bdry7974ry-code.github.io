import { generateLevel } from './generator.js';
export let level = null;
let levelCache = new Map();

export let levelNumber = 1;

const MAX_LEVEL = 999;


const LEVEL_KEY = 'slovograi.currentLevel';

let LAST_LEVEL_WORDS = new Set();
let RECENT_WORDS = [];
const RECENT_WORDS_LIMIT = 400; 

let HARD_WORDS = [];
let WORDS_BY_LEN = new Map();
let HARD_BY_LEN = new Map();
let USED_BY_LEN = new Map();
function buildLenIndex(arr) {
  const m = new Map();
  for (const w of arr) {
    const L = w.length;
    let a = m.get(L);
    if (!a) { a = []; m.set(L, a); }
    a.push(w);
  }
  return m;
}


function hardCountForLevel(n, totalWords) {
  
  if (n <= 9) return 0;

  
  const t = (n - 10) / (100 - 10); 
  const pct = 0.60 * Math.max(0, Math.min(1, t));

  const cnt = Math.round(totalWords * pct);

  
  return Math.max(1, Math.min(totalWords, cnt));
}


function isBanned(word) {
  return LAST_LEVEL_WORDS.has(word) || RECENT_WORDS.includes(word);
}

let ALL_WORDS = [];
let loaded = false;
async function loadHardWords() {
  try {
    const res = await fetch('./assets/dict/hard.json');
    const data = await res.json();

    const arr = Array.isArray(data)
      ? data
      : (Array.isArray(data.words) ? data.words : []);

    return arr
      .map(w => String(w || '').trim().toUpperCase())
      .filter(Boolean)
      .filter(w => /^[А-ЯІЇЄҐ'’]+$/.test(w))
      .filter(w => w.length >= 2);
  } catch (e) {
    return [];
  }
}

async function loadWords() {
  try {
    const res = await fetch('./assets/dict/core.json');
    const data = await res.json();

    const arr = Array.isArray(data)
      ? data
      : (Array.isArray(data.words) ? data.words : []);

    return arr
      .map(w => String(w || '').trim().toUpperCase())
      .filter(Boolean)

      .filter(w => /^[А-ЯІЇЄҐ'’]+$/.test(w))

      .filter(w => w.length >= 2);

  } catch (e) {
    return [];
  }
}


function gridSizeForLevel(n) {
  if (n <= 14) return 5;
  if (n <= 26) return 6;
  if (n <= 38) return 7;
  if (n <= 50) return 8;
  if (n <= 62) return 9;
  return 10;
}


function minLenForLevel(n) {
  if (n <= 10) return 3;
  if (n <= 20) return 4;
  if (n <= 30) return 5;
  if (n <= 40) return 5;
  if (n <= 60) return 6;
  return 7;
}

function buildLevel(n) {
  const safeN = Number.isFinite(n) ? n : 1;

  const size = gridSizeForLevel(safeN);
  const minLen = minLenForLevel(safeN);

  const genLevel = safeN > 100 ? 100 : Math.max(1, safeN);

const gen = generateLevel({
  cols: size,
  rows: size,
  levelNumber: genLevel
});
  const lvl = {};
  let picked = [];

  const sourceByLen = WORDS_BY_LEN;
  const hardByLen = HARD_BY_LEN;

  const used = new Set();

  const hardNeed = hardCountForLevel(safeN, gen.targets.length);


  const hardIdx = new Set();
  if (hardNeed > 0) {
    for (let k = 0; k < hardNeed; k++) {
      const i = Math.floor((k * gen.targets.length) / hardNeed);
      hardIdx.add(i);
    }
  }

  picked = gen.targets.map((t, idx) => {


    const len = t.path.length;

    const useHard = hardIdx.has(idx);

    const pool = useHard ? (hardByLen.get(len) || []) : (sourceByLen.get(len) || []);

let usedLen = USED_BY_LEN.get(len);
if (!usedLen) {
  usedLen = new Set();
  USED_BY_LEN.set(len, usedLen);
}

   let candidates = pool.filter(w =>
  !used.has(w) &&
  !usedLen.has(w) &&
  !isBanned(w)
);

if (!candidates.length) {

  usedLen.clear();

  candidates = pool.filter(w =>
    !used.has(w) &&
    !usedLen.has(w)
  );

}

if (!candidates.length) {

  candidates = pool.filter(w =>
    !used.has(w)
  );

}


if (!candidates.length) {
  console.warn('⚠️ no candidates for len', len);
  return pool[Math.floor(Math.random() * pool.length)];
}



    const word = candidates[Math.floor(Math.random() * candidates.length)];

    used.add(word);
usedLen.add(word);
return word;
  });


  lvl.grid = gen.grid.slice();
  if (lvl.grid.length !== size * size) {
    throw new Error('❌ Grid size mismatch');
  }

  lvl.targets = gen.targets
    .map((t, idx) => {
      const word = picked[idx];

      if (!word) {
        return null;
      }

      let orderedCells = t.path.slice();
      if (Math.random() < 0.5) {
        orderedCells = [...orderedCells].reverse();
      }

      orderedCells.forEach((cell, i) => {
        lvl.grid[cell] = word[i];
      });


      return {
        id: idx,
        length: word.length,
        path: orderedCells,
        word,
        solved: false,
      };
    })
    .filter(Boolean);



  lvl.number = n;
  lvl.size = size;
  lvl.cols = size;
  lvl.rows = size;


  LAST_LEVEL_WORDS = new Set(lvl.targets.map(t => t.word));
  RECENT_WORDS.push(...lvl.targets.map(t => t.word));

  if (RECENT_WORDS.length > RECENT_WORDS_LIMIT) {
    RECENT_WORDS = RECENT_WORDS.slice(-RECENT_WORDS_LIMIT);
  }

   levelCache.set(n, structuredClone(lvl));
  
  const next = n + 1;
  if (!levelCache.has(next)) {
    setTimeout(() => {
      try { buildLevel(next); } catch { }
    }, 0);
  }

  return lvl;
}

export async function initLevels() {

  if (!loaded) {
    const words = await loadWords();
    const hard = await loadHardWords();
    HARD_WORDS = hard;

    ALL_WORDS = [...new Set(words)];
    WORDS_BY_LEN = buildLenIndex(ALL_WORDS);
    HARD_BY_LEN = buildLenIndex(HARD_WORDS);
    loaded = true;

  }

 const saved = Number(localStorage.getItem(LEVEL_KEY));
  levelNumber = Number.isFinite(saved) && saved > 0 ? saved : 1;

    level = buildLevel(levelNumber);
  window.level = level;
  return level;
}

export function setLevelNumber(n) {
  const parsed = Number(n);
  const nn = Number.isFinite(parsed) && parsed > 0
    ? Math.min(MAX_LEVEL, Math.floor(parsed))
    : 1;

  levelNumber = nn;
  localStorage.setItem(LEVEL_KEY, String(nn));

  if (loaded) {
    level = buildLevel(nn);
    window.level = level;
  }
  else initLevels();

  return levelNumber;
}

export async function nextLevel() {
  if (!loaded) await initLevels();

  const next = levelNumber + 1;
  setLevelNumber(next);
   window.level = level;
  return level;
}

export async function reloadLevel() {
  if (!loaded) await initLevels();

  const cached = levelCache.get(levelNumber);

  if (cached) {
    level = structuredClone(cached);
  } else {
    level = buildLevel(Math.min(levelNumber, 100));
  }

  window.level = level;
  return level;
}
