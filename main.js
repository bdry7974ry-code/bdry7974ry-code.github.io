import { createGrid } from './grid.js';
import { 
  bindEvents,
  bindGridDrag,
  resetForNewLevel,
  showBonusWordNotice,
  getCoins,
  setCoins,
  addCoins,
  clearCurrentSelection,
  setWordDisplayEnabled
} from './logic.js';
import { nextLevel, reloadLevel, setLevelNumber, levelNumber, level } from './level.js';



const DEV_LEVEL_WHEEL = true;
document.addEventListener('DOMContentLoaded', () => {

  let deferredPrompt;
  const installBtn = document.getElementById('installBtn');
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone;

if (isIOS && !isStandalone) {
  installBtn?.classList.remove('hidden');
}

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn?.classList.remove('hidden');
  });

  installBtn?.addEventListener('click', async () => {

  if (isIOS) {
    alert('Щоб встановити гру:\n\n1. Натисніть "Поділитися"\n2. Оберіть "На екран Додому"');
    return;
  }

  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;

  deferredPrompt = null;
  installBtn?.classList.add('hidden');

});
  const levelWheelEl = document.getElementById('levelWheel');
  const levelWheelModal = document.getElementById('levelWheelModal');
  const closeLevelWheelBtn = document.getElementById('closeLevelWheelBtn');
  const confirmLevelBtn = document.getElementById('confirmLevelBtn');
  const levelsBtn = document.getElementById('levelsBtn');
  let pendingLevel = null;
  const resultNextBtn = document.getElementById('resultNextBtn');
  const resultRetryBtn = document.getElementById('resultRetryBtn');
  const resultExitBtn = document.getElementById('resultExitBtn');
  const resultMenuBtn = document.getElementById('resultMenuBtn');
  const nextLevelBtn = document.getElementById('nextLevelBtn');
  const retryLevelBtn = document.getElementById('retryLevelBtn');
  const continueGameBtn = document.getElementById('continueGameBtn');
  const continueGameBtnCoins = document.getElementById('continueGameBtnCoins');
  const WORD_DISPLAY_KEY = 'slovograi.wordDisplay';
let wordDisplayEnabled = localStorage.getItem(WORD_DISPLAY_KEY);

if (wordDisplayEnabled === null) {
  wordDisplayEnabled = true;
} else {
  wordDisplayEnabled = wordDisplayEnabled === 'true';
}

setWordDisplayEnabled(wordDisplayEnabled);
  const toggleWordBtn = document.getElementById('toggleWordDisplayBtn');
  toggleWordBtn.textContent = wordDisplayEnabled
  ? '💬 Показ слова ✓'
  : '💬 Показ слова ✗'
  toggleWordBtn?.addEventListener('pointerup', () => {
    wordDisplayEnabled = !wordDisplayEnabled;
    toggleWordBtn.textContent = wordDisplayEnabled ? '💬 Показ слова ✓' : '💬 Показ слова ✗';
    setWordDisplayEnabled(wordDisplayEnabled);
    localStorage.setItem(WORD_DISPLAY_KEY, wordDisplayEnabled);
    const topRight = document.querySelector('.top-right');
    topRight?.classList.remove('open');
   
  });

