import { level } from './level.js';

const COINS_KEY = 'slovograi.coins';

export function getCoins() {
  const n = Number(localStorage.getItem(COINS_KEY));
  return Number.isFinite(n) ? n : 0;
}

export function setCoins(n) {
  const safe = Math.max(0, Math.floor(Number(n) || 0));
  localStorage.setItem(COINS_KEY, String(safe));
  const el = document.getElementById('coins');
  if (el) el.textContent = String(safe);
  return safe;
}

export function addCoins(delta) { return setCoins(getCoins() + (Number(delta) || 0)); }

export function spendCoins(cost) {
  const c = Math.max(0, Math.floor(Number(cost) || 0));
  const cur = getCoins();
  if (cur < c) return false;
  setCoins(cur - c);
  return true;
}

export function showBonusWordNotice(text) {
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
  el._t = setTimeout(() => {
    el.classList.remove('show');
    el.textContent = '';
  }, String(text).includes('Підказка:') ? 7000 : 4000);
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
  fx.style.left = `${a.left + a.width / 2}px`;
  fx.style.top = `${a.top + a.height / 2}px`;
  requestAnimationFrame(() => {
    fx.style.transform = `translate(${b.left - a.left + (b.width - a.width) / 2}px, ${b.top - a.top + (b.height - a.height) / 2}px) scale(0.6)`;
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

function addLevelEarnings(bonus, coins) {
  levelBonusCount += bonus || 0;
  levelEarnedCoins += coins || 0;
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
      .then(r => { if (!r.ok) throw 0; return r.text(); })
      .then(text => {
        window.__BONUS_SET__ = new Set(
          text.split(/\r?\n/).map(s => s.trim().toUpperCase()).filter(s => s.length >= 3)
        );
        return window.__BONUS_SET__;
      })
      .catch(() => { window.__BONUS_SET__ = new Set(); return window.__BONUS_SET__; });
  }
  return __bonusLoadPromise;
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

  const reward = Math.max(0, W.length - 2);
  if (!reward) { showBonusWordNotice(`⭐ Бонусне слово: ${W}`); return true; }

  addCoins(reward);
  addLevelEarnings(1, reward);
  showBonusWordNotice(`⭐ Бонусне слово: ${W} +${reward}💰`);

  const cells = document.querySelectorAll('.cell');
  const fromEl = cells[Number.isFinite(fromIndex) ? fromIndex : 0];
  if (fromEl) flyCoins(fromEl, reward);
  return true;
}

let selection = [];
let foundTargetsCount = 0;
let goalHideT = null;
let paidHintTargetId = null;
let hintTimeout = null;
let wordDisplayOn = true;
let colorIndex = 0;

const solvedColors = [
  '#38bdf8','#34d399','#a78bfa','#f87171',
  '#fb923c','#14b8a6','#f472b6','#60a5fa',
  '#22c55e','#c084fc','#fb7185','#2dd4bf'
];

function getNextSolvedColor() { return solvedColors[colorIndex++ % solvedColors.length]; }

function areNeighbors(cols, a, b) {
  return Math.abs(a % cols - b % cols) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) === 1;
}

function isContiguousPath(cols, seq) {
  for (let i = 1; i < seq.length; i++)
    if (!areNeighbors(cols, seq[i - 1], seq[i])) return false;
  return true;
}

function getCellEl(i) { return document.querySelectorAll('.cell')[i] || null; }

function updateWordDisplay(letters) {
  if (!wordDisplayOn) return;
  const el = document.getElementById('wordInputDisplay');
  if (!el) return;
  if (!letters.length) { el.innerHTML = ''; return; }

  const cur = el.querySelectorAll('.wletter').length;
  if (letters.length < cur) {
    el.innerHTML = '';
    letters.slice(0, 14).forEach(l => {
      const s = document.createElement('span');
      s.className = 'wletter';
      s.textContent = l;
      el.appendChild(s);
    });
    return;
  }
  if (letters.length <= 14) {
    const s = document.createElement('span');
    s.className = 'wletter wletter-new';
    s.textContent = letters[letters.length - 1];
    el.appendChild(s);
    setTimeout(() => s.classList.remove('wletter-new'), 200);
  }
}

export function setWordDisplayEnabled(val) {
  wordDisplayOn = val;
  if (!val) { const el = document.getElementById('wordInputDisplay'); if (el) el.innerHTML = ''; }
}

function clearSelection() {
  selection = [];
  document.querySelectorAll('.cell.active').forEach(c => c.classList.remove('active'));
  updateWordDisplay([]);
}
export function clearCurrentSelection() { clearSelection(); }

function clearHints() {
  if (hintTimeout) { clearTimeout(hintTimeout); hintTimeout = null; }
  document.querySelectorAll('.cell.hint').forEach(c => c.classList.remove('hint'));
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
    goalText.innerHTML = `<span class="goal-left">⏱ Знайди <strong>5 слів</strong> за</span>
     <span id="timer" class="goal-timer">02:00</span>
     <span class="goal-right">+50💰</span>`;
  }
  if (goalHideT) { clearTimeout(goalHideT); goalHideT = null; }
}

