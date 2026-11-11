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

---

## Quick start

```bash
npm install          # installs the server + client workspaces
npm run seed         # creates data/app.db, seeds templates + demo account
npm run build        # builds the client into client/dist
npm start            # serves API + client on http://localhost:3001
```

Dev mode with hot reload (Vite on :5173, API on :3001):

```bash
npm run dev
```

Demo account: **demo@lovable.dev** / **demo1234**

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
│   │   ├── lib/              # auth helpers, id/hash utilities
│   │   ├── repositories/     # SQL lives here, nothing else
│   │   ├── routes/           # auth, projects, catalog, settings
│   │   └── services/         # generator.js — prompt -> app files
│   └── public/
├── client/
│   ├── src/
│   │   ├── main.jsx, App.jsx
│   │   ├── components/       # Brand, Nav, Footer, PromptBox
│   │   ├── pages/            # Landing, Pricing, Templates, Community,
│   │   │                     # Auth, Dashboard, Builder
│   │   ├── lib/api.js        # fetch wrapper + token handling
│   │   └── styles.css        # design tokens + all component styles
│   └── vite.config.js
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
| GET    | `/api/projects/:id/messages`     | Chat history                                 |
| GET    | `/api/projects/:id/versions`     | Version history with generated code          |
| GET    | `/api/templates`                 | Template gallery (`?category=`, `?search=`)  |
| POST   | `/api/templates/:id/install`     | Increment the install counter                |
| GET    | `/api/community`                 | Community projects (`?search=`)              |
| POST   | `/api/community/:id/like`        | Like a community project                     |
| GET    | `/api/settings`                  | User settings                                |
| PUT    | `/api/settings`                  | Update settings                              |
| GET    | `/api/api-keys`                  | List API keys                                |
| POST   | `/api/api-keys`                  | Create an API key (shown once)               |
| DELETE | `/api/api-keys/:id`              | Revoke an API key                            |
| GET    | `/api/stats`                     | Public counters                              |
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