continueGameBtnCoins?.addEventListener('click', () => {

  const coinsMenu = document.querySelector('.coins-menu');
  coinsMenu?.classList.remove('open');

  continueGame();

});
const openSettingsFromGameBtn = document.getElementById('openSettingsFromGameBtn');
 

  nextLevelBtn?.addEventListener('pointerup', async () => {
    const maxLevel = getMaxLevel();
    const next = levelNumber + 1;

    if (next > maxLevel + 1) {
      showBonusWordNotice('🔒 Рівень заблоковано');
      return;
    }

    await nextLevel();

    goGame();
    rebuildGame({ withDropdowns: false });
  });

  retryLevelBtn?.addEventListener('pointerup', async () => {
    const { reloadLevel } = await import('./level.js');
    await reloadLevel();
    goGame();
    rebuildGame({ withDropdowns: false });
  });
  openSettingsFromGameBtn?.addEventListener('click', () => {

  const topLeft = document.querySelector('.top-left');
  topLeft?.classList.remove('open');

  const settingsModal = document.getElementById('settingsModal');
  settingsModal?.classList.remove('hidden');

});
  continueGameBtn?.addEventListener('click', () => {

  const topLeft = document.querySelector('.top-left');
  topLeft?.classList.remove('open');

  continueGame();

});

  resultMenuBtn?.addEventListener('click', () => {
    showScreen('menu');
  });

  resultNextBtn?.addEventListener('pointerup', async () => {
    const maxLevel = getMaxLevel();
    const next = levelNumber + 1;

    await nextLevel();
    localStorage.setItem(CURRENT_LEVEL_KEY, levelNumber);
    goGame();
    rebuildGame({ withDropdowns: true });
  });

  resultRetryBtn?.addEventListener('pointerup', async () => {
    const { reloadLevel } = await import('./level.js');
    await reloadLevel();
    goGame();
    rebuildGame({ withDropdowns: true });
  });


  resultExitBtn?.addEventListener('click', () => {
    showScreen('menu');
  });


  levelsBtn?.addEventListener('click', () => {
    if (!DEV_LEVEL_WHEEL) return;
    levelWheelModal?.classList.remove('hidden');
    renderLevelWheel();
  });


  closeLevelWheelBtn?.addEventListener('click', () => {
    levelWheelModal?.classList.add('hidden');
  });

  confirmLevelBtn?.addEventListener('click', async () => {
    if (!pendingLevel) return;

    const maxLevel = getMaxLevel();
    if (pendingLevel > getMaxLevel() + 1) {
      showBonusWordNotice('🔒 Рівень заблоковано');
      return;
    }

    setLevelNumber(pendingLevel);
    localStorage.setItem(CURRENT_LEVEL_KEY, pendingLevel);
    pendingLevel = null;

    levelWheelModal?.classList.add('hidden');
    levelWheelEl.scrollLeft = 0;

    goGame();

    const { initLevels } = await import('./level.js');
    await initLevels();

    rebuildGame({ withDropdowns: true });
  });
  const PROGRESS_KEY = 'slovograi.maxLevel';
  const CURRENT_LEVEL_KEY = 'slovograi.currentLevel';
  const LEVEL_STATE_KEY = 'slovograi.levelState';
  function getMaxLevel() {
    return Number(localStorage.getItem(PROGRESS_KEY) || 3) || 3;
  }

  function setMaxLevel(n) {
    const v = Math.max(3, Math.floor(Number(n) || 3));
    localStorage.setItem(PROGRESS_KEY, String(v));
    return v;
  }



  const menu = document.getElementById('menu-screen');
  const game = document.getElementById('game-screen');
  const startBtn = document.getElementById('startGameBtn');

  const result = document.getElementById('result-screen');
  function closeAllModals() {
    document.getElementById('levelWheelModal')?.classList.add('hidden');
    document.getElementById('settingsModal')?.classList.add('hidden');
    document.getElementById('howToPlayModal')?.classList.add('hidden');
    document.getElementById('shopModal')?.classList.add('hidden');
    document.getElementById('nameModal')?.classList.add('hidden');
  }


  function showScreen(which) {
    menu?.classList.remove('active');
    game?.classList.remove('active');
    result?.classList.remove('active');

    if (which === 'menu') menu?.classList.add('active');
    if (which === 'game') game?.classList.add('active');
    if (which === 'result') result?.classList.add('active');
  }
  function goGame() {
    closeAllModals();
    showScreen('game');
  }
  async function continueGame() {

  const savedLevel = Number(localStorage.getItem(CURRENT_LEVEL_KEY));
  if (savedLevel) {
    setLevelNumber(savedLevel);
  }

  const { initLevels } = await import('./level.js');
  await initLevels();

  goGame();

  const grid = document.getElementById('grid');

  if (!grid || grid.children.length === 0) {
    rebuildGame({ withDropdowns: true });
  }

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

    const lvl = document.getElementById('resultLevelNum');
    if (lvl) lvl.textContent = String(levelNumber);
    const nextLvl = document.getElementById('resultNextLevelNum');
    if (nextLvl) nextLvl.textContent = String(levelNumber + 1);

    const retryLvl = document.getElementById('resultRetryLevelNum');
    if (retryLvl) retryLvl.textContent = String(levelNumber);


    const coinsTotal = document.getElementById('resultCoinsTotal');
    const coinsNow = document.getElementById('coins');
    if (coinsTotal && coinsNow) coinsTotal.textContent = coinsNow.textContent;


    const t = document.getElementById('resultTime');
    const f = document.getElementById('resultFound');
    const e = document.getElementById('resultEarned');
    if (t) t.textContent = timeText;
    if (f) f.textContent = String(found);
    if (e) e.textContent = String(earned);

    showScreen('result');
  }
  document.addEventListener('slovograi:levelComplete', () => {

    const completedLevel = levelNumber;
    const maxLevel = getMaxLevel();

    if (completedLevel >= maxLevel) {
  setMaxLevel(Math.min(completedLevel + 1, 9999));
}

    const sec = Math.round((Date.now() - levelStartTs) / 1000);
    const timeText = formatTimeSec(sec);

    const found = level?.targets?.filter(t => t.solved).length || 0;
    const earned = Math.max(0, getCoins() - levelStartCoins);

    showResultScreen({ timeText, found, earned });
    localStorage.removeItem(LEVEL_STATE_KEY);
  });


  const existingCoins = localStorage.getItem('slovograi.coins');

  if (existingCoins === null) {
    setCoins(200);
  } else {
    setCoins(Number(existingCoins) || 0);
  }
  let timerEl = document.getElementById('timer');


  const exitBtn = document.getElementById('exitBtn');
  const exitBtn2 = document.getElementById('exitBtn2');

  function handleBackToSettings(e) {

  const settingsModal = document.getElementById('settingsModal');
  const modal = e.target.closest('.modal');

  if (modal) modal.classList.add('hidden');

  settingsModal?.classList.remove('hidden');

}

  exitBtn?.addEventListener('click', () => {
  showScreen('menu');
});