function startSelection(index) {
  clearHints();
  clearSelection();
  selection.push(index);
  getCellEl(index)?.classList.add('active');
  updateWordDisplay([getCellEl(index)?.textContent || '']);
}

function extendSelection(index) {
  const cols = level.cols ?? level.size;
  const last = selection[selection.length - 1];
  const prev = selection[selection.length - 2];

  if (prev !== undefined && index === prev) {
    const removed = selection.pop();
    getCellEl(removed)?.classList.remove('active');
    updateWordDisplay(selection.map(i => getCellEl(i)?.textContent || ''));
    return;
  }
  if (selection.includes(index)) return;
  if (selection.length > 0 && !areNeighbors(cols, last, index)) return;

  selection.push(index);
  getCellEl(index)?.classList.add('active');
  updateWordDisplay(selection.map(i => getCellEl(i)?.textContent || ''));
}

async function finishSelection() {
  const cols = level.cols ?? level.size;
  if (!isContiguousPath(cols, selection)) {
    if (selection.length > 0 && window.playFail) window.playFail();
    clearSelection();
    return;
  }

  const letters = selection.map(i => getCellEl(i)?.textContent || '').join('');
  updateWordDisplay(selection.map(i => getCellEl(i)?.textContent || ''));

  const sel = selection;
  const selRev = [...selection].reverse();

  const hit = level.targets.find(t => {
    if (t.path.length !== sel.length) return false;
    const isPal = t.word === t.word.split('').reverse().join('');
    let same = true;
    for (let i = 0; i < t.path.length; i++) if (t.path[i] !== sel[i]) { same = false; break; }
    if (same) return true;
    if (isPal) {
      let sameRev = true;
      for (let i = 0; i < t.path.length; i++) if (t.path[i] !== selRev[i]) { sameRev = false; break; }
      if (sameRev) return true;
    }
    return false;
  });

  if (hit) { markTarget(hit, hit.word.toUpperCase()); clearSelection(); return; }

  if (letters.length >= 3) {
    const W = letters.toUpperCase();
    if (level.targets.some(t => t.word.toUpperCase() === W)) {
      showBonusWordNotice('✨ Майже! Спробуй інший маршрут');
      clearSelection();
      return;
    }
    const ok = await tryBonusWord(W, selection[selection.length - 1]);
    if (!ok && window.playFail) window.playFail();
  } else if (window.playFail) window.playFail();

  clearSelection();
}

