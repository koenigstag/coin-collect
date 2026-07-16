import { renderGrid } from './grid';
import { CellData, getCellsFromStorage, onCellStorageChange } from './logic';
import { renderSettingsButton } from './settingsPanel';
import { initSync } from './sync';

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

  if (!rootElement) {
    throw new Error('Root element not found');
  }

  renderSettingsButton(rootElement);

  // rerender strategy
  onCellStorageChange(render);

  // first render
  render(getCellsFromStorage());

  try {
    initSync();
  } catch (err) {
    console.error('Sync: initialization failed', err);
  }
}
