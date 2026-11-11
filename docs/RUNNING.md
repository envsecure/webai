# Running webai on a machine

A complete guide to getting the app running locally, on a Linux VPS, or in Docker.

---

## 0. Requirements

| Requirement | Version                                             | Why                                     |
| ----------- | --------------------------------------------------- | --------------------------------------- |
| Node.js     | **22.5+** (22 LTS or 24 LTS recommended)            | 22.5+ ships the built-in `node:sqlite`  |
| npm         | 10+                                                 | npm workspaces                          |
| RAM         | 512 MB minimum, 1 GB comfortable                    | Node + Express                          |
| Disk        | ~250 MB (node_modules) + database                   |                                         |

Check your version:

```bash
node -v && npm -v
```

> **Why 22.5+?** The SQLite driver prefers `better-sqlite3` (native, faster) and falls
> back to Node's built-in `node:sqlite` when the native module is unavailable. That
> fallback needs Node 22.5 or newer. On older Node versions the app still runs, but
> install `better-sqlite3` manually.

---

## 1. Quick start (any machine)

```bash
git clone https://github.com/envsecure/webai.git
cd webai

npm install        # installs the server + client workspaces
npm run seed       # creates data/app.db and loads templates + a demo account
npm run build      # builds the React client into client/dist
npm start          # serves API + client on http://localhost:3001
```

Open <http://localhost:3001>.

**Demo login:** `demo@lovable.dev` / `demo1234`

Check it is alive:

```bash
curl -s http://localhost:3001/api/health
# {"status":"ok","db":"sqlite","env":"production","uptime":3.1}
```

Run the built-in verification (checks the runtime version, the client build, the
database, the HTTP endpoints, the auth guard and the secret):

```bash
npm run verify
```

### The three commands that matter

| Command            | What it does                                                      |
| ------------------ | ----------------------------------------------------------------- |
| `npm install`      | Installs dependencies for `server/` and `client/` (npm workspaces)  |
| `npm run seed`     | Creates the SQLite database, loads templates/community/demo user  |
| `npm run build`    | Compiles the React client into `client/dist` (Express serves it)   |
| `npm start`        | Runs the Express server (API + static client)                      |

`npm start` serves the **built** client, so run `npm run build` after every client
change. The server automatically picks up `client/dist` if it exists.

---

## 2. Development mode

Two processes, hot reload on both sides:

```bash
npm run dev
```

| Service | URL                     | Notes                                              |
| ------- | ----------------------- | -------------------------------------------------- |
| Vite    | <http://localhost:5173> | React dev server, proxies `/api` to the backend     |
| Express | <http://localhost:3001> | API only                                            |

Use **5173** while developing. The Vite proxy forwards `/api/*` to port 3001, so the
browser talks to one origin and there are no CORS issues.

---

## 3. Production on a Linux server (systemd + nginx + HTTPS)

This is the recommended setup for a real machine.

### 3.1 Install Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # v22.x
```

### 3.2 Create a service user and copy the code

```bash
sudo useradd --system --create-home --home-dir /opt/webai --shell /usr/sbin/nologin webai
sudo mkdir -p /opt/webai
sudo chown webai:webai /opt/webai
```

Deploy the code (git or rsync):

```bash
sudo -u webai git clone https://github.com/envsecure/webai.git /opt/webai
# or: sudo rsync -a --exclude node_modules --exclude data ./ /opt/webai/
cd /opt/webai
sudo -u webai npm ci
sudo -u webai npm run build
```

### 3.3 Environment file

```bash
sudo -u webai nano /opt/webai/.env
```

```ini
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
DATA_DIR=/opt/webai/data
DB_DRIVER=sqlite
SQLITE_FILE=/opt/webai/data/app.db
AUTH_SECRET=<generate-a-long-random-string>
AUTH_TOKEN_TTL=2592000
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3.4 Seed the database

```bash
cd /opt/webai
sudo -u webai npm run seed
```

### 3.5 systemd service