exitBtn2?.addEventListener('click', () => {
  showScreen('menu');
});

  const settingsBtn = document.getElementById('settingsBtn');
const soundMenuBtn = document.getElementById('soundMenuBtn');
const soundModal = document.getElementById('soundModal');

const closeSoundModalBtn = document.getElementById('closeSoundModalBtn');
closeSoundModalBtn?.addEventListener('click', handleBackToSettings);
soundMenuBtn?.addEventListener('click', () => {
  const settingsModal = document.getElementById('settingsModal');
  const soundMenuBtn = document.getElementById('soundMenuBtn');
  settingsModal?.classList.add('hidden');
  soundModal?.classList.remove('hidden');
});
const exitSoundToMenuBtn = document.getElementById('exitSoundToMenuBtn');

exitSoundToMenuBtn?.addEventListener('click', () => {

  document.getElementById('soundModal')?.classList.add('hidden');
  document.getElementById('settingsModal')?.classList.add('hidden');

  continueGame();

});

closeSoundModalBtn?.addEventListener('click', () => {
  const settingsModal = document.getElementById('settingsModal');

  soundModal?.classList.add('hidden');
  settingsModal?.classList.remove('hidden');
});


  const levelNumEl = document.getElementById('levelNum');


  function refreshLevelUI() {
    if (levelNumEl) levelNumEl.textContent = String(levelNumber);

    const sep = document.getElementById('gridSep');
    if (!sep) return;

    const name = level?.meta?.name;
    sep.textContent = name ? `✦ ✦ ✦  ${name}  ✦ ✦ ✦` : '•';
  }


  let wheelEnd = 0;


  function addWheelButtons(from, to) {
    const maxLevel = getMaxLevel();
    for (let i = from; i <= to; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.dataset.level = i;

      if (i === levelNumber) btn.classList.add('current');
      if (i > maxLevel + 1) btn.classList.add('locked');

      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.15)';
      });
      btn.addEventListener('mouseleave', () => {
        if (!btn.classList.contains('current')) btn.style.transform = 'scale(1)';
      });
      btn.onclick = () => {
        if (i > getMaxLevel() + 1) {
          btn.classList.add('locked');
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

  let wheelScrollHandler = null;

  function renderLevelWheel() {
    if (!DEV_LEVEL_WHEEL || !levelWheelEl) return;
    levelWheelEl.innerHTML = '';
    wheelEnd = 0;

    const current = levelNumber;

    // Завжди починаємо з 1, перші 50 рівнів
    addWheelButtons(1, 50);

    levelWheelEl.onwheel = (e) => {
      e.preventDefault();
      levelWheelEl.scrollLeft += e.deltaY;
    };

    // Видаляємо старий scroll listener щоб не накопичувались
    if (wheelScrollHandler) {
      levelWheelEl.removeEventListener('scroll', wheelScrollHandler);
    }

    let wheelInitialized = false;

    wheelScrollHandler = () => {
      if (!wheelInitialized) return;
      if (!levelWheelModal || levelWheelModal.classList.contains('hidden')) return;

      if (wheelEnd >= 999) return;

      // Додаємо ще 50 тільки коли скролимо близько до кінця
      const allBtns = levelWheelEl.querySelectorAll('button');
      const lastBtn = allBtns[allBtns.length - 1];
      if (!lastBtn) return;

      const scrollRight = levelWheelEl.scrollLeft + levelWheelEl.clientWidth;
      const lastBtnRight = lastBtn.offsetLeft + lastBtn.offsetWidth;

      if (lastBtnRight - scrollRight < lastBtn.offsetWidth * 5) {
        addWheelButtons(wheelEnd + 1, Math.min(999, wheelEnd + 50));
      }
    };

    levelWheelEl.addEventListener('scroll', wheelScrollHandler);

    // Якщо current > 50 — докидаємо кнопки щоб він був видимий
    if (current > wheelEnd) {
      const neededEnd = Math.ceil(current / 50) * 50;
      addWheelButtons(wheelEnd + 1, Math.min(999, neededEnd));
    }

    const currentBtn = [...levelWheelEl.querySelectorAll('button')]
      .find(b => Number(b.dataset.level) === current);

   if (currentBtn) {
      setTimeout(() => {
        const offset = currentBtn.offsetLeft - (levelWheelEl.offsetLeft) - levelWheelEl.clientWidth / 2 + currentBtn.offsetWidth / 2;
        levelWheelEl.scrollLeft = Math.max(0, offset);
        wheelInitialized = true;
      }, 150);
    }
  }


  const bgm = document.getElementById('bgm');
  bgm?.addEventListener('ended', () => {

  if (!isMusicOwner()) return;

  loadTrack(trackIndex + 1);

  bgm.currentTime = 0;

  const p = bgm.play();
  if (p && typeof p.catch === 'function') p.catch(()=>{});

});

  const PLAYLIST = [
    './assets/bgm1.mp3',
    './assets/bgm2.mp3',
    './assets/bgm3.mp3',
    './assets/bgm4.mp3',
    './assets/bgm5.mp3',
    './assets/bgm6.mp3',
    './assets/bgm7.mp3',
  ];
  let trackIndex = 0;
  loadTrack(0);
  function loadTrack(index) {
    if (!bgm) return;

    trackIndex = (index + PLAYLIST.length) % PLAYLIST.length;
    bgm.src = PLAYLIST[trackIndex];
    bgm.load();
  }


  const uiAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let musicVolume = Number(localStorage.getItem('slovograi.musicVolume') || 0.18);
  let uiVolume = Number(localStorage.getItem('slovograi.uiVolume') || 0.15);
  let uiSoundEnabled = true;

  const MUSIC_KEY = 'slovograi.musicEnabled';
  const UI_SOUND_KEY = 'slovograi.uiSoundEnabled';

  let musicEnabled = localStorage.getItem(MUSIC_KEY)
    ? localStorage.getItem(MUSIC_KEY) === '1'
    : true;

  uiSoundEnabled = localStorage.getItem(UI_SOUND_KEY)
    ? localStorage.getItem(UI_SOUND_KEY) === '1'
    : true;

  let bgmStarted = false;


  function playTone(freq = 440, duration = 0.12, volume = 0.15) {
    if (!uiSoundEnabled) return;

    const osc = uiAudioCtx.createOscillator();
    const gain = uiAudioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    gain.gain.value = volume * uiVolume;
    gain.gain.exponentialRampToValueAtTime(0.0001, uiAudioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(uiAudioCtx.destination);

    osc.start();
    osc.stop(uiAudioCtx.currentTime + duration);
  }


  const SCALE = [392, 440, 494, 523, 587, 659, 698];
  let selectionNoteIndex = 0;


  function playSelectNote() {
    const f = SCALE[selectionNoteIndex % SCALE.length];
    selectionNoteIndex++;
    playTone(f, 0.09, 0.14);
  }

  window.playSelectNote = playSelectNote;


  function playSuccess() {
    playTone(523, 0.12, 0.18);
    setTimeout(() => playTone(659, 0.18, 0.18), 80);
  }
  window.playSuccess = playSuccess;

  function playFail() {
    playTone(220, 0.18, 0.10);
  }
  window.playFail = playFail;
  function playBonus() {
    playTone(659, 0.12, 0.18);
    setTimeout(() => playTone(784, 0.18, 0.18), 80);
  }
  window.playBonus = playBonus;
  function playLevelComplete() {
    playTone(523, 0.15, 0.2);
    setTimeout(() => playTone(659, 0.15, 0.2), 120);
    setTimeout(() => playTone(784, 0.22, 0.22), 240);
  }
  window.playLevelComplete = playLevelComplete;





  const TAB_KEY = 'slovograi.musicOwner';
  const tabId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function claimMusicOwner() {
    localStorage.setItem(TAB_KEY, tabId);
  }
  function isMusicOwner() {
    return localStorage.getItem(TAB_KEY) === tabId;
  }


  window.addEventListener('beforeunload', () => {
    if (isMusicOwner()) localStorage.removeItem(TAB_KEY);
  });



  let timeLeft = 120;
  let timerInterval;
  let timerStarted = false;
  let levelStartTs = Date.now();
  let levelStartCoins = getCoins();

  function formatTimeSec(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  let dropdownsBound = false;


  const NAME_KEY = 'slovograi.playerName';
  const playerNameEl = document.getElementById('playerName');
  const nameModal = document.getElementById('nameModal');
  const nameInput = document.getElementById('nameInput');
  const saveNameBtn = document.getElementById('saveNameBtn');
  const cancelNameBtn = document.getElementById('cancelNameBtn');

  function getPlayerName() {
    return localStorage.getItem(NAME_KEY);
  }

  function setPlayerName(name) {
    const clean = (name || '').trim().slice(0, 20);
    if (!clean) return false;
    localStorage.setItem(NAME_KEY, clean);
    if (playerNameEl) playerNameEl.textContent = clean;
    return true;
  }

  function openNameModal() {
    if (!nameModal) return;
    nameModal.classList.remove('hidden');
    setTimeout(() => nameInput?.focus(), 0);
  }

  function closeNameModal() {
    nameModal?.classList.add('hidden');
  }


  const shopModal = document.getElementById('shopModal');
  const closeShopBtn = document.getElementById('closeShopBtn');

  function openShopModal() {
    if (!shopModal) return;
    shopModal.classList.remove('hidden');
  }


  function closeShopModal() {
    shopModal?.classList.add('hidden');
  }

  closeShopBtn?.addEventListener('click', closeShopModal);


  shopModal?.addEventListener('click', (e) => {
    const btn = e.target.closest('.shop-pack');
    if (!btn) return;
    const amount = Number(btn.dataset.coins || 0);
    if (!amount) return;

    addCoins(amount);
    showBonusWordNotice(`+${amount}💰 додано`);
    setTimeout(closeShopModal, 200);

  });


  const existingName = getPlayerName();
  if (existingName) {
    if (playerNameEl) playerNameEl.textContent = existingName;
  }


  saveNameBtn?.addEventListener('click', () => {
    if (setPlayerName(nameInput?.value)) closeNameModal();
  });

  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (setPlayerName(nameInput.value)) closeNameModal();
    }
  });

  cancelNameBtn?.addEventListener('click', () => {
  nameModal.classList.add('hidden');
  settingsModal?.classList.remove('hidden');
});
  if (!existingName) openNameModal();


  const settingsModal = document.getElementById('settingsModal');
  const progressModal = document.getElementById('progressModal');
  const progressBtn = document.getElementById('progressBtn');
  const closeProgressModal = document.getElementById('closeProgressModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const changeNameBtn = document.getElementById('changeNameBtn');
  const resetProgressBtn = document.getElementById('resetProgressBtn');
  const toggleMusicBtn = document.getElementById('toggleMusicBtn');
  const toggleUiSoundBtn = document.getElementById('toggleUiSoundBtn');
  const gameToggleMusicBtn = document.getElementById('gameToggleMusicBtn');
  const gameToggleUiSoundBtn = document.getElementById('gameToggleUiSoundBtn');
  const howToPlayModal = document.getElementById('howToPlayModal');
  const howToPlayBtn = document.getElementById('howToPlayBtn');
  const closeHowToPlayBtn = document.getElementById('closeHowToPlayBtn');
  closeHowToPlayBtn?.addEventListener('click', handleBackToSettings);
  closeProgressModal?.addEventListener('click', handleBackToSettings);


  const exportProgressBtn = document.getElementById('exportProgressBtn');
  const importProgressBtn = document.getElementById('importProgressBtn');
  const importProgressInput = document.getElementById('importProgressInput');

  const BACKUP_KEYS = [
  'slovograi.maxLevel',
  'slovograi.currentLevel',
  'slovograi.coins',
  'slovograi.playerName',
  'slovograi.musicEnabled',
  'slovograi.uiSoundEnabled'
];

  function buildProgressBackup() {
    const data = {
      app: 'SLOVOSVIT',
      version: 1,
      createdAt: new Date().toISOString(),
      payload: {}
    };

    for (const k of BACKUP_KEYS) {
      const v = localStorage.getItem(k);
      if (v !== null) data.payload[k] = v;
    }
    return data;
  }

  function downloadJson(filename, obj) {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportProgress() {
    const data = buildProgressBackup();

    const name = (localStorage.getItem('slovograi.playerName') || 'player')
      .replace(/[^\wа-яА-ЯіїєІЇЄ0-9_-]+/g, '_')
      .slice(0, 20);

    const level = localStorage.getItem('slovograi.currentLevel') || '1';
const date = new Date().toISOString().slice(0,10);

const filename = `slovosvit_L${level}_${name}_${date}.json`;
    downloadJson(filename, data);
  }

  async function importProgressFromFile(file) {
    const text = await file.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      alert('❌ Файл не JSON');
      return;
    }

    if (!data || data.app !== 'SLOVOSVIT' || !data.payload) {
      alert('❌ Це не файл прогресу СЛОВОСВІТ');
      return;
    }


    for (const k of BACKUP_KEYS) {
  if (k in data.payload) {
    localStorage.setItem(k, String(data.payload[k]));
  }
}

const cur = Number(localStorage.getItem('slovograi.currentLevel') || 1);
const max = Number(localStorage.getItem('slovograi.maxLevel') || 1);

if (cur > max) {
  localStorage.setItem('slovograi.maxLevel', String(cur));
}


    alert('✅ Прогрес відновлено. Перезавантажую гру...');
    location.reload();
  }

  exportProgressBtn?.addEventListener('click', exportProgress);

  importProgressBtn?.addEventListener('click', () => {
    importProgressInput?.click();
  });

  importProgressInput?.addEventListener('change', async () => {
    const file = importProgressInput.files?.[0];
    if (!file) return;
    if (!confirm("⚠️ Це перезапише поточний прогрес. Продовжити?")) return;

await importProgressFromFile(file);
    importProgressInput.value = '';
  });
  progressBtn?.addEventListener('click', () => {
    settingsModal?.classList.add('hidden');
    progressModal?.classList.remove('hidden');
  });

  closeProgressModal?.addEventListener('click', () => {
    progressModal?.classList.add('hidden');
  });


  function playCurrentTrack() {
    if (!bgm) return;


    if (!musicEnabled || !bgmStarted) {
      bgm.pause();
      return;
    }


    if (!isMusicOwner()) {
      bgm.pause();
      return;
    }


    if (!bgm.paused) return;

    const p = bgm.play();
    if (p && typeof p.catch === 'function') p.catch(() => { });
  }


  function updateSoundUI() {
    const musicText = `🎵 Музика: ${musicEnabled ? 'ON' : 'OFF'}`;
    const soundText = `🔊 Звуки: ${uiSoundEnabled ? 'ON' : 'OFF'}`;

    if (toggleMusicBtn) toggleMusicBtn.textContent = musicText;
    if (toggleUiSoundBtn) toggleUiSoundBtn.textContent = soundText;

    if (gameToggleMusicBtn) gameToggleMusicBtn.textContent = musicText;
    if (gameToggleUiSoundBtn) gameToggleUiSoundBtn.textContent = soundText;
  }




  function fadeInBgm(targetVolume = 0.14, duration = 2800) {

  if (!bgm) return;

  bgm.volume = 0.0001;

  const playPromise = bgm.play();

  if (playPromise && typeof playPromise.then === 'function') {

    playPromise.then(() => {

      const start = performance.now();

      function step(now) {

        const progress = Math.min((now - start) / duration, 1);

        // smoother curve
        const eased = progress * progress;

        bgm.volume = eased * targetVolume;

        if (progress < 1) {
          requestAnimationFrame(step);
        }

      }

      requestAnimationFrame(step);

    }).catch(()=>{});

  }

}

  function applySoundState() {

  if (!bgm) return;

  if (!musicEnabled) {
    bgm.pause();
    return;
  }

   if (!bgm.paused) return;

  fadeInBgm(musicVolume, 1200);

}
  function setMusicVolume(v){
  musicVolume = Math.max(0, Math.min(1, Number(v)));
  localStorage.setItem('slovograi.musicVolume', musicVolume);
  if (bgm) bgm.volume = musicVolume;
}

function setUiVolume(v){
  uiVolume = Math.max(0, Math.min(1, Number(v)));
  localStorage.setItem('slovograi.uiVolume', uiVolume);
}
const musicSlider = document.getElementById('musicVolume');
const uiSlider = document.getElementById('uiVolume');

if (musicSlider) {
  musicSlider.value = musicVolume;

  musicSlider.addEventListener('input', (e) => {
    setMusicVolume(e.target.value);
  });
}

if (uiSlider) {
  uiSlider.value = uiVolume;

  uiSlider.addEventListener('input', (e) => {
    setUiVolume(e.target.value);
  });
}

  function setMusicEnabled(value) {
    musicEnabled = !!value;
    localStorage.setItem(MUSIC_KEY, musicEnabled ? '1' : '0');
    updateSoundUI();
    applySoundState();
  }

  function setUiSoundEnabled(value) {
    uiSoundEnabled = !!value;
    localStorage.setItem(UI_SOUND_KEY, uiSoundEnabled ? '1' : '0');
    updateSoundUI();
  }



  function openSettingsModal() {
    if (!settingsModal) return;
    updateSoundUI();
    settingsModal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    settingsModal?.classList.add('hidden');
  }

  settingsBtn?.addEventListener('click', openSettingsModal);
  
  closeSettingsBtn?.addEventListener('click', () => {
  closeSettingsModal();
  showScreen('menu');
});

  resetProgressBtn?.addEventListener('click', () => {
    if (!confirm('Скинути прогрес? Це видалить рівні, монети та ім’я.')) return;

    const KEYS_TO_REMOVE = [
      'slovograi.maxLevel',
      'slovograi.currentLevel',
      'slovograi.levelState',
      'slovograi.coins',
      'slovograi.playerName',
      'slovograi.musicEnabled',
      'slovograi.uiSoundEnabled'
    ];

    KEYS_TO_REMOVE.forEach(k => localStorage.removeItem(k));
    setLevelNumber(1);
    setCoins(200);
    closeSettingsModal();
    showScreen('menu');
  });


  changeNameBtn?.addEventListener('click', () => {
    const current = getPlayerName() || '';
    if (nameInput) nameInput.value = current;
    closeSettingsModal();
    openNameModal();
  });


  toggleMusicBtn?.addEventListener('click', () => {
    setMusicEnabled(!musicEnabled);
  });

  toggleUiSoundBtn?.addEventListener('click', () => {
    setUiSoundEnabled(!uiSoundEnabled);
  });
  gameToggleMusicBtn?.addEventListener('click', () => {
    setMusicEnabled(!musicEnabled);
  });

  gameToggleUiSoundBtn?.addEventListener('click', () => {
    setUiSoundEnabled(!uiSoundEnabled);
  });



  howToPlayBtn?.addEventListener('click', () => {
    closeSettingsModal();
    howToPlayModal?.classList.remove('hidden');
  });

 

  updateSoundUI();
  applySoundState();


  function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    if (timerEl) timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft > 0) {
      timeLeft--;
      saveLevelState();
    }
    else {
      clearInterval(timerInterval);


      const goalBlock = document.getElementById('goalBlock');
      const goalText = document.getElementById('goalText');


      if (goalBlock) goalBlock.style.opacity = '1';

      if (goalText) {
        goalText.style.visibility = 'visible';
        goalText.innerHTML = `<span class="goal-left">🎯 Знайди всі слова</span>`;
      }
    }
  }

  function startTimer() {
    if (timerStarted) clearInterval(timerInterval);
    timerStarted = true;
    levelStartTs = Date.now();
    levelStartCoins = getCoins();

    timeLeft = 120;

    if (goalBlock) goalBlock.style.opacity = '1';
    timerEl = document.getElementById('timer');

    clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }
  function saveLevelState() {
    const state = {
      levelNumber,
      timeLeft,
      coins: getCoins()
    };

    localStorage.setItem(LEVEL_STATE_KEY, JSON.stringify(state));
  }



  function bindDropdownsOnce() {
    if (dropdownsBound) return;
    dropdownsBound = true;

    const topLeft = game.querySelector('.top-left');
    const coinsMenu = game.querySelector('.coins-menu');

    const menuBtn = topLeft?.querySelector('.menu-btn');
    const coinsBtn = coinsMenu?.querySelector('.coins-btn');

    const shopBtn = document.getElementById('shopBtn');
    shopBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      shopModal?.classList.toggle('hidden');
    });


    function closeAll() {

  const grid = document.getElementById('grid');

  topLeft?.classList.remove('open');
  coinsMenu?.classList.remove('open');

  if (grid) grid.style.pointerEvents = 'auto';

}

    function toggle(container) {

  const grid = document.getElementById('grid');

  const willOpen = !container.classList.contains('open');

  closeAll();

  if (willOpen) {
    container.classList.add('open');

    if (grid) grid.style.pointerEvents = 'none';
  } else {
    if (grid) grid.style.pointerEvents = 'auto';
  }

}

    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (topLeft) toggle(topLeft);
    });

    coinsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (coinsMenu) toggle(coinsMenu);
    });

    document.addEventListener('click', closeAll);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });

    topLeft?.querySelector('.dropdown')?.addEventListener('click', closeAll);
    coinsMenu?.querySelector('.dropdown')?.addEventListener('click', closeAll);
  }





 startBtn.onclick = async () => {
    const savedLevel = Number(localStorage.getItem(CURRENT_LEVEL_KEY));
    const savedState = localStorage.getItem(LEVEL_STATE_KEY);

    if (savedLevel && savedLevel > 0) {
      setLevelNumber(savedLevel);
      if (savedState) {
        try {
          const data = JSON.parse(savedState);
          if (typeof data.timeLeft === 'number') timeLeft = data.timeLeft;
          if (typeof data.coins === 'number') setCoins(data.coins);
        } catch { }
      }
    } else {
      setLevelNumber(1);
    }
    goGame();


    bgmStarted = true;

claimMusicOwner();

if (isMusicOwner()) {

  if (!bgm.src) {
    loadTrack(0);
  }

  applySoundState();

}

const { initLevels } = await import('./level.js');
    await initLevels();

    // Якщо після скидання немає збереженого рівня — примусово ставимо 1
    if (!Number(localStorage.getItem(CURRENT_LEVEL_KEY))) {
      setLevelNumber(1);
    }

    refreshLevelUI();
    rebuildGame({ withDropdowns: true });
  };


  window.addEventListener('storage' , (e) => {
    if (e.key === TAB_KEY) applySoundState();
  });
  document.addEventListener('visibilitychange', () => {

  if (!bgm) return;

  if (document.hidden) {
    bgm.pause();
  } else {

    if (musicEnabled && bgmStarted && isMusicOwner()) {
      const p = bgm.play();
      if (p && typeof p.catch === 'function') p.catch(()=>{});
    }

  }

});


});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js');
  });
}