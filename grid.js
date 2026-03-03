import { level } from './level.js';

export function createGrid() {
  const gridEl = document.getElementById('grid');
  if (!gridEl) return;

  if (!level || !level.grid) {
    return;
  }

  gridEl.innerHTML = '';
  const cols = level.cols;

  const parent = gridEl.parentElement;

  const size = Math.min(
    parent.clientWidth,
    parent.clientHeight
  );

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
