const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { verifyJwt } = require('./jwt');

const PORT = process.env.PORT || 8787;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const AUTH_SECRET = process.env.AUTH_SECRET;

if (!AUTH_SECRET) {
  console.error(
    'AUTH_SECRET env var is required (shared secret used to verify client JWTs). ' +
      'Generate one with: openssl rand -base64 32'
  );
  process.exit(1);
}

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store));
}

const store = loadStore();

// syncCode -> Set<WebSocket>
const rooms = new Map();

function broadcastState(syncCode, excludeSocket) {
  const sockets = rooms.get(syncCode);
  if (!sockets) {
    return;
  }

  const payload = JSON.stringify({
    type: 'state',
    syncCode,
    cells: store[syncCode] || {},
  });

  for (const socket of sockets) {
    if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('coin-collect sync server\n');
});

const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (socket) => {
  let joinedCode = null;

  function authenticate(token) {
    const payload = verifyJwt(token, AUTH_SECRET);
    if (!payload || typeof payload.syncCode !== 'string') {
      socket.send(JSON.stringify({ type: 'error', message: 'invalid or missing token' }));
      socket.close();
      return null;
    }
    return payload.syncCode;
  }

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message.type === 'join') {
      const syncCode = authenticate(message.token);
      if (!syncCode) {
        return;
      }

      joinedCode = syncCode;
      if (!rooms.has(joinedCode)) {
        rooms.set(joinedCode, new Set());
      }
      rooms.get(joinedCode).add(socket);

      socket.send(
        JSON.stringify({
          type: 'state',
          syncCode: joinedCode,
          cells: store[joinedCode] || {},
        })
      );
      return;
    }

    if (message.type === 'update') {
      const syncCode = authenticate(message.token);
      if (!syncCode) {
        return;
      }

      store[syncCode] = message.cells && typeof message.cells === 'object' ? message.cells : {};
      saveStore(store);
      broadcastState(syncCode, socket);
    }
  });

  socket.on('close', () => {
    if (joinedCode && rooms.has(joinedCode)) {
      const sockets = rooms.get(joinedCode);
      sockets.delete(socket);
      if (sockets.size === 0) {
        rooms.delete(joinedCode);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`coin-collect sync server listening on :${PORT}`);
});
