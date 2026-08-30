# 2. Architecture

## The four moving parts

```
┌────────────────────────────────────────────────────────────────────┐
│ Your machine                                                       │
│                                                                    │
│  ┌──────────────────────┐        ┌───────────────────────────┐     │
│  │ Chrome               │        │ Vite dev server :5173     │     │
│  │  React app (JS in    │◀──────▶│  - serves the JS/CSS      │     │
│  │  the page)           │        │  - proxies /api ─────────┐│     │
│  └──────────────────────┘        └──────────────────────────┼┘     │
│                                                             │      │
│                                   ┌─────────────────────────▼──┐   │
│                                   │ Uvicorn + FastAPI :8000    │   │
│                                   │  /api/expenses, /api/...   │   │
│                                   └─────────────┬──────────────┘   │
│                                                 │ SQL              │
│                                   ┌─────────────▼──────────────┐   │
│                                   │ backend/budget.db (SQLite) │   │
│                                   └────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

1. **Chrome** runs the compiled React app. All the UI logic (tabs, forms, charts) is
   JavaScript executing inside the page.
2. **Vite** (`npm run dev`, port 5173) serves that JavaScript during development and
   hot-reloads it when you edit a file. It also acts as a **proxy**: any request the
   page makes to `/api/...` is forwarded to `http://127.0.0.1:8000/api/...`.
3. **Uvicorn** is the Python web server; **FastAPI** is the framework that maps URLs
   to Python functions. This is the only thing allowed to touch the database.
4. **SQLite** is the database: a single file, `backend/budget.db`.

## Why the proxy exists

The page is served from `localhost:5173` but the API lives on `localhost:8000`.
Browsers treat different ports as different "origins" and block cross-origin requests
by default (the *same-origin policy*). Two things solve that here:

- **Dev**: the Vite proxy (`frontend/vite.config.ts`) makes the API look like it is on
  the same origin — the browser only ever sees `localhost:5173/api/...`.
- **Belt and braces**: the backend also enables CORS for `localhost:5173`
  (`backend/app/main.py`), so a direct call to port 8000 works too.

In production you would build the frontend (`npm run build` → static files in
`frontend/dist/`) and serve those files from the same host as the API, or from a CDN
pointed at the API's domain. Then the proxy is not needed.

## The contract between the halves

The two halves only agree on one thing: **the shape of the JSON**. That contract is
written down twice, deliberately:

| Side | File | Purpose |
| --- | --- | --- |
| Python | `backend/app/schemas.py` | Validates incoming JSON, defines outgoing JSON |
| TypeScript | `frontend/src/types.ts` | Lets the editor catch mistakes before you run anything |

If you change one, change the other. FastAPI publishes the live contract as OpenAPI —
visit <http://127.0.0.1:8000/docs> while the backend runs to browse and *try* every
endpoint without the UI.

## Layers inside the backend

```
HTTP request
   │
   ▼
main.py / crud.py     ← routing, HTTP status codes, validation via schemas.py
   │
   ▼
budget.py             ← pure maths: no HTTP, no database, easy to unit-test
   │
   ▲
   │
models.py + db.py     ← SQLModel classes ↔ SQL tables
```

Keeping `budget.py` free of HTTP and database code is the single most useful decision
in the codebase: `backend/tests/test_budget.py` checks the settlement formulas by
calling plain Python functions with plain objects.
