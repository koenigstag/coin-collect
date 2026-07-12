export const grid = {
  columns: 10,
  rows: 10,
};

export const parts = 10;

export const createIndex = (row: number, column: number, part: number) => {
  return part * grid.rows * grid.columns + row * grid.columns + column + 1;
};

export function onIncrementClick(index: number) {
  const answer = confirm(`Подтвердите добавление монеты  в ячейку ${index}`);

  console.log(
    answer
      ? `Монета добавлена в ячейку ${index}`
      : `Добавление монеты в ячейку ${index} отменено`
  );

  if (!answer) {
    return;
  }

  const cells = getCellsFromStorage();
  incrementCellCount(cells, index);
  saveCellsToStorage(cells);
}

export function onDecrementClick(index: number) {
  const answer = confirm(`Подтвердите удаление монеты из ячейки ${index}`);

  console.log(
    answer
      ? `Монета удалена из ячейки ${index}`
      : `Удаление монеты из ячейки ${index} отменено`
  );

  if (!answer) {
    return;
  }

  const cells = getCellsFromStorage();
  decrementCellCount(cells, index);
  saveCellsToStorage(cells);
}

export function onResetClick(index: number) {
  const answer = confirm(`Подтвердите сброс монет в ячейке ${index}`);

  console.log(
    answer
      ? `Монеты сброшены в ячейке ${index}`
      : `Сброс монет в ячейке ${index} отменен`
  );

  if (!answer) {
    return;
  }

  const cells = getCellsFromStorage();
  resetCellCount(cells, index);
  saveCellsToStorage(cells);
}

export type CellData = Record<string, number>;

export function getCellsFromStorage(): CellData {
  const cellStorage = localStorage.getItem(`cells`);
  let cells: CellData = {};
  if (cellStorage) {
    cells = JSON.parse(cellStorage);
  }
  return cells;
}

export function incrementCellCount(cells: CellData, index: number | string) {
  if (cells[index]) {
    cells[index]++;
  } else {
    cells[index] = 1;
  }
}

export function decrementCellCount(cells: CellData, index: number | string) {
  if (cells[index]) {
    cells[index]--;
    if (cells[index] <= 0) {
      delete cells[index];
    }
  }
}

export function resetCellCount(cells: CellData, index: number | string) {
  if (cells[index]) {
    delete cells[index];
  }
}

export function saveCellsToStorage(cells: CellData) {
  const oldValue = getCellsFromStorage();
  localStorage.setItem(`cells`, JSON.stringify(cells));
  const event = new StorageEvent('storage', {
    key: 'cells',
    oldValue: JSON.stringify(oldValue),
    newValue: JSON.stringify(cells),
  });
  window.dispatchEvent(event);
}

export function onCellStorageChange(callback: (cells: CellData) => void) {
  window.addEventListener('storage', (event) => {
    if (event.key === 'cells') {
      const cells = getCellsFromStorage();
      callback(cells);
    }
  });
}

export function calculateTotalCoins(cells: CellData): number {
  let total = 0;
  for (const [index, coins] of Object.entries(cells)) {
    total += calculateCellCoins(cells, parseInt(index, 10));
  }
  return total;
}

export function calculatePartCoins(cells: CellData, part: number): number {
  const indexes = Object.keys(cells)
    .map((i) => parseInt(i, 10))
    .filter((index) => {
      const partStart = part * grid.rows * grid.columns + 1;
      const partEnd = (part + 1) * grid.rows * grid.columns;
      return index >= partStart && index <= partEnd;
    });

  let total = 0;
  for (const index of indexes) {
    total += calculateCellCoins(cells, index);
  }
  return total;
}

export function calculateCellCoins(cells: CellData, index: number): number {
  return cells[index] ? index * cells[index] : 0;
}

export function clearCellsInStorage() {
  saveCellsToStorage({});
}

(window as any).clearCellsInStorage = clearCellsInStorage;
