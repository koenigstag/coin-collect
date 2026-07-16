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

Pull just the `docker/` folder from the official repo with a sparse
checkout — it's actively maintained upstream with several supporting
config files alongside `docker-compose.yml`, so don't copy it into this
repo (always fetch the current version), and a sparse checkout avoids
downloading the rest of the (much larger) monorepo — Studio's source,
docs, etc:

```bash
git clone --filter=blob:none --no-checkout --depth 1 https://github.com/supabase/supabase
cd supabase
git sparse-checkout init --cone
git sparse-checkout set docker
git checkout master
cd docker
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

Now edit `docker/.env` and set at least:

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
PROXY_DOMAIN=supabase.example.com
```

`PROXY_DOMAIN` is used in the next step. Leave everything else at its
default for a first run.

## 3. Start Supabase with HTTPS via the built-in Caddy overlay

**HTTPS is not optional.** `coin-collect` is served over HTTPS via
GitHub Pages, and browsers block a HTTPS page from calling a plain HTTP
API (mixed content) — including the WebSocket connection Realtime sync
needs. The `docker/` folder already ships a Caddy overlay
(`docker-compose.caddy.yml`) that runs Caddy as its own container,
gets a real Let's Encrypt certificate for `PROXY_DOMAIN` automatically,
forwards the Supabase API paths to Kong, and puts everything else
(Studio) behind HTTP basic auth using `DASHBOARD_USERNAME`/
`DASHBOARD_PASSWORD`. No separate Caddy install needed:

```bash
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
docker compose -f docker-compose.yml -f docker-compose.caddy.yml ps
# wait until everything is "healthy" / "running"
```

Visit `https://supabase.example.com` — you should see a basic-auth
prompt (`DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` from step 2), then
Supabase Studio.

From here on, always include `-f docker-compose.yml -f docker-compose.caddy.yml`
when running `docker compose` commands against this stack (stop, logs,
restart, etc.), otherwise Caddy won't be part of the command.

## 4. Create the app's table

In Studio → SQL Editor, paste and run `supabase/schema.sql` from this
repo. This creates the `coin_collections` table, enables Realtime on it,
and adds permissive RLS policies (the sync code you pick in step 5 is
what keeps your data private, not a login).

## 5. Point the site at your instance

Open Coin Collect, click the settings (⚙) button, and fill in:

- **Supabase URL**: `https://supabase.example.com`
- **Anon key**: the `ANON_KEY` value from step 2
- **Sync code**: any string you make up — enter the *same* one on every
  device you want synced. Treat it like a password: whoever knows it can
  read/write that device group's data.

Save, then repeat step 5 on your other device(s) with the same sync
code. From then on, coin counts update automatically on every device
without manual export/import.

## Troubleshooting

- **Nothing loads / CORS errors in the browser console**: check that
  `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, and
  `PROXY_DOMAIN` in `.env` all match your real HTTPS domain, then
  `docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d`
  again to pick up the change.
- **Realtime doesn't push updates**: confirm the table was actually added
  to the `supabase_realtime` publication — rerun the
  `alter publication supabase_realtime add table public.coin_collections;`
  line from `schema.sql` if you ran the file before Realtime was healthy.
- **`docker compose ps` shows a service unhealthy**: `docker compose logs <service>`
  — most first-run issues are a missing/incorrect value in `.env`.
