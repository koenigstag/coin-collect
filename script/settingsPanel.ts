import { clearSyncConfig, getSyncConfig, saveSyncConfig } from './sync';

export function renderSettingsButton(rootElement: HTMLElement) {
  const button = document.createElement('button');
  button.className = 'settings-button';
  button.innerText = '⚙';
  button.title = 'Настройки синхронизации';
  button.addEventListener('click', openSettingsSheet);

  rootElement.parentElement?.insertBefore(button, rootElement);
}

function openSettingsSheet() {
  const modalsElement = document.getElementById('modals');
  if (!modalsElement) {
    throw new Error('Modals element not found');
  }

  let sheetElement =
    modalsElement.querySelector<HTMLDivElement>('.settings-sheet');
  if (!sheetElement) {
    sheetElement = document.createElement('div');
    sheetElement.className = 'bottom-sheet settings-sheet';
    modalsElement.appendChild(sheetElement);
  }

  sheetElement.innerHTML = '';

  const header = document.createElement('h2');
  header.innerText = 'Синхронизация между устройствами';
  sheetElement.appendChild(header);

  const closeButton = document.createElement('button');
  closeButton.innerText = 'X';
  closeButton.className = 'close-button';
  closeButton.addEventListener('click', () => {
    sheetElement!.style.display = 'none';
  });
  sheetElement.appendChild(closeButton);

  const hint = document.createElement('p');
  hint.className = 'settings-hint';
  hint.innerText =
    'Введите данные вашего self-hosted Supabase (см. supabase/SELF_HOSTING.md). ' +
    'Один и тот же код синхронизации нужно ввести на всех устройствах.';
  sheetElement.appendChild(hint);

  const existing = getSyncConfig();

  const urlInput = createField(sheetElement, 'Supabase URL', existing?.url ?? '', 'https://supabase.example.com');
  const anonKeyInput = createField(sheetElement, 'Anon key', existing?.anonKey ?? '');
  const syncCodeInput = createField(sheetElement, 'Код синхронизации', existing?.syncCode ?? '');

  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'buttons-container';
  sheetElement.appendChild(buttonsContainer);

  const saveButton = document.createElement('button');
  saveButton.innerText = 'Сохранить и перезагрузить';
  saveButton.className = 'settings-save-button';
  buttonsContainer.appendChild(saveButton);

  saveButton.addEventListener('click', () => {
    const url = urlInput.value.trim();
    const anonKey = anonKeyInput.value.trim();
    const syncCode = syncCodeInput.value.trim();

    if (!url || !anonKey || !syncCode) {
      alert('Заполните все три поля');
      return;
    }

    saveSyncConfig({ url, anonKey, syncCode });
    location.reload();
  });

  if (existing) {
    const clearButton = document.createElement('button');
    clearButton.innerText = 'Отключить синхронизацию';
    clearButton.className = 'reset-button';
    buttonsContainer.appendChild(clearButton);

    clearButton.addEventListener('click', () => {
      clearSyncConfig();
      location.reload();
    });
  }

  sheetElement.style.display = 'block';
}

function createField(
  container: HTMLElement,
  label: string,
  value: string,
  placeholder = ''
): HTMLInputElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'settings-field';

  const labelText = document.createElement('span');
  labelText.innerText = label;
  wrapper.appendChild(labelText);

  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.placeholder = placeholder;
  wrapper.appendChild(input);

  container.appendChild(wrapper);

  return input;
}
