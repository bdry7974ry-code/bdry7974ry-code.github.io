
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

  
  const band = bandKeyForLevel(levelNumber);
  const [a, b] = list[0].levels; 
  const key = `tplCycle_${rows}x${cols}_L${a}_${b}`;



  
  let n = Number(localStorage.getItem(key) || 0);
  if (!Number.isFinite(n)) n = 0;

  
  
  
  const round = Math.floor(n / list.length); 
  const idx = n % list.length;

  const tpl = list[idx];

  
  const rot = (round % 4); 

  
  localStorage.setItem(key, String(n + 1));



  function rotateXY(x, y) {
    
    if (rot === 0) return [x, y];
    if (rot === 1) return [rows - 1 - y, x];
    if (rot === 2) return [cols - 1 - x, rows - 1 - y];
    return [y, cols - 1 - x];
  }


  
  const grid = new Array(rows * cols).fill('');

  
  const letterMap = {};

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const [rx, ry] = rotateXY(x, y);
      const cell = tpl.grid[ry][rx];

      if (!cell) continue;

      
      const letter = cell[0];
      const order = Number(cell.slice(1));

      if (!letterMap[letter]) letterMap[letter] = [];

      letterMap[letter].push({
        order,
        index: y * cols + x
      });
    }
  }

  
  const targets = Object.values(letterMap).map((items, i) => {
    const path = items
      .sort((a, b) => a.order - b.order)   
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
