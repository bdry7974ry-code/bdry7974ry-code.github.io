import { level } from './level.js';

const COINS_KEY = 'slovograi.coins';

export function getCoins() {
  const raw = localStorage.getItem(COINS_KEY);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function setCoins(n) {
  const safe = Math.max(0, Math.floor(Number(n) || 0));
  localStorage.setItem(COINS_KEY, String(safe));

  const coinsEl = document.getElementById('coins');
  if (coinsEl) coinsEl.textContent = String(safe);

  return safe;
}

export function addCoins(delta) {
  return setCoins(getCoins() + (Number(delta) || 0));
}

export function spendCoins(cost) {
  const c = Math.max(0, Math.floor(Number(cost) || 0));
  const cur = getCoins();
  if (cur < c) return false;
  setCoins(cur - c);
  return true;
}

export function showBonusWordNotice(text) {
  const s = String(text);

  if (typeof text === 'string') {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t.includes('Бонусних слів') || t.includes('Монет зароблено')) return;
  }

  const el = document.getElementById('bonusWordNotice');
  if (!el) return;

  clearTimeout(el._t);
  el.classList.remove('show');
  el.textContent = text;
  el.classList.add('show');

  const msg = String(text || '');
  const isHint = msg.includes('Підказка:');
  const ttl = isHint ? 7000 : 4000;

  el._t = setTimeout(() => {
    el.classList.remove('show');
    el.textContent = '';
  }, ttl);

}