```bash
sudo cp /opt/webai/deploy/webai.service /etc/systemd/system/webai.service
sudo systemctl daemon-reload
sudo systemctl enable --now webai
sudo systemctl status webai
```

The unit reads `/opt/webai/.env`, runs as the `webai` user, restarts on failure and
writes logs to the journal.

```bash
sudo journalctl -u webai -f          # follow the logs
sudo systemctl restart webai         # restart after a config change
```

> If node is not at `/usr/bin/node` (check with `command -v node`), adjust the
> `ExecStart` line in the unit to the real path before enabling it.

### 3.6 nginx reverse proxy + HTTPS

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo cp /opt/webai/deploy/nginx-webai.conf /etc/nginx/sites-available/webai
sudo ln -s /etc/nginx/sites-available/webai /etc/nginx/sites-enabled/webai
sudo nginx -t && sudo systemctl reload nginx
```

Edit `server_name` in that file to your domain, then issue a certificate:

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
sudo systemctl reload nginx
```

### 3.7 Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Keep port 3001 closed to the internet — nginx is the only public entry point.

### 3.8 Verify

```bash
curl -s https://your-domain.com/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain.com/   # expect 200
```

---

## 4. Docker

```bash
git clone https://github.com/envsecure/webai.git
cd webai

cp deploy/.env.example .env      # edit if needed
docker compose up -d --build
docker compose logs -f
```

The app is then on <http://localhost:3001>.

| Command                     | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `docker compose up -d`      | Start in the background                  |
| `docker compose logs -f`    | Follow the logs                          |
| `docker compose restart`    | Restart                                 |
| `docker compose down`       | Stop and remove the container            |
| `docker compose down -v`    | Stop and **delete the database volume**  |

The SQLite file lives in the named volume `webai-data`; it survives rebuilds.

To publish it behind nginx, add a `webai` service to your compose file and proxy to
`http://webai:3001` — the container port is already set to `3001`.

> The image is `node:22-bookworm-slim` (Debian) rather than Alpine, because
> `better-sqlite3` ships glibc prebuilds. If the native module has to be compiled
> (`npm ci` prints "Failed to compile"), set `npm_config_build_from_source=true` and
> add `build-essential python3` to the build stage.

---

## 5. Environment variables

| Variable            | Default                     | Description                                    |
| ------------------- | --------------------------- | ---------------------------------------------- |
| `NODE_ENV`          | `development`               | Set to `production` in production              |
| `PORT`              | `3001`                      | HTTP port                                      |
| `HOST`              | `0.0.0.0`                   | Bind address (`127.0.0.1` behind nginx)        |
| `DATA_DIR`          | `./data`                    | Directory for the database                     |
| `SQLITE_FILE`       | `$DATA_DIR/app.db`          | Full path to the SQLite file                   |
| `DB_DRIVER`         | `sqlite`                    | `sqlite` or `postgres`                        |
| `DATABASE_URL`      | —                           | Postgres connection string                     |
| `AUTH_SECRET`       | dev fallback                | HMAC secret — **always set this in production**|
| `AUTH_TOKEN_TTL`    | `2592000`                   | Session lifetime in seconds (30 days)          |
| `LLM_PROVIDER`      | auto                        | `openai`, `anthropic`, `openrouter`, `groq`, `together`, `ollama`, `compatible`, `mock` |
| `LLM_API_KEY`       | —                           | Model API key (provider-specific vars also work) |
| `LLM_BASE_URL`      | provider default            | Override the provider base URL                 |
| `LLM_MODEL`         | provider default            | Model name                                     |
| `LLM_MAX_ITERATIONS`| `12`                        | Agent loop budget                              |
| `LLM_REVIEW_ROUNDS` | `1`                         | Self-review rounds                             |
| `LLM_CONTEXT_TOKENS`| `24000`                     | Context window size                            |

### Turning on a real model

The build agent runs against the configured provider. Set the key in the
environment (server-wide) or per user in **Settings → AI model** (encrypted
with AES-256-GCM before storage):

```bash
# server-wide
LLM_PROVIDER=openai OPENAI_API_KEY=sk-... npm start

# or per user: Settings -> AI model -> provider, model, API key
```

