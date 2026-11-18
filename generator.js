// generator.js
import { TEMPLATES, templateName } from './templates.js';
export function generateLevel({ cols, rows, levelNumber }) {
function bandKeyForLevel(n) {
  if (n >= 1 && n <= 2) return 'L1_2';
  if (n >= 3 && n <= 14) return 'L3_14';
  if (n >= 15 && n <= 26) return 'L15_26';
  if (n >= 27 && n <= 38) return 'L27_38';
  if (n >= 39 && n <= 50) return 'L39_50';
  if (n >= 51 && n <= 62) return 'L51_62';
  if (n >= 63 && n <= 100) return 'L63_100';
  return `L${n}`;
}

  // 1️⃣ беремо шаблон
  // 1️⃣ беремо шаблон (по черзі + реверс циклом)
const list = TEMPLATES.filter(t => {
  if (t.size[0] !== rows || t.size[1] !== cols) return false;

  if (t.levels && Array.isArray(t.levels)) {
    const [a, b] = t.levels;
    return levelNumber >= a && levelNumber <= b;
  }
  return false;
});


if (!list.length) {
  throw new Error(`❌ No template for ${rows}x${cols}`);
}

// key під конкретний розмір
const band = bandKeyForLevel(levelNumber);
const [a, b] = list[0].levels; // всі templates в list мають однаковий діапазон
const key = `tplCycle_${rows}x${cols}_L${a}_${b}`;



// лічильник викликів
let n = Number(localStorage.getItem(key) || 0);
if (!Number.isFinite(n)) n = 0;

// forward на парних циклах, reverse на непарних
// ✅ спочатку всі templates по черзі
// ✅ потім переворот A→Б→В→Г і знов по черзі
const round = Math.floor(n / list.length); // скільки разів пройшли весь список templates
const idx = n % list.length;

const tpl = list[idx];

// ✅ rot змінюється раз на повний прохід усіх templates
const rot = (round % 4); // 0=A,1=Б,2=В,3=Г

// збільшуємо лічильник
localStorage.setItem(key, String(n + 1));



  function rotateXY(x, y) {
    // rot: 0=AБСД, 1=БСДА, 2=СДБА, 3=ДАБС
    if (rot === 0) return [x, y];
    if (rot === 1) return [rows - 1 - y, x];
    if (rot === 2) return [cols - 1 - x, rows - 1 - y];
    return [y, cols - 1 - x];
  }


  // 2️⃣ готуємо grid
  const grid = new Array(rows * cols).fill('');

  // 3️⃣ збираємо сегменти з шаблону
  const letterMap = {};

for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) {
    const [rx, ry] = rotateXY(x, y);
    const cell = tpl.grid[ry][rx];

    if (!cell) continue;

    // cell типу "Д1", "Д2", "Д3"
    const letter = cell[0];
    const order = Number(cell.slice(1)); 

    if (!letterMap[letter]) letterMap[letter] = [];

    letterMap[letter].push({
      order,
      index: y * cols + x
    });
  }
}

  // 4️⃣ формуємо targets (без слів, тільки форма)
  const targets = Object.values(letterMap).map((items, i) => {
  const path = items
    .sort((a, b) => a.order - b.order)   // Д1 → Д2 → Д3
    .map(o => o.index);

  return {
    id: i,
    path,              
    word: '',           
    solved: false,
  };
});



  return {
  cols,
  rows,
  grid,
  targets,
  meta: {
    tplId: tpl.id,
    rot,
    name: templateName(tpl, rot),
  }
};

}