export async function onCellClick(cell, index) {
  if (!level?.targets) return;

  const pos = selection.indexOf(index);
  if (pos === -1) selection.push(index);
  else selection.splice(pos, 1);

  const cols = level.cols ?? level.size;
  if (!isContiguousPath(cols, selection)) return;

  const letters = selection.map(i => getCellEl(i)?.textContent || '').join('');
  updateWordDisplay(selection.map(i => getCellEl(i)?.textContent || ''));

  const sel = JSON.stringify(selection);
  const selRev = JSON.stringify([...selection].reverse());

  const hit = level.targets.find(t => {
    const p = JSON.stringify(t.path);
    const isPal = t.word && t.word === t.word.split('').reverse().join('');
    return p === sel || (isPal && p === selRev);
  });

  if (hit) { markTarget(hit, hit.word.toUpperCase()); clearSelection(); return; }

  if (letters.length >= 3) {
    const W = letters.toUpperCase();
    if (level.targets.some(t => t.word.toUpperCase() === W)) {
      showBonusWordNotice('✨ Майже! Спробуй інший маршрут');
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
  const color = getNextSolvedColor();
  (target.path || []).forEach(i => {
    if (!cells[i]) return;
    cells[i].style.background = color;
    cells[i].classList.add('locked');
    cells[i].classList.remove('active', 'hint');
  });
  clearSelection();

  if (!level._rewarded && foundTargetsCount === 5) {
    level._rewarded = true;
    const LEVEL_REWARD = 50;
    addCoins(LEVEL_REWARD);
    addLevelEarnings(0, LEVEL_REWARD);

    const goalText = document.getElementById('goalText');
    if (goalText) {
      let done = goalText.querySelector('.goal-done');
      if (!done) { done = document.createElement('span'); done.className = 'goal-done'; goalText.innerHTML = ''; goalText.appendChild(done); }
      done.textContent = `Молодець! Знайдено 5 слів · ${LEVEL_REWARD}💰 отримано`;
      goalText.style.visibility = 'visible';
    }

    clearTimeout(goalHideT);
    goalHideT = setTimeout(() => {
      const gt = document.getElementById('goalText');
      if (gt) { gt.style.visibility = 'visible'; gt.innerHTML = `<span class="goal-left">🎯 Знайди всі слова </span>`; }
      goalHideT = null;
    }, 4000);
  }

  if (!level._completed && level.targets.every(t => t.solved)) {
    level._completed = true;
    if (window.playLevelComplete) window.playLevelComplete();
    document.dispatchEvent(new CustomEvent('slovograi:levelComplete'));
  }
}

let isDragging = false;
let activePointerId = null;

export function bindGridDrag() {
  const grid = document.getElementById('grid');
  if (!grid || grid.dataset.dragBound === '1') return;
  grid.dataset.dragBound = '1';

  grid.addEventListener('pointerdown', e => {
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

  grid.addEventListener('pointermove', e => {
    if (!isDragging || activePointerId !== e.pointerId) return;
    if (e.pointerType === 'mouse' && e.buttons !== 1) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.cell');
    if (!cell || cell.classList.contains('locked')) return;
    const index = Number(cell.dataset.index);
    if (!Number.isFinite(index)) return;
    const before = selection.length;
    extendSelection(index);
    if (selection.length > before && window.playSelectNote) window.playSelectNote();
    e.preventDefault();
  });

  const end = e => {
    if (!isDragging || activePointerId !== e.pointerId) return;
    isDragging = false;
    activePointerId = null;
    finishSelection();
  };
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);
}

function getNextUnsolvedTarget() {
  if (!level?.targets?.length) return null;
  return level.targets.find(t => !t.solved) || level.targets[0];
}

export function bindEvents() {
  const restartBtn = document.getElementById('restartBtn');
  restartBtn && (restartBtn.onclick = () => {
    clearSelection();
    document.querySelectorAll('.cell').forEach(c => {
      c.classList.remove('active', 'locked');
      c.style.background = '';
    });
  });

  const hintBtn = document.getElementById('hintBtn');
  hintBtn && (hintBtn.onclick = () => {
    const t = getNextUnsolvedTarget();
    if (!t) return;
    if (paidHintTargetId !== t.id) {
      if (!spendCoins(40)) { showBonusWordNotice('Не вистачає монет 😕'); return; }
      paidHintTargetId = t.id;
    }
    clearHints();
    const cells = document.querySelectorAll('.cell');
    if (cells[t.path?.[0]]) cells[t.path[0]].classList.add('hint');
    hintTimeout = setTimeout(clearHints, 4000);
    showBonusWordNotice('Підказка: 1 літера');
  });

  const hintWordBtn = document.getElementById('hintWordBtn');
  hintWordBtn && (hintWordBtn.onclick = () => {
    const t = getNextUnsolvedTarget();
    if (!t) return;
    if (paidHintTargetId !== t.id) {
      if (!spendCoins(100)) { showBonusWordNotice('Не вистачає монет 😕'); return; }
      paidHintTargetId = t.id;
    }
    clearHints();
    const cells = document.querySelectorAll('.cell');
    (t.path || []).forEach(i => { if (cells[i]) cells[i].classList.add('hint'); });
    hintTimeout = setTimeout(clearHints, 4600);
    showBonusWordNotice(`💡 Підказка: ${t.word.toUpperCase()}`);
  });
}
