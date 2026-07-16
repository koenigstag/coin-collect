# Self-hosting Supabase for Coin Collect sync

Coin Collect stores its data in the browser's `localStorage`, which never
leaves the device. To sync between devices automatically, the site can
optionally push/pull its data to a Supabase table you host yourself. This
document is a copy-pasteable checklist to run **on your own Ubuntu
server** over SSH — nothing here runs automatically from this repo.

Replace `supabase.example.com` below with your actual domain everywhere
it appears.

## 0. Prerequisites

- A DNS **A record** for your domain pointing at the server's public IP
  (needed for step 3). Set this up first — DNS propagation can take a
  few minutes.
- SSH access to the server with a user that can `sudo`.

## 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker   # or log out/in so the group change takes effect
docker version  # sanity check
```

## 2. Get the Supabase self-hosting stack and generate secrets

Pull the official docker-compose project directly (it's actively
maintained upstream with several supporting config files alongside
`docker-compose.yml`, so don't copy it into this repo — always fetch the
current version):

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

Generate a Postgres password and a JWT secret:

```bash
POSTGRES_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 32)
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo "JWT_SECRET=$JWT_SECRET"
```

Derive `ANON_KEY` and `SERVICE_ROLE_KEY` from that `JWT_SECRET` using the
script in this repo (pure Python standard library, no dependencies):

```bash
python3 generate-jwt-keys.py "$JWT_SECRET"
# prints:
# ANON_KEY=...
# SERVICE_ROLE_KEY=...
```

(If `generate-jwt-keys.py` isn't already on the server, copy its contents
from `supabase/generate-jwt-keys.py` in this repo.)

Now edit `supabase/docker/.env` and set at least:

```dotenv
POSTGRES_PASSWORD=<value from above>
JWT_SECRET=<value from above>
ANON_KEY=<value from above>
SERVICE_ROLE_KEY=<value from above>
DASHBOARD_USERNAME=<pick something>
DASHBOARD_PASSWORD=<pick something strong>
SITE_URL=https://supabase.example.com
API_EXTERNAL_URL=https://supabase.example.com
SUPABASE_PUBLIC_URL=https://supabase.example.com
```

Leave everything else at its default for a first run.

## 3. Start Supabase

```bash
docker compose up -d
docker compose ps   # wait until everything is "healthy" / "running"
```

Studio is now listening on `KONG_HTTP_PORT` from `.env` (default `8000`),
but only on the server itself for now — that's what the next step fixes.

## 4. Put HTTPS in front of it with Caddy

**This step is not optional.** `coin-collect` is served over HTTPS via
GitHub Pages, and browsers block a HTTPS page from calling a plain HTTP
API (mixed content) — including the WebSocket connection Realtime sync
needs. Since you already have a domain, Caddy gets you a real
Let's Encrypt certificate with almost no config:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Edit `/etc/caddy/Caddyfile` to just:

```
supabase.example.com {
  reverse_proxy localhost:8000
}
```

Then reload:

```bash
sudo systemctl reload caddy
```

Visit `https://supabase.example.com` — you should see the Supabase
Studio login (the `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` from step 2).

## 5. Create the app's table

In Studio → SQL Editor, paste and run `supabase/schema.sql` from this
repo. This creates the `coin_collections` table, enables Realtime on it,
and adds permissive RLS policies (the sync code you pick in step 6 is
what keeps your data private, not a login).

## 6. Point the site at your instance

Open Coin Collect, click the settings (⚙) button, and fill in:

- **Supabase URL**: `https://supabase.example.com`
- **Anon key**: the `ANON_KEY` value from step 2
- **Sync code**: any string you make up — enter the *same* one on every
  device you want synced. Treat it like a password: whoever knows it can
  read/write that device group's data.

Save, then repeat step 6 on your other device(s) with the same sync
code. From then on, coin counts update automatically on every device
without manual export/import.

## Troubleshooting

- **Nothing loads / CORS errors in the browser console**: check that
  `SITE_URL`, `API_EXTERNAL_URL`, and `SUPABASE_PUBLIC_URL` in `.env` all
  match your real HTTPS domain, then `docker compose up -d` again to
  pick up the change.
- **Realtime doesn't push updates**: confirm the table was actually added
  to the `supabase_realtime` publication — rerun the
  `alter publication supabase_realtime add table public.coin_collections;`
  line from `schema.sql` if you ran the file before Realtime was healthy.
- **`docker compose ps` shows a service unhealthy**: `docker compose logs <service>`
  — most first-run issues are a missing/incorrect value in `.env`.
