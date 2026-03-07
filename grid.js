import { level } from './level.js';

export async function createGrid() {

  const gridEl = document.getElementById('grid');
  if (!gridEl) return;

  if (!level || !level.grid) {
    return;
  }

  gridEl.innerHTML = '';
  const cols = level.cols;

  const parent = gridEl.parentElement; // .game-card

  // Чекаємо реальний розмір після render
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => requestAnimationFrame(r));

  // Беремо розмір безпосередньо від game-card
  const availW = parent.clientWidth;
  const availH = parent.clientHeight;

  const padding = 4;
  const size = Math.min(availW, availH) - padding * 2;

  const cellSize = Math.floor(size / cols);



  gridEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  gridEl.style.gridAutoRows = `${cellSize}px`;



  level.grid.forEach((letter, index) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.textContent = letter;
    cell.dataset.index = String(index);
    gridEl.appendChild(cell);
  });

  const targetEl = document.getElementById('target-word');
  if (targetEl) {
    targetEl.textContent = level.targets[0]?.word || '';
  }

}