With no provider configured the app uses the offline mock agent: the same loop,
tools and subagents, but the model is local, so nothing leaves the machine.
Check what is active:

```bash
curl -s https://your-domain.com/api/health
# "authSecret":"custom", ... and Settings -> AI model shows the provider
```

Test a provider from the UI (**Test connection**) or directly:

```bash
curl -s -X POST https://your-domain.com/api/settings/test-llm \
  -H "Authorization: Bearer $TOKEN"
```

---

## 6. Switching to Postgres

The repository layer is driver-agnostic, so this is a config change plus a schema
file. Nothing in the routes, services or UI changes.

```bash
sudo -u webai npm --workspace server install pg
```

Add to `.env`:

```ini
DB_DRIVER=postgres
DATABASE_URL=postgres://webai:secret@localhost:5432/webai
```

Then create the tables. The SQLite schema in `server/src/db/schema.sql` uses only
portable column types, so with `psql`:

```bash
psql "$DATABASE_URL" -f server/src/db/schema.sql
```

(Change `PRAGMA foreign_keys = ON;` to nothing or to a `SET` command — Postgres
enforces foreign keys natively.) Then restart:

```bash
sudo systemctl restart webai
```

Verify the driver switched:

```bash
curl -s https://your-domain.com/api/health   # {"db":"postgres", ...}
```

---

## 7. Updating an existing deployment

```bash
cd /opt/webai
sudo -u webai git pull
sudo -u webai npm ci
sudo -u webai npm run build
sudo systemctl restart webai
```

Migrations are additive: `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, so it runs
safely on every boot. For column changes, write an explicit migration script and
run it before restarting.

---

## 8. Backups

The whole database is one file.

```bash
# Consistent backup (safe while the app is running)
sudo -u webai sqlite3 /opt/webai/data/app.db ".backup '/opt/webai/data/backup-$(date +%F).db'"

# Or stop → copy → start
sudo systemctl stop webai
sudo cp /opt/webai/data/app.db /backup/webai-$(date +%F).db
sudo systemctl start webai
```

Nightly cron:

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * sqlite3 /opt/webai/data/app.db \".backup '/backup/webai-\$(date +\%F).db'\"") | crontab -
```

---

## 9. Troubleshooting

| Symptom                              | Cause / fix                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `EADDRINUSE` on start                | Port busy: `sudo ss -lptn 'sport = :3001'` then stop the other process      |
| Page loads but the API 404s          | You ran `npm start` without `npm run build` — rebuild the client            |
| `SQLITE_CANTOPEN`                    | `DATA_DIR` is not writable: `sudo chown -R webai:webai /opt/webai/data`     |
| `SqliteError: no such table: users`  | The database was never seeded — run `npm run seed`                          |
| `better-sqlite3` failed to install   | Native build failed; install `build-essential python3` and reinstall, or use Node 22.5+ so the `node:sqlite` fallback is used |
| Login works, then 401                | `AUTH_SECRET` changed between requests — it invalidates signed values       |
| Changes not visible after deploy     | `npm run build` was skipped — Express serves `client/dist` as static files  |
| 502 from nginx                       | The service is down: `sudo systemctl status webai` and `journalctl -u webai`  |

Useful commands:

```bash
sudo systemctl status webai
sudo journalctl -u webai -n 100 --no-pager
curl -s http://127.0.0.1:3001/api/health
curl -s http://127.0.0.1:3001/api/stats
```

---

## 10. Security checklist

- [ ] Set a unique `AUTH_SECRET` (never ship the default).
- [ ] `NODE_ENV=production`.
- [ ] Bind to `127.0.0.1` and let nginx terminate TLS.
- [ ] Only ports 22, 80 and 443 open in the firewall.
- [ ] `data/` owned by the service user, mode `750`.
- [ ] The app user is **not** root and has no sudo.
- [ ] Database backups run on a schedule and are stored off the machine.

The API authenticates with opaque bearer tokens stored in the `sessions` table;
passwords are hashed with `scrypt` and a per-user salt.
