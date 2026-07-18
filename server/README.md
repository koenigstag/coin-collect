# Coin Collect sync server

A minimal WebSocket server for syncing Coin Collect's coin counts across
devices. No database, no user accounts — just a JSON file on disk, and a
single shared secret used to sign/verify JWTs so random clients on the
internet can't read or write your data.

## Protocol

Clients connect over WebSocket and send/receive plain JSON messages.
Every `join`/`update` message must include a `token`: an HS256 JWT,
signed with the same secret as the server's `AUTH_SECRET`, whose payload
is `{"syncCode": "...", "iat": ..., "exp": ...}`. The server verifies the
signature and reads `syncCode` from the verified payload — it never
trusts a client-supplied `syncCode` directly.

- `{"type":"join","token":"..."}` → server replies with
  `{"type":"state","syncCode":"...","cells":{...}}` (current stored
  state for that code, `{}` if new).
- `{"type":"update","token":"...","cells":{...}}` → server saves it and
  broadcasts `{"type":"state",...}` to every other client currently
  joined to that same `syncCode`.
- On an invalid/expired token, the server replies
  `{"type":"error","message":"..."}` and closes the connection.

The site's settings panel signs this token itself, in the browser, using
the Web Crypto API — the secret is never sent over the network, only the
resulting signed token is.

## Run it

```bash
cd server
npm install
AUTH_SECRET=$(openssl rand -base64 32) node server.js
# coin-collect sync server listening on :8787
```

`AUTH_SECRET` is required — the server refuses to start without it.
Save the value you generated; you'll need to enter the exact same string
as the "shared secret" in the site's settings panel.

Override the port or storage location with env vars:

```bash
PORT=9000 DATA_FILE=/var/lib/coin-collect/data.json AUTH_SECRET=... node server.js
```

For it to survive reboots/crashes, run it under a process manager, e.g.
a systemd unit:

```ini
# /etc/systemd/system/coin-collect-sync.service
[Unit]
Description=Coin Collect sync server
After=network.target

[Service]
WorkingDirectory=/opt/coin-collect/server
ExecStart=/usr/bin/node server.js
Restart=on-failure
User=coin-collect
Environment=PORT=8787
Environment=AUTH_SECRET=replace-with-your-generated-secret

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now coin-collect-sync
```

(Prefer an `EnvironmentFile=` over inlining the secret in the unit file
if others can read it.)

## Put it behind HTTPS (wss://)

**Not optional.** `coin-collect` is served over HTTPS via GitHub Pages,
and browsers block a HTTPS page from opening a plain `ws://` connection
(mixed content) — it must be `wss://`. Point a reverse proxy with a real
TLS certificate at the server's port; for example with Caddy (needs a
domain pointed at your server):

```
sync.example.com {
  reverse_proxy localhost:8787
}
```

```bash
sudo systemctl reload caddy
```

Caddy forwards the WebSocket `Upgrade` handshake through
`reverse_proxy` automatically — no extra config needed for that.

## Point the site at it

Open Coin Collect, click the settings (⚙) button, and fill in:

- **Server URL**: `wss://sync.example.com`
- **Shared secret**: the exact `AUTH_SECRET` value you set on the server
- **Sync code**: any string you make up — enter the *same* one (along
  with the same secret) on every device you want synced.

Save, then repeat on your other device(s) with the same secret and sync
code.
