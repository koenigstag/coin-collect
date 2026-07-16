# Self-hosting Supabase for Coin Collect sync

Coin Collect stores its data in the browser's `localStorage`, which never
leaves the device. To sync between devices automatically, the site can
optionally push/pull its data to a Supabase table you host yourself. This
document is the setup checklist for your own Ubuntu server — it isn't
something that runs automatically from this repo.

## 1. Run Supabase on your server

Supabase's self-hosting stack is a multi-container Docker Compose project
maintained upstream, so pull it directly instead of copying it into this
repo (it changes often and has several supporting config files alongside
`docker-compose.yml`):

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

Generate real secrets for `.env` (do not keep the example placeholders):

```bash
# POSTGRES_PASSWORD: any strong password
# JWT_SECRET: 32+ random characters
openssl rand -base64 32
```

Follow Supabase's docs to derive `ANON_KEY` / `SERVICE_ROLE_KEY` from your
`JWT_SECRET` (https://supabase.com/docs/guides/self-hosting/docker), then
start the stack:

```bash
docker compose up -d
```

Studio will be reachable on the port you set in `.env`
(`KONG_HTTP_PORT`, default `8000`).

## 2. Put HTTPS in front of it

**This step is not optional.** `coin-collect` is served over HTTPS via
GitHub Pages, and browsers block a HTTPS page from calling a plain HTTP
API (mixed content) — including the WebSocket connection Realtime sync
needs. Put a reverse proxy with a real TLS certificate in front of the
Kong gateway (port `8000`), for example:

- **Caddy** (simplest — automatic Let's Encrypt cert):
  ```
  supabase.yourdomain.com {
    reverse_proxy localhost:8000
  }
  ```
- **Cloudflare Tunnel** if you don't want to open a port on your server at
  all, or don't have a domain pointed at your server's IP yet.

Whichever you pick, you need a public HTTPS URL that reaches Kong, e.g.
`https://supabase.yourdomain.com`.

## 3. Create the app's table

Open Studio (behind your proxy, or `http://localhost:8000` on the server
itself) → SQL Editor → paste and run `supabase/schema.sql` from this repo.
This creates the `coin_collections` table, enables Realtime on it, and
adds permissive RLS policies (the sync code you pick in step 4 is what
keeps your data private, not a login).

## 4. Point the site at your instance

Open Coin Collect, click the settings (⚙) button, and fill in:

- **Supabase URL**: the public HTTPS URL from step 2
- **Anon key**: `ANON_KEY` from your `.env`
- **Sync code**: any string you make up — enter the *same* one on every
  device you want synced. Treat it like a password: whoever knows it can
  read/write that device group's data.

Save, then repeat step 4 on your other device(s) with the same sync code.
From then on, coin counts update automatically on every device without
manual export/import.
