# 10. Glossary

**API** — Application Programming Interface. Here: the set of URLs the backend exposes
so the frontend can read and write data.

**REST** — a convention for APIs where URLs name *things* (`/api/expenses/7`) and HTTP
verbs name *actions* (GET read, POST create, PATCH update, DELETE remove).

**HTTP verbs** — GET (read, no side effects), POST (create), PATCH (partial update),
PUT (full replace, unused here), DELETE.

**Status codes** — 200 OK, 201 Created, 204 No Content (success, empty body),
404 Not Found, 422 Unprocessable Entity (validation failed), 500 server error.

**JSON** — the text format the two halves exchange: `{"amount": 400, "shared": true}`.

**Endpoint** — one URL + verb pair, e.g. `PATCH /api/expenses/{id}`.

**Frontend / client** — code running in the browser. **Backend / server** — code
running on a machine you control.

**Origin** — scheme + host + port, e.g. `http://localhost:5173`. Browsers block a page
from calling a *different* origin unless that server opts in.

**CORS** — Cross-Origin Resource Sharing: the response headers by which the backend
opts in to being called from another origin.

**Proxy** — a middleman that forwards requests. Vite proxies `/api` to port 8000 so the
browser thinks everything is one origin.

**SQL** — the query language databases speak (`SELECT * FROM expense`).

**SQLite** — a database that is just a file, with no separate server process.

**ORM** — Object-Relational Mapper. Lets you write `session.get(Expense, 7)` instead of
SQL, mapping rows to Python objects. Here: SQLModel on top of SQLAlchemy.

**Engine / session** — the connection pool, and a short-lived unit of work that batches
changes until `commit()`.

**Primary key (PK)** — the unique id of a row. **Foreign key (FK)** — a column holding
another table's id, e.g. `expense.payer_id → person.id`.

**Schema** — either the shape of a database table, or (in `schemas.py`) the shape of an
API payload. Context decides.

**Migration** — a versioned script that changes the database shape without losing data
(Alembic). Not used yet; `create_all` only creates missing tables.

**Seed data** — starting rows inserted into an empty database (`app/seed.py`).

**Pydantic** — the Python library that validates incoming JSON against a declared shape
and produces clear 422 errors.

**FastAPI** — the Python web framework: maps URLs to functions, validates with
Pydantic, and generates the `/docs` page.

**Uvicorn** — the process that actually listens on the port and runs FastAPI.

**Dependency injection** — FastAPI supplying arguments (like a database session) to
your endpoint via `Depends(...)`, which also makes them easy to replace in tests.

**React** — the UI library. **Component** — a function returning markup (`Dashboard`).
**Props** — inputs passed into a component. **State** — data a component remembers
between renders. **Hook** — a function starting with `use` that adds state or effects
(`useState`, `useEffect`, and our own `useBudget`).

**Controlled vs uncontrolled input** — React owns the value (`value` + `onChange`) vs
the DOM owns it and React reads it on blur (`defaultValue` + `onBlur`).

**TypeScript** — JavaScript with types checked before the code runs.

**Vite** — the dev server and bundler; hot-reloads in dev, produces `dist/` for
production.

**Bundle** — the compiled JS/CSS the browser downloads.

**Recharts** — the React charting library used for the pie, bar and area charts.

**Linter** — a tool that flags suspicious code (`ruff` for Python, `oxlint` for
TypeScript). **Type-check** — `tsc`, run as part of `npm run build`.

**Pure function** — output depends only on its inputs, no I/O. Everything in
`budget.py` is pure, which is why it is easy to test.

**Fixture** — reusable test setup (`client` in `tests/test_api.py`).

**venv** — an isolated Python environment holding this project's packages.