function flyCoins(fromEl, amount) {
  const toBtn = document.querySelector('#game-screen .coins-btn');
  if (!fromEl || !toBtn) return;

  const a = fromEl.getBoundingClientRect();
  const b = toBtn.getBoundingClientRect();

  const fx = document.createElement('div');
  fx.className = 'coin-fly';
  fx.textContent = `+${amount} 🪙`;
  document.body.appendChild(fx);

  const startX = a.left + a.width / 2;
  const startY = a.top + a.height / 2;
  const endX = b.left + b.width / 2;
  const endY = b.top + b.height / 2;

  fx.style.left = `${startX}px`;
  fx.style.top = `${startY}px`;

  requestAnimationFrame(() => {
    fx.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.6)`;
    fx.style.opacity = '0';
  });

  setTimeout(() => fx.remove(), 520);
}

let levelBonusCount = 0;
let levelEarnedCoins = 0;

function renderLevelCounters() {
  const bw = document.getElementById('bonusWordsFound');
  const ce = document.getElementById('coinsEarned');
  if (bw) bw.textContent = levelBonusCount;
  if (ce) ce.textContent = levelEarnedCoins;
}

function addLevelEarnings(bonusDelta, coinsDelta) {
  levelBonusCount += Number(bonusDelta) || 0;
  levelEarnedCoins += Number(coinsDelta) || 0;
  renderLevelCounters();
}

function resetLevelCounters() {
  levelBonusCount = 0;
  levelEarnedCoins = 0;
  renderLevelCounters();
}

renderLevelCounters();

let __bonusLoadPromise = null;

async function getBonusSet() {
  if (window.__BONUS_SET__) return window.__BONUS_SET__;

  if (!__bonusLoadPromise) {
    __bonusLoadPromise = fetch('./assets/dict/bonus.txt')

      .then(r => {
        if (!r.ok) throw new Error('ua_bonus.txt not found');
        return r.text();
      })
      .then(text => {
        const set = new Set(
          text.split(/\r?\n/)
            .map(s => s.trim().toUpperCase())
            .filter(s => s.length >= 3)
        );
        window.__BONUS_SET__ = set;
        return set;
      })
      .catch(() => {
        window.__BONUS_SET__ = new Set();
        return window.__BONUS_SET__;
      });
  }

  return __bonusLoadPromise;
}

function bonusCoins(len) {

  return Math.max(0, len - 2);
}

async function tryBonusWord(word, fromIndex = null) {
  if (!word || word.length < 3) return false;

  const set = window.__BONUS_SET__ || await getBonusSet();
  const W = word.toUpperCase();
  if (!set.has(W)) return false;


  if (!level.foundBonus) level.foundBonus = new Set();

  if (level.foundBonus.has(W)) {
    showBonusWordNotice(`⭐ Бонусне слово: ${W} — вже знайдено`);
    if (window.playFail) window.playFail();
    return true;
  }

  level.foundBonus.add(W);
  if (window.playBonus) window.playBonus();


  const reward = bonusCoins(W.length); 
  if (reward <= 0) {
    showBonusWordNotice(`⭐ Бонусне слово: ${W}`);
    return true;
  }

  addCoins(reward);
  addLevelEarnings(1, reward);

  showBonusWordNotice(`⭐ Бонусне слово: ${W} +${reward}💰`);

  const cells = document.querySelectorAll('.cell');
  const idx = Number.isFinite(fromIndex) ? fromIndex : 0;
  const fromEl = cells[idx];
  if (fromEl) flyCoins(fromEl, reward);

  return true;
}

let selection = [];
let foundTargetsCount = 0;
let goalHideT = null;
let paidHintTargetId = null;
let hintTimeout = null;
let hintLock = false;
let lastHintType = null;


function areNeighbors(cols, a, b) {
  const ax = a % cols, ay = Math.floor(a / cols);
  const bx = b % cols, by = Math.floor(b / cols);
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return (dx + dy) === 1;
}


function isContiguousPath(size, seq) {
  if (seq.length < 2) return true;
  for (let i = 1; i < seq.length; i++) {
    if (!areNeighbors(size, seq[i - 1], seq[i])) return false;
  }
  return true;
}

function clearSelection() {
  selection = [];
  document.querySelectorAll('.cell.active').forEach(c => c.classList.remove('active'));
  updateWordDisplay([]);
}
export function clearCurrentSelection() {
  clearSelection();
}

function updateWordDisplay(letters) {

  if (!wordDisplayOn) return;

  const el = document.getElementById('wordInputDisplay');
  if (!el) return;
  if (!letters.length) { el.innerHTML = ''; return; }

  const current = el.querySelectorAll('.wletter');
  const newCount = letters.length;

  // Якщо менше букв ніж було — скидаємо все
  if (newCount < current.length) {
    el.innerHTML = '';
    letters.slice(0, 14).forEach(l => {
      const span = document.createElement('span');
      span.className = 'wletter';
      span.textContent = l;
      el.appendChild(span);
    });
    return;
  }

  // Додаємо тільки нову букву з анімацією
  if (newCount <= 14) {
    const span = document.createElement('span');
    span.className = 'wletter wletter-new';
    span.textContent = letters[newCount - 1];
    el.appendChild(span);
    setTimeout(() => span.classList.remove('wletter-new'), 200);
  }
}
let wordDisplayOn = true;
export function setWordDisplayEnabled(val) {
  wordDisplayOn = val;
  if (!val) {
    const el = document.getElementById('wordInputDisplay');
    if (el) el.innerHTML = '';
  }
}

export function resetForNewLevel() {
  selection = [];
  colorIndex = 0;
  foundTargetsCount = 0;
  resetLevelCounters();

  if (level) {
    level._completed = false;
    level.foundBonus = new Set();
    level._rewarded = false;
  }

  const goalBlock = document.getElementById('goalBlock');
  const goalText = document.getElementById('goalText');

  if (goalBlock) goalBlock.style.opacity = '1';

  if (goalText) {
    goalText.style.visibility = 'visible';
    goalText.innerHTML =
      `<span class="goal-left">⏱ Знайди <strong>5 слів</strong> за</span>
     <span id="timer" class="goal-timer">02:00</span>
     <span class="goal-right">+50💰</span>`;
  }
  if (goalHideT) {
    clearTimeout(goalHideT);
    goalHideT = null;
  }
}

function clearHints() {
  if (hintTimeout) {
    clearTimeout(hintTimeout);
    hintTimeout = null;
  }
  document.querySelectorAll('.cell.hint').forEach(c => c.classList.remove('hint'));
}

let colorIndex = 0;

const solvedColors = [
  "#38bdf8", "#34d399", "#a78bfa", "#f87171",
  "#fb923c", "#14b8a6", "#f472b6", "#60a5fa",
  "#22c55e", "#c084fc", "#fb7185", "#2dd4bf"
];

function getNextSolvedColor() {
  const c = solvedColors[colorIndex % solvedColors.length];
  colorIndex++;
  return c;
}

export async function onCellClick(cell, index) {

  const pos = selection.indexOf(index);
  if (pos === -1) selection.push(index);
  else selection.splice(pos, 1);


  const cols = level.cols ?? level.size;
  if (!isContiguousPath(cols, selection)) {
    return;
  }

  const letters = selection.map(i => {
    const c = document.querySelectorAll('.cell')[i];
    return c ? c.textContent : "";
  }).join("");
  
  updateWordDisplay(selection.map(i => {
    const c = document.querySelectorAll('.cell')[i];
    return c ? c.textContent : '';
  }));


  const sel = JSON.stringify(selection);
  const selRev = JSON.stringify([...selection].reverse());

  const hit = level.targets.find(t => {
    const p = JSON.stringify(t.path);

    const w = String(t.word || '').toUpperCase();
    const isPal = w && w === w.split('').reverse().join('');

    if (p === sel) return true;
    if (isPal && p === selRev) return true;

    return false;
  });

  if (hit) {
    markTarget(hit, String(hit.word || "").toUpperCase());
    clearSelection();
  } else if (letters.length >= 3) {
    const W = letters.toUpperCase();

    const sameWordOtherRoute = level.targets.some(t => {
      const TW = String(t.word || '').toUpperCase();
      return TW.length === W.length && TW === W;
    });

    if (sameWordOtherRoute) {
      showBonusWordNotice(`✨ Майже! Спробуй інший маршрут`);
      clearSelection();
      return;
    }

    await tryBonusWord(W, selection[selection.length - 1]);
    clearSelection();
  }

}

function markTarget(target, word) {

  if (target.solved) return;
  if (window.playSuccess) window.playSuccess();


  clearHints();
  paidHintTargetId = null;

  target.solved = true;

  foundTargetsCount++;

  const cells = document.querySelectorAll('.cell');
  const uniqueColor = getNextSolvedColor();

  (target.path || []).forEach(i => {
    if (cells[i]) {
      cells[i].style.background = uniqueColor;
      cells[i].classList.add('locked');
      cells[i].classList.remove('active');
      cells[i].classList.remove('hint');
    }
  });

  clearSelection();


  const foundNow = foundTargetsCount;

  if (!level._rewarded && foundNow === 5) {
    level._rewarded = true;

    const LEVEL_REWARD = 50;
    addCoins(LEVEL_REWARD);
    addLevelEarnings(0, LEVEL_REWARD);

    const goalText = document.getElementById('goalText');
    if (goalText) {
      let done = goalText.querySelector('.goal-done');
      if (!done) {
        done = document.createElement('span');
        done.className = 'goal-done';
        goalText.innerHTML = '';
        goalText.appendChild(done);
      }
      done.textContent = `Молодець! Знайдено 5 слів · ${LEVEL_REWARD}💰 отримано`;
      goalText.style.visibility = 'visible';
    }

    const goalBlock = document.getElementById('goalBlock');

    clearTimeout(goalHideT);
    goalHideT = setTimeout(() => {
      const goalText = document.getElementById('goalText');
      if (goalText) {
        goalText.style.visibility = 'visible';
        goalText.innerHTML = `<span class="goal-left">🎯 Знайди всі слова </span>`;
      }
      goalHideT = null;
    }, 4000);
  }


  if (
    level &&
    !level._completed &&
    Array.isArray(level.targets) &&
    level.targets.every(t => t.solved)
  ) {
    level._completed = true;
    if (window.playLevelComplete) window.playLevelComplete();
    document.dispatchEvent(new CustomEvent('slovograi:levelComplete'));

  }

}

let isDragging = false;
let activePointerId = null;

function getCellEl(index) {
  return document.querySelectorAll('.cell')[index] || null;
}

function startSelection(index) {
  clearHints();
  clearSelection();
  selection.push(index);
  const el = getCellEl(index);
  if (el) el.classList.add('active');
  updateWordDisplay([getCellEl(index)?.textContent || '']);
}

function extendSelection(index) {
  const cols = level.cols ?? level.size;
  const last = selection[selection.length - 1];

  const prev = selection[selection.length - 2];
  if (prev !== undefined && index === prev) {
    const removed = selection.pop();
    const el = getCellEl(removed);
    if (el) el.classList.remove('active');
    updateWordDisplay(selection.map(i => getCellEl(i)?.textContent || ''));
    return;
  }


  if (selection.includes(index)) return;


  if (selection.length > 0 && !areNeighbors(cols, last, index)) return;

  selection.push(index);
  const el = getCellEl(index);
  if (el) el.classList.add('active');
  updateWordDisplay(selection.map(i => getCellEl(i)?.textContent || ''));
}

async function finishSelection() {


  const cols = level.cols ?? level.size;
  if (!isContiguousPath(cols, selection)) {
    if (selection.length > 0 && window.playFail) {
      window.playFail();
    }

    clearSelection();
    return;
  }

  const letters = selection.map(i => {
    const c = getCellEl(i);
    return c ? c.textContent : "";
  }).join("");
  updateWordDisplay(selection.map(i => {
    const c = getCellEl(i);
    return c ? c.textContent : '';
  }));

  const sel = selection;
  const selRev = [...selection].reverse();

  const hit = level.targets.find(t => {
    const p = t.path;
    if (p.length !== sel.length) return false;

    const word = String(t.word || '').toUpperCase();
    const isPal = word === word.split('').reverse().join('');

    
    let same = true;
    for (let i = 0; i < p.length; i++) {
      if (p[i] !== sel[i]) { same = false; break; }
    }
    if (same) return true;

    
    if (isPal) {
      let sameRev = true;
      for (let i = 0; i < p.length; i++) {
        if (p[i] !== selRev[i]) { sameRev = false; break; }
      }
      if (sameRev) return true;
    }

    return false;
  });


  if (hit) {
    markTarget(hit, String(hit.word || "").toUpperCase());
    clearSelection();
    return;
  }

  if (letters.length >= 3) {

    const W = letters.toUpperCase();

    const sameWordOtherRoute = level.targets.some(t => {
      const TW = String(t.word || '').toUpperCase();
      return TW.length === W.length && TW === W;
    });

    if (sameWordOtherRoute) {
      showBonusWordNotice(`✨ Майже! Спробуй інший маршрут`);
      clearSelection();
      return;
    }

    const okBonus = await tryBonusWord(W, selection[selection.length - 1]);

    if (!okBonus && window.playFail) {
      window.playFail();
    }

  } else {
    if (window.playFail) window.playFail();
  }

  clearSelection();

}

export function bindGridDrag() {
  const grid = document.getElementById('grid');
  if (!grid || grid.dataset.dragBound === '1') return;
  grid.dataset.dragBound = '1';

  grid.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || cell.classList.contains('locked')) return;

    isDragging = true;
    activePointerId = e.pointerId;
    grid.setPointerCapture(activePointerId);

    const index = Number(cell.dataset.index);
    if (!Number.isFinite(index)) return;

    startSelection(index);
    if (window.playSelectNote) window.playSelectNote();


    e.preventDefault();
  });

  grid.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    if (activePointerId !== e.pointerId) return;

    
    if (e.pointerType === 'mouse' && e.buttons !== 1) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el?.closest?.('.cell');
    if (!cell || cell.classList.contains('locked')) return;

    const index = Number(cell.dataset.index);
    if (!Number.isFinite(index)) return;

    const before = selection.length;
    extendSelection(index);
    if (selection.length > before && window.playSelectNote) {
      window.playSelectNote();
    }


    e.preventDefault();
  });

  const end = (e) => {
    if (!isDragging) return;
    if (activePointerId !== e.pointerId) return;

    isDragging = false;
    activePointerId = null;
    finishSelection();
  };

  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);
}

function getNextUnsolvedTarget() {
  if (!level || !Array.isArray(level.targets) || level.targets.length === 0) return null;
  return level.targets.find(t => !t.solved) || level.targets[0];
}

export function bindEvents() {
  const restartBtn = document.getElementById('restartBtn');
  restartBtn && (restartBtn.onclick = () => {
    clearSelection();
    document.querySelectorAll('.cell').forEach(c => {
      c.classList.remove('active');
      c.classList.remove('locked');
      c.style.background = '';
    });
  });

  const hintBtn = document.getElementById('hintBtn');
  const hintWordBtn = document.getElementById('hintWordBtn');


  hintBtn && (hintBtn.onclick = () => {
    const COST = 40;

    const t = getNextUnsolvedTarget();
    if (!t) return;

    if (paidHintTargetId !== t.id) {
      if (!spendCoins(COST)) {
        showBonusWordNotice('Не вистачає монет 😕');
        return;
      }
      paidHintTargetId = t.id;
    }

    clearHints();

    const cells = document.querySelectorAll('.cell');
    const i = t.path?.[0];
    if (cells[i]) cells[i].classList.add('hint');

    hintTimeout = setTimeout(() => {
      clearHints();
    }, 4000);

    showBonusWordNotice(`Підказка: 1 літера`);
  });


  hintWordBtn && (hintWordBtn.onclick = () => {
    const COST = 100;

    const t = getNextUnsolvedTarget();
    if (!t) return;

    if (paidHintTargetId !== t.id) {
      if (!spendCoins(COST)) {
        showBonusWordNotice('Не вистачає монет 😕');
        return;
      }
      paidHintTargetId = t.id;
    }

    clearHints();

    const cells = document.querySelectorAll('.cell');
    (t.path || []).forEach(idx => {
      if (cells[idx]) cells[idx].classList.add('hint');
    });

    hintTimeout = setTimeout(() => {
      clearHints();
    }, 4600);

    const W = String(t.word || '').toUpperCase();
    showBonusWordNotice(`💡 Підказка: ${W}`);
  });

}

