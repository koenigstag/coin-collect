import { CellData, getCellsFromStorage, saveCellsToStorage } from './logic';

export type SyncConfig = {
  serverUrl: string;
  syncCode: string;
  secret: string;
};

const CONFIG_KEY = 'coinSyncConfig';
const RECONNECT_DELAY_MS = 3000;
const TOKEN_VALID_YEARS = 10;

export function getSyncConfig(): SyncConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveSyncConfig(config: SyncConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearSyncConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(secret: string, syncCode: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    syncCode,
    iat: now,
    exp: now + TOKEN_VALID_YEARS * 365 * 24 * 60 * 60,
  };

  const encoder = new TextEncoder();
  const signingInput =
    base64url(encoder.encode(JSON.stringify(header))) +
    '.' +
    base64url(encoder.encode(JSON.stringify(payload)));

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));

  return signingInput + '.' + base64url(signature);
}

let applyingRemoteChange = false;

export function initSync() {
  const config = getSyncConfig();
  if (!config) {
    return;
  }

  let socket: WebSocket | null = null;

  function connect() {
    socket = new WebSocket(config!.serverUrl);

    socket.addEventListener('open', async () => {
      const token = await signJwt(config!.secret, config!.syncCode);
      socket!.send(JSON.stringify({ type: 'join', token }));
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'state' && message.cells) {
          applyingRemoteChange = true;
          saveCellsToStorage(message.cells as CellData);
          applyingRemoteChange = false;
        } else if (message.type === 'error') {
          console.error('Sync: server rejected request:', message.message);
        }
      } catch (err) {
        console.error('Sync: bad message from server', err);
      }
    });

    socket.addEventListener('close', () => {
      setTimeout(connect, RECONNECT_DELAY_MS);
    });

    socket.addEventListener('error', () => {
      socket?.close();
    });
  }

  connect();

  window.addEventListener('storage', async (event) => {
    if (event.key === 'cells' && !applyingRemoteChange) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const token = await signJwt(config!.secret, config!.syncCode);
        socket.send(
          JSON.stringify({
            type: 'update',
            token,
            cells: getCellsFromStorage(),
          })
        );
      }
    }
  });
}
