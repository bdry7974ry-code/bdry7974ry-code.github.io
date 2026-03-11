import { createGrid } from './grid.js';
import {
  bindEvents, bindGridDrag, resetForNewLevel, showBonusWordNotice,
  getCoins, setCoins, addCoins, clearCurrentSelection, setWordDisplayEnabled
} from './logic.js';
import { nextLevel, reloadLevel, setLevelNumber, levelNumber, level } from './level.js';

const DEV_LEVEL_WHEEL = true;

document.addEventListener('DOMContentLoaded', () => {

  // ── Install ──────────────────────────────────────────────
  let deferredPrompt;
  const installBtn = document.getElementById('installBtn');
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isIOS && !isStandalone) installBtn?.classList.remove('hidden');

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn?.classList.remove('hidden');
  });

  installBtn?.addEventListener('click', async () => {
    if (isIOS) { alert('Щоб встановити гру:\n\n1. Натисніть "Поділитися"\n2. Оберіть "На екран Додому"'); return; }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn?.classList.add('hidden');
  });

  // ── Word display toggle ──────────────────────────────────
  const WORD_DISPLAY_KEY = 'slovograi.wordDisplay';
  let wordDisplayEnabled = localStorage.getItem(WORD_DISPLAY_KEY);
  wordDisplayEnabled = wordDisplayEnabled === null ? true : wordDisplayEnabled === 'true';
  setWordDisplayEnabled(wordDisplayEnabled);

  const toggleWordBtn = document.getElementById('toggleWordDisplayBtn');
  if (toggleWordBtn) toggleWordBtn.textContent = wordDisplayEnabled ? '💬 Показ слова ✓' : '💬 Показ слова ✗';
  toggleWordBtn?.addEventListener('pointerup', () => {
    wordDisplayEnabled = !wordDisplayEnabled;
    toggleWordBtn.textContent = wordDisplayEnabled ? '💬 Показ слова ✓' : '💬 Показ слова ✗';
    setWordDisplayEnabled(wordDisplayEnabled);
    localStorage.setItem(WORD_DISPLAY_KEY, wordDisplayEnabled);
    document.querySelector('.top-right')?.classList.remove('open');
  });

  // ── Constants & state ────────────────────────────────────
  const PROGRESS_KEY = 'slovograi.maxLevel';
  const CURRENT_LEVEL_KEY = 'slovograi.currentLevel';
  const LEVEL_STATE_KEY = 'slovograi.levelState';
  const NAME_KEY = 'slovograi.playerName';
  const MUSIC_KEY = 'slovograi.musicEnabled';
  const UI_SOUND_KEY = 'slovograi.uiSoundEnabled';
  const TAB_KEY = 'slovograi.musicOwner';
  const tabId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let dropdownsBound = false;
  let timerEl = document.getElementById('timer');
  let timeLeft = 120;
  let timerInterval;
  let timerStarted = false;
  let levelStartTs = Date.now();
  let levelStartCoins = getCoins();

  function getMaxLevel() { return Math.max(3, Number(localStorage.getItem(PROGRESS_KEY)) || 3); }
  function setMaxLevel(n) { const v = Math.max(3, Math.floor(Number(n) || 3)); localStorage.setItem(PROGRESS_KEY, String(v)); return v; }
  function getPlayerName() { return localStorage.getItem(NAME_KEY); }
  function claimMusicOwner() { localStorage.setItem(TAB_KEY, tabId); }
  function isMusicOwner() { return localStorage.getItem(TAB_KEY) === tabId; }
  function formatTimeSec(sec) { sec = Math.max(0, Math.floor(sec || 0)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

  // ── Screens ──────────────────────────────────────────────
  const menu = document.getElementById('menu-screen');
  const game = document.getElementById('game-screen');
  const result = document.getElementById('result-screen');

  function closeAllModals() {
    ['levelWheelModal','settingsModal','howToPlayModal','shopModal','nameModal']
      .forEach(id => document.getElementById(id)?.classList.add('hidden'));
  }

  function showScreen(which) {
    menu?.classList.remove('active');
    game?.classList.remove('active');
    result?.classList.remove('active');
    if (which === 'menu') menu?.classList.add('active');
    if (which === 'game') game?.classList.add('active');
    if (which === 'result') result?.classList.add('active');
  }

  function goGame() { closeAllModals(); showScreen('game'); }

  async function continueGame() {
    const savedLevel = Number(localStorage.getItem(CURRENT_LEVEL_KEY));
    if (savedLevel) setLevelNumber(savedLevel);
    const { initLevels } = await import('./level.js');
    await initLevels();
    goGame();
    if (!document.getElementById('grid')?.children.length) rebuildGame({ withDropdowns: true });
  }

  function rebuildGame({ withDropdowns = true } = {}) {
    resetForNewLevel();
    createGrid();
    bindGridDrag();
    bindEvents();
    startTimer();
    refreshLevelUI();
    if (withDropdowns) bindDropdownsOnce();
  }

  function showResultScreen({ timeText = '00:00', found = 0, earned = 0 } = {}) {
    const el = id => document.getElementById(id);
    if (el('resultLevelNum')) el('resultLevelNum').textContent = String(levelNumber);
    if (el('resultNextLevelNum')) el('resultNextLevelNum').textContent = String(levelNumber + 1);
    if (el('resultRetryLevelNum')) el('resultRetryLevelNum').textContent = String(levelNumber);
    if (el('resultTime')) el('resultTime').textContent = timeText;
    if (el('resultFound')) el('resultFound').textContent = String(found);
    if (el('resultEarned')) el('resultEarned').textContent = String(earned);
    showScreen('result');
  }

  // ── Level complete ───────────────────────────────────────
  document.addEventListener('slovograi:levelComplete', () => {
    const maxLevel = getMaxLevel();
    if (levelNumber >= maxLevel) setMaxLevel(Math.min(levelNumber + 1, 9999));
    const sec = Math.round((Date.now() - levelStartTs) / 1000);
    showResultScreen({
      timeText: formatTimeSec(sec),
      found: level?.targets?.filter(t => t.solved).length || 0,
      earned: Math.max(0, getCoins() - levelStartCoins)
    });
    localStorage.removeItem(LEVEL_STATE_KEY);
  });

  // ── Coins init ───────────────────────────────────────────
  const existingCoins = localStorage.getItem('slovograi.coins');
  setCoins(existingCoins === null ? 200 : Number(existingCoins) || 0);

  // ── Buttons ──────────────────────────────────────────────
  const el = id => document.getElementById(id);

  el('exitBtn')?.addEventListener('click', () => showScreen('menu'));
  el('exitBtn2')?.addEventListener('click', () => showScreen('menu'));

  el('continueGameBtn')?.addEventListener('click', () => {
    document.querySelector('.top-left')?.classList.remove('open');
    continueGame();
  });

  el('continueGameBtnCoins')?.addEventListener('click', () => {
    document.querySelector('.coins-menu')?.classList.remove('open');
    continueGame();
  });

  el('retryLevelBtn')?.addEventListener('pointerup', async () => {
    const { reloadLevel } = await import('./level.js');
    await reloadLevel();
    goGame();
    rebuildGame({ withDropdowns: false });
  });

  el('openSettingsFromGameBtn')?.addEventListener('click', () => {
    document.querySelector('.top-left')?.classList.remove('open');
    showScreen('menu');
    openSettingsModal();
  });

  el('resultMenuBtn')?.addEventListener('click', () => showScreen('menu'));
  el('resultExitBtn')?.addEventListener('click', () => showScreen('menu'));

  el('resultNextBtn')?.addEventListener('pointerup', async () => {
    await nextLevel();
    localStorage.setItem(CURRENT_LEVEL_KEY, levelNumber);
    goGame();
    rebuildGame({ withDropdowns: true });
  });

  el('resultRetryBtn')?.addEventListener('pointerup', async () => {
    const { reloadLevel } = await import('./level.js');
    await reloadLevel();
    goGame();
    rebuildGame({ withDropdowns: true });
  });

  el('nextLevelBtn')?.addEventListener('pointerup', async () => {
    if (levelNumber + 1 > getMaxLevel() + 1) { showBonusWordNotice('🔒 Рівень заблоковано'); return; }
    await nextLevel();
    goGame();
    rebuildGame({ withDropdowns: false });
  });

  // ── Level wheel ──────────────────────────────────────────
  const levelWheelEl = el('levelWheel');
  const levelWheelModal = el('levelWheelModal');
  let pendingLevel = null;
  let wheelEnd = 0;
  let wheelScrollHandler = null;

  el('levelsBtn')?.addEventListener('click', () => {
    if (!DEV_LEVEL_WHEEL) return;
    settingsModal?.classList.add('hidden');
    levelWheelModal?.classList.remove('hidden');
    renderLevelWheel();
  });

  el('closeLevelWheelBtn')?.addEventListener('click', () => levelWheelModal?.classList.add('hidden'));

  el('confirmLevelBtn')?.addEventListener('click', async () => {
    if (!pendingLevel || pendingLevel > getMaxLevel() + 1) {
      if (pendingLevel) showBonusWordNotice('🔒 Рівень заблоковано');
      return;
    }
    setLevelNumber(pendingLevel);
    localStorage.setItem(CURRENT_LEVEL_KEY, pendingLevel);
    pendingLevel = null;
    levelWheelModal?.classList.add('hidden');
    if (levelWheelEl) levelWheelEl.scrollLeft = 0;
    goGame();
    const { initLevels } = await import('./level.js');
    await initLevels();
    rebuildGame({ withDropdowns: true });
  });

  function addWheelButtons(from, to) {
    const maxLevel = getMaxLevel();
    for (let i = from; i <= to; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.dataset.level = i;
      if (i === levelNumber) btn.classList.add('current');
      if (i > maxLevel + 1) btn.classList.add('locked');
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.15)'; });
      btn.addEventListener('mouseleave', () => { if (!btn.classList.contains('current')) btn.style.transform = 'scale(1)'; });
      btn.onclick = () => {
        if (i > getMaxLevel() + 1) {
          btn.classList.remove('shake');
          void btn.offsetWidth;
          btn.classList.add('shake');
          showBonusWordNotice('🔒 Рівень заблоковано');
          return;
        }
        pendingLevel = i;
        levelWheelEl.querySelectorAll('button').forEach(b => b.classList.remove('current'));
        btn.classList.add('current');
      };
      levelWheelEl.appendChild(btn);
    }
    wheelEnd = to;
  }

  function renderLevelWheel() {
    if (!DEV_LEVEL_WHEEL || !levelWheelEl) return;
    levelWheelEl.innerHTML = '';
    wheelEnd = 0;

    // Рендеримо до maxLevel + 1 (наступний доступний), мінімум 50
    const initialEnd = Math.max(50, getMaxLevel() + 1);
    addWheelButtons(1, Math.min(999, initialEnd));

    levelWheelEl.onwheel = e => { e.preventDefault(); levelWheelEl.scrollLeft += e.deltaY; };

    if (wheelScrollHandler) levelWheelEl.removeEventListener('scroll', wheelScrollHandler);

    wheelScrollHandler = () => {
      if (levelWheelModal?.classList.contains('hidden') || wheelEnd >= 999) return;
      const allBtns = levelWheelEl.querySelectorAll('button');
      const lastBtn = allBtns[allBtns.length - 1];
      if (!lastBtn) return;
      if (lastBtn.offsetLeft + lastBtn.offsetWidth - (levelWheelEl.scrollLeft + levelWheelEl.clientWidth) < lastBtn.offsetWidth * 15)
        addWheelButtons(wheelEnd + 1, Math.min(999, wheelEnd + 50));
    };

    levelWheelEl.addEventListener('scroll', wheelScrollHandler);

    // Чекаємо поки DOM відмалює кнопки, тоді скролимо до поточного рівня
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const currentBtn = [...levelWheelEl.querySelectorAll('button')].find(b => Number(b.dataset.level) === levelNumber);
      if (currentBtn) {
        // Вимикаємо smooth scroll щоб позиція була точна
        levelWheelEl.style.scrollBehavior = 'auto';
        // getBoundingClientRect точніший ніж offsetLeft бо враховує transform:scale
        const wheelRect = levelWheelEl.getBoundingClientRect();
        const btnRect = currentBtn.getBoundingClientRect();
        const btnCenter = levelWheelEl.scrollLeft + btnRect.left - wheelRect.left + btnRect.width / 2;
        levelWheelEl.scrollLeft = btnCenter - levelWheelEl.clientWidth / 2;
        // Повертаємо smooth scroll після позиціонування
        setTimeout(() => { levelWheelEl.style.scrollBehavior = ''; }, 100);
      }
    }));
  }

  // ── Level UI ─────────────────────────────────────────────
  const levelNumEl = el('levelNum');

  function refreshLevelUI() {
    if (levelNumEl) levelNumEl.textContent = String(levelNumber);
    const sep = el('gridSep');
    if (sep) sep.textContent = level?.meta?.name ? `✦ ✦ ✦  ${level.meta.name}  ✦ ✦ ✦` : '•';
  }

  // ── Timer ────────────────────────────────────────────────
  const goalBlock = el('goalBlock');

  function updateTimer() {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    if (timerEl) timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (timeLeft > 0) { timeLeft--; saveLevelState(); }
    else {
      clearInterval(timerInterval);
      if (goalBlock) goalBlock.style.opacity = '1';
      const gt = el('goalText');
      if (gt) { gt.style.visibility = 'visible'; gt.innerHTML = `<span class="goal-left">🎯 Знайди всі слова</span>`; }
    }
  }

  function startTimer() {
    if (timerStarted) clearInterval(timerInterval);
    timerStarted = true;
    levelStartTs = Date.now();
    levelStartCoins = getCoins();
    timeLeft = 120;
    if (goalBlock) goalBlock.style.opacity = '1';
    timerEl = el('timer');
    clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }

  function saveLevelState() {
    localStorage.setItem(LEVEL_STATE_KEY, JSON.stringify({ levelNumber, timeLeft, coins: getCoins() }));
  }

  // ── Dropdowns ────────────────────────────────────────────
  function bindDropdownsOnce() {
    if (dropdownsBound) return;
    dropdownsBound = true;

    const topLeft = game.querySelector('.top-left');
    const coinsMenu = game.querySelector('.coins-menu');
    const menuBtn = topLeft?.querySelector('.menu-btn');
    const coinsBtn = coinsMenu?.querySelector('.coins-btn');
    const shopModal = el('shopModal');

   el('shopBtn')?.addEventListener('click', e => {
  e.stopPropagation();
  document.querySelector('.coins-menu')?.classList.remove('open');
  shopModal?.classList.remove('hidden');
});

    function closeAll() {
      topLeft?.classList.remove('open');
      coinsMenu?.classList.remove('open');
      const grid = el('grid');
      if (grid) grid.style.pointerEvents = 'auto';
    }

    function toggle(container) {
      const willOpen = !container.classList.contains('open');
      closeAll();
      if (willOpen) {
        container.classList.add('open');
        const grid = el('grid');
        if (grid) grid.style.pointerEvents = 'none';
      }
    }

    menuBtn?.addEventListener('click', e => { e.stopPropagation(); if (topLeft) toggle(topLeft); });
    coinsBtn?.addEventListener('click', e => { e.stopPropagation(); if (coinsMenu) toggle(coinsMenu); });
    document.addEventListener('click', closeAll);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
    topLeft?.querySelector('.dropdown')?.addEventListener('click', closeAll);
    coinsMenu?.querySelector('.dropdown')?.addEventListener('click', closeAll);
  }

  // ── Settings ─────────────────────────────────────────────
  const settingsModal = el('settingsModal');
  const progressModal = el('progressModal');

  function openSettingsModal() { updateSoundUI(); settingsModal?.classList.remove('hidden'); }
  function closeSettingsModal() { settingsModal?.classList.add('hidden'); }

  function handleBackToSettings(e) {
    e.target.closest('.modal')?.classList.add('hidden');
    settingsModal?.classList.remove('hidden');
  }

  el('settingsBtn')?.addEventListener('click', openSettingsModal);
  el('closeSettingsBtn')?.addEventListener('click', () => { closeSettingsModal(); showScreen('menu'); });
  el('continueFromSettingsBtn')?.addEventListener('click', () => { closeSettingsModal(); continueGame(); });
  el('howToPlayBtn')?.addEventListener('click', () => { closeSettingsModal(); el('howToPlayModal')?.classList.remove('hidden'); });
  el('closeHowToPlayBtn')?.addEventListener('click', handleBackToSettings);
  el('soundMenuBtn')?.addEventListener('click', () => { settingsModal?.classList.add('hidden'); el('soundModal')?.classList.remove('hidden'); });
  el('closeSoundModalBtn')?.addEventListener('click', e => { el('soundModal')?.classList.add('hidden'); settingsModal?.classList.remove('hidden'); });
  el('exitSoundToMenuBtn')?.addEventListener('click', () => { el('soundModal')?.classList.add('hidden'); settingsModal?.classList.add('hidden'); continueGame(); });
  el('progressBtn')?.addEventListener('click', () => { settingsModal?.classList.add('hidden'); progressModal?.classList.remove('hidden'); });
  el('closeProgressModal')?.addEventListener('click', handleBackToSettings);

  // ── Name ─────────────────────────────────────────────────
  const playerNameEl = el('playerName');
  const nameModal = el('nameModal');
  const nameInput = el('nameInput');

  function setPlayerName(name) {
    const clean = (name || '').trim().slice(0, 20);
    if (!clean) return false;
    localStorage.setItem(NAME_KEY, clean);
    if (playerNameEl) playerNameEl.textContent = clean;
    return true;
  }

  function openNameModal() { nameModal?.classList.remove('hidden'); setTimeout(() => nameInput?.focus(), 0); }
  function closeNameModal() { nameModal?.classList.add('hidden'); }

  el('saveNameBtn')?.addEventListener('click', () => { if (setPlayerName(nameInput?.value)) closeNameModal(); });
  nameInput?.addEventListener('keydown', e => { if (e.key === 'Enter' && setPlayerName(nameInput.value)) closeNameModal(); });
  el('cancelNameBtn')?.addEventListener('click', () => { nameModal?.classList.add('hidden'); settingsModal?.classList.remove('hidden'); });
  el('changeNameBtn')?.addEventListener('click', () => { if (nameInput) nameInput.value = getPlayerName() || ''; closeSettingsModal(); openNameModal(); });

  const existingName = getPlayerName();
  if (existingName && playerNameEl) playerNameEl.textContent = existingName;
  if (!existingName) openNameModal();

  // ── Shop ─────────────────────────────────────────────────
  const shopModal = el('shopModal');
  el('closeShopBtn')?.addEventListener('click', () => shopModal?.classList.add('hidden'));
  shopModal?.addEventListener('click', e => {
    const btn = e.target.closest('.shop-pack');
    if (!btn) return;
    const amount = Number(btn.dataset.coins || 0);
    if (!amount) return;
    addCoins(amount);
    showBonusWordNotice(`+${amount}💰 додано`);
    setTimeout(() => shopModal?.classList.add('hidden'), 200);
  });

  // ── Progress ─────────────────────────────────────────────
  const BACKUP_KEYS = ['slovograi.maxLevel','slovograi.currentLevel','slovograi.coins','slovograi.playerName','slovograi.musicEnabled','slovograi.uiSoundEnabled'];

  el('resetProgressBtn')?.addEventListener('click', () => {
    if (!confirm('Скинути прогрес? Це видалить рівні, монети та імʼя.')) return;
    BACKUP_KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('slovograi.usedByLen');
    localStorage.removeItem('slovograi.levelState');
    localStorage.setItem('slovograi.currentLevel', '1');
    localStorage.setItem('slovograi.maxLevel', '3');
    setLevelNumber(1);
    setCoins(200);
    closeSettingsModal();
    showScreen('menu');
  });

  el('exportProgressBtn')?.addEventListener('click', () => {
    const data = { app: 'SLOVOSVIT', version: 1, createdAt: new Date().toISOString(), payload: {} };
    BACKUP_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) data.payload[k] = v; });
    const name = (localStorage.getItem(NAME_KEY) || 'player').replace(/[^\wа-яА-ЯіїєІЇЄ0-9_-]+/g, '_').slice(0, 20);
    const lvl = localStorage.getItem(CURRENT_LEVEL_KEY) || '1';
    const json = JSON.stringify(data, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `slovosvit_L${lvl}_${name}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  const importInput = el('importProgressInput');
  el('importProgressBtn')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file || !confirm('⚠️ Це перезапише поточний прогрес. Продовжити?')) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.app !== 'SLOVOSVIT' || !data.payload) { alert('❌ Це не файл прогресу СЛОВОСВІТ'); return; }
      BACKUP_KEYS.forEach(k => { if (k in data.payload) localStorage.setItem(k, String(data.payload[k])); });
      const cur = Number(localStorage.getItem(CURRENT_LEVEL_KEY) || 1);
      const max = Number(localStorage.getItem(PROGRESS_KEY) || 1);
      if (cur > max) localStorage.setItem(PROGRESS_KEY, String(cur));
      alert('✅ Прогрес відновлено. Перезавантажую гру...');
      location.reload();
    } catch { alert('❌ Файл не JSON'); }
    importInput.value = '';
  });

  // ── Sound ─────────────────────────────────────────────────
  const uiAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let musicVolume = Number(localStorage.getItem('slovograi.musicVolume') || 0.18);
  let uiVolume = Number(localStorage.getItem('slovograi.uiVolume') || 0.15);
  let musicEnabled = localStorage.getItem(MUSIC_KEY) ? localStorage.getItem(MUSIC_KEY) === '1' : true;
  let uiSoundEnabled = localStorage.getItem(UI_SOUND_KEY) ? localStorage.getItem(UI_SOUND_KEY) === '1' : true;
  let bgmStarted = false;

  const bgm = el('bgm');
  const PLAYLIST = [
    './assets/bgm1.mp3','./assets/bgm2.mp3','./assets/bgm3.mp3',
    './assets/bgm4.mp3','./assets/bgm5.mp3','./assets/bgm6.mp3','./assets/bgm7.mp3'
  ];
  const TRACK_KEY = 'slovograi.trackIndex';

  // Shuffle-порядок без повторів підряд
  function buildShuffledOrder() {
    const arr = PLAYLIST.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let shuffleOrder = buildShuffledOrder();
  let shufflePos = Number(localStorage.getItem(TRACK_KEY) || 0) % PLAYLIST.length;

  // Другий аудіо-елемент для crossfade
  const bgm2 = document.createElement('audio');
  bgm2.preload = 'auto';
  document.body.appendChild(bgm2);

  let activeBgm = bgm;   // який зараз грає
  let nextBgm   = bgm2;  // який готується

  function currentTrackSrc() {
    return PLAYLIST[shuffleOrder[shufflePos]];
  }

  function advanceTrack() {
    shufflePos = (shufflePos + 1) % PLAYLIST.length;
    // Якщо пройшли весь список — перемішати знову
    if (shufflePos === 0) shuffleOrder = buildShuffledOrder();
    localStorage.setItem(TRACK_KEY, String(shufflePos));
  }

  function crossfadeTo(src, targetVol) {
    nextBgm.src = src;
    nextBgm.volume = 0;
    nextBgm.load();
    nextBgm.play()?.catch(() => {});

    const duration = 2000;
    const start = performance.now();
    const fadeOut = activeBgm;
    const fadeIn  = nextBgm;
    const startVol = fadeOut.volume;

    const step = now => {
      const p = Math.min((now - start) / duration, 1);
      fadeOut.volume = startVol * (1 - p);
      fadeIn.volume  = p * targetVol;
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        fadeOut.pause();
        fadeOut.src = '';
        // міняємо ролі
        activeBgm = fadeIn;
        nextBgm   = fadeOut;
      }
    };
    requestAnimationFrame(step);
  }

  // Коли трек закінчився — crossfade до наступного
  function onTrackEnded() {
    if (!isMusicOwner() || !musicEnabled) return;
    advanceTrack();
    crossfadeTo(currentTrackSrc(), musicVolume);
  }

  bgm.addEventListener('ended',  onTrackEnded);
  bgm2.addEventListener('ended', onTrackEnded);

  // Стартуємо з того треку де зупинились
  bgm.src = currentTrackSrc();
  bgm.load();

  function playTone(freq = 440, dur = 0.12, vol = 0.15) {
    if (!uiSoundEnabled) return;
    const osc = uiAudioCtx.createOscillator();
    const gain = uiAudioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.value = vol * uiVolume;
    gain.gain.exponentialRampToValueAtTime(0.0001, uiAudioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(uiAudioCtx.destination);
    osc.start();
    osc.stop(uiAudioCtx.currentTime + dur);
  }

  const SCALE = [392, 440, 494, 523, 587, 659, 698];
  let selectionNoteIndex = 0;

  window.playSelectNote = () => { playTone(SCALE[selectionNoteIndex++ % SCALE.length], 0.09, 0.14); };
  window.playSuccess = () => { playTone(523, 0.12, 0.18); setTimeout(() => playTone(659, 0.18, 0.18), 80); };
  window.playFail = () => playTone(220, 0.18, 0.10);
  window.playBonus = () => { playTone(659, 0.12, 0.18); setTimeout(() => playTone(784, 0.18, 0.18), 80); };
  window.playLevelComplete = () => {
    playTone(523, 0.15, 0.2);
    setTimeout(() => playTone(659, 0.15, 0.2), 120);
    setTimeout(() => playTone(784, 0.22, 0.22), 240);
  };

    function fadeInBgm(targetVol = 0.14, duration = 2800) {
    if (!bgm) return;
    activeBgm.volume = 0.0001;
    activeBgm.play()?.then(() => {
      const start = performance.now();
      const step = now => {
        const p = Math.min((now - start) / duration, 1);
        activeBgm.volume = p * p * targetVol;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }).catch(() => {});
  }

  function applySoundState() {
    if (!bgm) return;
    if (!musicEnabled) { activeBgm.pause(); return; }
    if (!activeBgm.paused) return;
    fadeInBgm(musicVolume, 1200);
  }

  function setMusicEnabled(val) {
    musicEnabled = !!val;
    localStorage.setItem(MUSIC_KEY, musicEnabled ? '1' : '0');
    updateSoundUI();
    applySoundState();
  }

  function setUiSoundEnabled(val) {
    uiSoundEnabled = !!val;
    localStorage.setItem(UI_SOUND_KEY, uiSoundEnabled ? '1' : '0');
    updateSoundUI();
  }

  function setMusicVolume(v) {
    musicVolume = Math.max(0, Math.min(1, Number(v)));
    localStorage.setItem('slovograi.musicVolume', musicVolume);
    if (activeBgm) activeBgm.volume = musicVolume;
  }

  function setUiVolume(v) {
    uiVolume = Math.max(0, Math.min(1, Number(v)));
    localStorage.setItem('slovograi.uiVolume', uiVolume);
  }

  function updateSoundUI() {
    const mText = `🎵 Музика: ${musicEnabled ? 'ON' : 'OFF'}`;
    const sText = `🔊 Звуки: ${uiSoundEnabled ? 'ON' : 'OFF'}`;
    ['toggleMusicBtn','gameToggleMusicBtn'].forEach(id => { const b = el(id); if (b) b.textContent = mText; });
    ['toggleUiSoundBtn','gameToggleUiSoundBtn'].forEach(id => { const b = el(id); if (b) b.textContent = sText; });
  }

  el('toggleMusicBtn')?.addEventListener('click', () => setMusicEnabled(!musicEnabled));
  el('toggleUiSoundBtn')?.addEventListener('click', () => setUiSoundEnabled(!uiSoundEnabled));
  el('gameToggleMusicBtn')?.addEventListener('click', () => setMusicEnabled(!musicEnabled));
  el('gameToggleUiSoundBtn')?.addEventListener('click', () => setUiSoundEnabled(!uiSoundEnabled));

  const musicSlider = el('musicVolume');
  const uiSlider = el('uiVolume');
  if (musicSlider) { musicSlider.value = musicVolume; musicSlider.addEventListener('input', e => setMusicVolume(e.target.value)); }
  if (uiSlider) { uiSlider.value = uiVolume; uiSlider.addEventListener('input', e => setUiVolume(e.target.value)); }

  updateSoundUI();
  applySoundState();

  // ── Multi-tab music ──────────────────────────────────────
  window.addEventListener('storage', e => { if (e.key === TAB_KEY) applySoundState(); });
  window.addEventListener('beforeunload', () => { if (isMusicOwner()) localStorage.removeItem(TAB_KEY); });
  document.addEventListener('visibilitychange', () => {
    if (!activeBgm) return;
    if (document.hidden) activeBgm.pause();
    else if (musicEnabled && bgmStarted && isMusicOwner()) activeBgm.play()?.catch(() => {});
  });

  // ── Start ────────────────────────────────────────────────
  el('startGameBtn').onclick = async () => {
    goGame();
    bgmStarted = true;
    claimMusicOwner();
    if (isMusicOwner()) applySoundState();

    // Відновити стан таймера/монет якщо є збережений
    const savedState = localStorage.getItem(LEVEL_STATE_KEY);
    if (savedState) {
      try {
        const data = JSON.parse(savedState);
        if (typeof data.timeLeft === 'number') timeLeft = data.timeLeft;
        if (typeof data.coins === 'number') setCoins(data.coins);
      } catch {}
    }

    // initLevels сам читає LEVEL_KEY і будує правильний рівень
    const { initLevels } = await import('./level.js');
    await initLevels();

    refreshLevelUI();
    rebuildGame({ withDropdowns: true });
  };

});

if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
