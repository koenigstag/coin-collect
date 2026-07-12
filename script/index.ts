import { renderGrid } from './grid';
import { CellData, getCellsFromStorage, onCellStorageChange } from './logic';

export default function main(rootElement: HTMLElement | null) {
  let renderTick = 0;

  function render(cells: CellData) {
    renderTick++;

    if (!rootElement) {
      throw new Error('Root element not found');
    }

    console.debug('Render', renderTick);

    renderGrid(rootElement, cells);
  }

  // rerender strategy
  onCellStorageChange(render);

  // first render
  render(getCellsFromStorage());
}
