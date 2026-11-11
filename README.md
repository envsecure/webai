# webai — a Lovable.dev clone (React + Express + SQLite)

A working clone of [lovable.dev](https://lovable.dev/) built with **JavaScript**, **Node.js**, **Express**, **React** and **SQLite**.
Describe an app in plain language and the builder generates a full-stack starter
(React UI + Express REST API + SQLite schema), stores it in the database, and lets
you iterate with follow-up messages.

> The database layer is driver-agnostic. It runs on SQLite today and switches to
> Postgres (or MySQL) with a config flag — no route, service or UI changes.

---

## Stack

| Layer    | Choice                                                        |
| -------- | ------------------------------------------------------------- |
| Frontend | React 18, React Router 6, Vite 6, plain CSS (design tokens)  |
| Backend  | Node.js, Express 4, CORS, ESM modules                         |
| Database | SQLite via `better-sqlite3` (falls back to `node:sqlite`)    |
| Auth     | scrypt password hashing + opaque session tokens in the DB     |
| Agent    | Tool-use loop with context compaction and subagents           |

---

## The build agent

The builder is not a template filler — it runs an agent loop against a real
model when one is configured.

```
prompt ─► plan ─► ┌─ tool call ─► write/read/list/delete ─┐
                  │                                       │
                  └──────────── observe ───────────────────┘
                              │
                  context compacted when the window fills
                              │
                  delegate ──► subagent (own context, own budget)
                              │
                  review ──► findings fed back for a fix pass
```

| Piece                | File                                       | What it does                                                                 |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| Agent loop           | `server/src/services/llm/agent.js`          | plan → act → observe → refine, bounded iterations, review round             |
| Context window       | `server/src/services/llm/context.js`        | token budget, rolling summary, compaction, deterministic fallback            |
| Subagents            | `server/src/services/llm/subagents.js`      | db designer, API engineer, frontend engineer, code reviewer, QA engineer      |
| Tools                | `server/src/services/llm/tools.js`          | sandboxed file workspace (no path traversal), `finalize`, `delegate`          |
| Providers            | `server/src/services/llm/providers.js`      | OpenAI, Anthropic, OpenRouter, Groq, Together, Ollama, any compatible gateway |
| Client               | `server/src/services/llm/client.js`         | retries, backoff, timeouts, wire-format normalisation                        |
| Orchestration        | `server/src/services/build.js`              | runs the agent, falls back to the local generator on failure                 |

### Configuring a model

Settings → **Model connection**, or the environment:

| Variable                                   | Meaning                                     |
| ------------------------------------------ | ------------------------------------------- |
| `LLM_PROVIDER`                             | `openai`, `anthropic`, `openrouter`, `groq`, `together`, `ollama`, `compatible` |
| `LLM_BASE_URL`                             | Override the provider base URL              |
| `LLM_API_KEY`                              | API key (provider-specific vars also work) |
| `LLM_MODEL`                                | Model name                                  |
| `LLM_MAX_ITERATIONS`                       | Agent loop budget (default 12)             |
| `LLM_REVIEW_ROUNDS`                        | Self-review rounds (default 1)              |
| `LLM_CONTEXT_TOKENS`                       | Context window size (default 24000)         |

Per-user keys are encrypted with AES-256-GCM before they are stored. With no
provider configured there is **no model**, and the app says so instead of
building something fake.

### Streaming

`POST /api/projects/:id/chat/stream` returns newline-delimited JSON as the
agent works: `plan`, `iteration`, `tool_start`, `tool_call`, `message`,
`context_compacted`, `subagent_start`, `subagent_end`, `review_rework`,
`finalize`, `done`, `result`. The builder renders this as a live activity feed.

### Tests

```bash
npm run test:agent                     # loop, subagents, review, compaction, streaming
npm run fake:llm &                     # a local OpenAI-compatible server
npm run test:provider                  # the real HTTP provider path
npm run test:setup                     # no model -> clear error -> detect -> connect -> build
```

---

## Quick start

```bash
npm install          # installs the server + client workspaces
npm run seed         # creates data/app.db and loads the template gallery
npm run build        # builds the client into client/dist
npm start            # serves API + client on http://localhost:3001
```

Dev mode with hot reload (Vite on :5173, API on :3001):

```bash
npm run dev
```

There is no demo account: sign up, then connect your own model in **Settings → Model
connection** (any OpenAI-compatible endpoint). Nothing is built until a model is connected.

> **Deploying to a machine?** See **[docs/RUNNING.md](docs/RUNNING.md)** — the full
> guide: VPS with systemd + nginx + HTTPS, Docker, the Postgres switch, backups,
> updates and troubleshooting.

---

## Project layout

```
lovable-clone/
├── package.json              # npm workspaces + scripts
├── data/app.db               # SQLite database (created on first run)
├── server/
│   ├── src/
│   │   ├── index.js          # bootstrap: db init + listen
│   │   ├── app.js            # express app, static client, error handler
│   │   ├── config.js         # env-driven configuration
│   │   ├── db/
│   │   │   ├── index.js      # driver-agnostic facade (query/get/run/tx)
│   │   │   ├── sqlite.js     # SQLite driver
│   │   │   ├── postgres.js   # Postgres driver (drop-in swap)
│   │   │   ├── schema.sql    # table definitions
│   │   │   └── seed.js       # templates, community projects, demo user
│   │   ├── lib/              # auth helpers, id/hash utilities, secret encryption
│   │   ├── repositories/     # SQL lives here, nothing else
│   │   ├── routes/           # auth, projects, catalog, settings
│   │   └── services/
│   │       ├── build.js      # orchestration + fallback
│   │       ├── generator.js  # deterministic starter generator + mock agent
│   │       └── llm/          # agent loop, context, subagents, tools, providers
│   └── public/
├── client/
│   ├── src/
│   │   ├── main.jsx, App.jsx
│   │   ├── components/       # Brand, Nav, Footer, PromptBox
│   │   ├── pages/            # Landing, Pricing, Templates, Community,
│   │   │                     # Auth, Dashboard, Builder, Settings
│   │   ├── lib/api.js        # fetch wrapper + token handling
│   │   ├── lib/agent.js      # NDJSON stream reader + event formatting
│   │   └── styles.css        # design tokens + all component styles
│   └── vite.config.js
├── scripts/                  # verify-install, test-agent, test-provider, fake-openai
└── rea-evidence/             # REA capture evidence used for the rebuild
```

---

## API

All `/api/projects`, `/api/settings` and `/api/api-keys` routes require
`Authorization: Bearer <token>`.

| Method | Path                             | Description                                  |
| ------ | -------------------------------- | -------------------------------------------- |
| POST   | `/api/auth/signup`               | Create an account, returns a session token   |
| POST   | `/api/auth/login`                | Log in, returns a session token              |
| POST   | `/api/auth/logout`               | Invalidate the current session               |
| GET    | `/api/auth/me`                   | Current user                                 |
| PATCH  | `/api/auth/me`                   | Update name / avatar                         |
| GET    | `/api/projects`                  | List projects (`?search=`, `?limit=`)        |
| POST   | `/api/projects`                  | Create an empty project                      |
| POST   | `/api/projects/quick-build`      | Prompt -> project + generated files          |
| POST   | `/api/projects/:id/chat`         | Follow-up prompt -> regenerate + new version |
| GET    | `/api/projects/:id`              | Project, chats and versions                  |
| PATCH  | `/api/projects/:id`              | Rename / update a project                    |
| DELETE | `/api/projects/:id`              | Delete a project                             |
| `GET    | `/api/projects/:id/messages`     | Chat history                                 |
| GET    | `/api/projects/:id/versions`     | Version history with generated code          |
| POST   | `/api/projects/:id/chat`         | Follow-up prompt -> agent loop -> regenerate  |
| POST   | `/api/projects/:id/chat/stream`  | Same, streaming agent events as NDJSON       |
| GET    | `/api/templates`                 | Template gallery (`?category=`, `?search=`)  |
| POST   | `/api/templates/:id/install`     | Increment the install counter                |
| GET    | `/api/community`                 | Community projects (`?search=`)              |
| POST   | `/api/community/:id/like`        | Like a community project                     |
| GET    | `/api/settings`                  | User settings + resolved model configuration |
| PUT    | `/api/settings`                  | Update settings (incl. model + API key)       |
| POST   | `/api/settings/test-llm`         | Check the configured model is reachable       |
| GET    | `/api/api-keys`                  | List API keys                                |
| POST   | `/api/api-keys`                  | Create an API key (shown once)               |
| DELETE | `/api/api-keys/:id`              | Revoke an API key                            |
| GET    | `/api/stats`                     | Public counters                              |
| GET    | `/api/llm/status`                | Whether a model is available (no secrets)    |
| POST   | `/api/settings/detect-model`     | Probe an endpoint: models, context, tools    |
| POST   | `/api/settings/list-models`      | The endpoint's model catalogue               |
| GET    | `/api/health`                    | Health check                                 |

---

## Switching SQLite -> Postgres (or MySQL)

All SQL lives in `server/src/repositories/**` and uses `?` placeholders, so the
swap is:

1. `npm --workspace server install pg`
2. Write a Postgres schema (`server/src/db/schema.postgres.sql`) — the column
   names are already portable.
3. Set the environment variables and restart:

```bash
DB_DRIVER=postgres
DATABASE_URL=postgres://user:pass@localhost:5432/webai
```

`server/src/db/postgres.js` already translates `?` to `$1, $2, ...` and wraps
`query`/`get`/`run`/`tx` in the same interface the SQLite driver exposes.

---

## How the generator works

`server/src/services/generator.js` classifies the prompt (task manager, online
store, blog, CRM, booking, dashboard, marketplace, …), then emits:

- `README.md`
- `server/schema.sql` — the matching SQLite schema
- `server/src/routes/<entity>.js` — Express CRUD router
- `client/src/lib/api.js` — typed fetch helpers
- `client/src/components/<Entity>List.jsx` — React list/create UI
- `client/src/App.jsx` — the shell

`generateWithModel()` is the seam for a hosted LLM: replace that one function and
the rest of the app is unchanged.

---

## Configuration

| Variable            | Default              | Meaning                              |
| ------------------- | -------------------- | ------------------------------------ |
| `PORT`              | `3001`               | API + static server port             |
| `HOST`              | `0.0.0.0`            | Bind address                         |
| `DATA_DIR`          | `./data`             | Where the SQLite file lives          |
| `SQLITE_FILE`       | `$DATA_DIR/app.db`   | SQLite file path                     |
| `DB_DRIVER`         | `sqlite`             | `sqlite` or `postgres`               |
| `DATABASE_URL`      | —                    | Postgres connection string           |
| `AUTH_SECRET`       | dev fallback         | HMAC secret for signed values        |
| `AUTH_TOKEN_TTL`    | `2592000`            | Session lifetime in seconds          |

---

## Attribution

This is an educational clone. The visual design tokens, layout and copy were
studied from the public lovable.dev landing page using
[REA](https://github.com/morluto/rea) browser capture; captured evidence is kept
in `rea-evidence/`. Lovable is a trademark of its respective owner — this
project is not affiliated with or endorsed by them.
