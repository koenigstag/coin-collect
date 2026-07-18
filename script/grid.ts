import {
  calculateCellCoins,
  calculatePartCoins,
  calculateTotalCoins,
  CellData,
  createIndex,
  getCellsFromStorage,
  grid,
  onDecrementClick,
  onIncrementClick,
  onResetClick,
  parts,
} from './logic';

let currentCellIndex = 0;

// One fixed hue per part (validated for adjacent-pair colorblind separation
// and lightness/chroma) so a maxed-out cell (10+ coins) reads by which part
// it's in, not just as generic "full".
const PART_COLORS = [
  '#2a78d6', // 1: blue
  '#008300', // 2: green
  '#e87ba4', // 3: magenta
  '#eda100', // 4: yellow
  '#1baf7a', // 5: aqua
  '#eb6834', // 6: orange
  '#4a3aa7', // 7: violet
  '#e34948', // 8: red
  '#92400e', // 9: brown
  '#86198f', // 10: plum
];

export const createGrid = (part: number, cells: CellData) => {
  const gridElement = document.createElement('div');
  gridElement.className = 'grid';

  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const index = createIndex(row, column, part);
      const cellElement = document.createElement('div');

      cellElement.className = 'cell';
      cellElement.dataset.index = index.toString();
      cellElement.dataset.row = row.toString();
      cellElement.dataset.column = column.toString();
      cellElement.innerText = index.toString();

      if (cells[index]) {
        cellElement.style.setProperty('--count', cells[index].toString());

        if (cells[index] >= 10) {
          cellElement.classList.add('cell--full');
          cellElement.style.setProperty('--part-color', PART_COLORS[part % PART_COLORS.length]);
        }

        const countElement = document.createElement('span');
        countElement.className = 'count';
        countElement.innerText = cells[index].toString();
        cellElement.appendChild(countElement);
      }

      gridElement.appendChild(cellElement);

      cellElement.addEventListener('click', () => {
        console.log(`Cell ${index} clicked`);
        currentCellIndex = index;
        openCellSettingsSheet(index);
      });
    }
  }

  return gridElement;
};

export const createPart = (part: number, cells: CellData) => {
  const partElement = document.createElement('div');
  partElement.className = 'part';
  const header = document.createElement('h2');
  const partCoins = calculatePartCoins(cells, part);
  header.innerText = `Часть ${part + 1} - Итого: ${partCoins}`;
  partElement.appendChild(header);
  partElement.appendChild(createGrid(part, cells));
  return partElement;
};

export function renderGrid(root: HTMLElement, cells: CellData) {
  root.innerHTML = '';
  for (let part = 0; part < parts; part++) {
    const partElement = createPart(part, cells);
    if (partElement) {
      root.appendChild(partElement);
    }
  }

  root.appendChild(document.createElement('hr'));
  const totalCoins = calculateTotalCoins(cells);
  const totalElement = document.createElement('div');
  totalElement.className = 'total';
  totalElement.innerText = `Общее количество монет: ${totalCoins}`;
  root.appendChild(totalElement);

  renderCellSettingsSheet(currentCellIndex);
}

function openCellSettingsSheet(index: number) {
  const sheetElement = document.querySelector<HTMLDivElement>('.bottom-sheet');
  if (!sheetElement) {
    throw new Error('Bottom sheet element not found');
  }

  renderCellSettingsSheet(index);

  sheetElement.style.display = 'block';
}

function renderCellSettingsSheet(index: number) {
  const modalsElement = document.getElementById('modals');
  if (!modalsElement) {
    throw new Error('Modals element not found');
  }

  let sheetElement: HTMLDivElement | null =
    modalsElement.querySelector<HTMLDivElement>('.bottom-sheet');
  if (!sheetElement) {
    console.log('Creating new bottom sheet element');
    sheetElement = document.createElement('div');
    sheetElement.className = 'bottom-sheet';
    modalsElement.appendChild(sheetElement);
  }

  sheetElement.innerHTML = '';

  const header = document.createElement('h2');
  header.innerText = `Настройки ячейки ${index}`;
  sheetElement.appendChild(header);

  const closeButton = document.createElement('button');
  closeButton.innerText = 'X';
  closeButton.className = 'close-button';
  sheetElement.appendChild(closeButton);
  closeButton.addEventListener('click', () => {
    sheetElement.style.display = 'none';
  });

  const countTotal = document.createElement('div');
  countTotal.className = 'count-total';
  const cells = getCellsFromStorage();
  const totalCoins = calculateCellCoins(cells, index);
  countTotal.innerText = `Итого расчет: ${totalCoins}`;
  sheetElement.appendChild(countTotal);

  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'buttons-container';
  sheetElement.appendChild(buttonsContainer);

  const addButton = document.createElement('button');
  addButton.innerText = 'Добавить 1';
  addButton.className = 'add-button';
  buttonsContainer.appendChild(addButton);

  addButton.addEventListener('click', () => {
    onIncrementClick(index);
  });

  const removeButton = document.createElement('button');
  removeButton.innerText = 'Удалить 1';
  removeButton.className = 'remove-button';
  buttonsContainer.appendChild(removeButton);

  removeButton.addEventListener('click', () => {
    onDecrementClick(index);
  });

  const resetButton = document.createElement('button');
  resetButton.innerText = 'Сбросить';
  resetButton.className = 'reset-button';
  buttonsContainer.appendChild(resetButton);

  resetButton.addEventListener('click', () => {
    onResetClick(index);
  });
}
