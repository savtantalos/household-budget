# 4. Where the data is stored

## The short answer

In a **single file: `backend/budget.db`**, an SQLite database. Nothing is stored in
the browser; nothing is stored in the cloud. Delete that file and you are back to an
empty budget (re-seed it with `python -m app.seed`).

It is deliberately git-ignored, because it is *your* data, not code.

## Why SQLite

- Zero setup: no server to install, no password, no ports. The "database server" is a
  library inside the Python process.
- It is a real SQL database — transactions, joins, constraints — so nothing you learn
  here is wasted, and moving to PostgreSQL later is a connection-string change.
- One file means backup = copy the file, and versioning = copy it with a date.

Trade-off: SQLite handles one writer at a time. Fine for two people on a laptop; you
would switch to PostgreSQL before putting it on the public internet with many users.

## How Python talks to it

`backend/app/db.py` is the whole connection layer:

```python
DATABASE_URL = os.getenv("BUDGET_DATABASE_URL", "sqlite:///./budget.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
```

- **engine** = the connection pool, created once for the process.
- **`sqlite:///./budget.db`** = the file, relative to wherever you started uvicorn
  (so always start it from `backend/`).
- **`BUDGET_DATABASE_URL`** = override it to move the data, e.g.
  `BUDGET_DATABASE_URL=sqlite:////home/you/Dropbox/budget.db` (four slashes = absolute
  path) or a `postgresql://…` URL.
- **`check_same_thread=False`** is required because FastAPI serves requests from a
  thread pool while SQLite defaults to one-thread-only connections.
- **`get_session()`** yields a short-lived `Session` per request; FastAPI injects it
  into every endpoint via `Depends(get_session)` and closes it afterwards. A session
  is a unit of work: it batches your changes and writes them on `commit()`.

`init_db()` runs `SQLModel.metadata.create_all(engine)` at startup, which issues
`CREATE TABLE IF NOT EXISTS` for every model — that is why you never run a setup
script by hand.

## The tables

Defined in `backend/app/models.py`. Each Python class = one table; each attribute =
one column.

```
person                     income                    expense
──────────                 ──────────                ─────────────
id        PK               id            PK          id         PK
name      unique           person_id     FK→person   payer_id   FK→person
colour                     label                     label
                           amount                    amount
                           frequency                 category
                                                     due_day
transfer                   savingsplan               shared     (bool)
──────────                 ──────────                frequency
id             PK          id            PK
from_person_id FK→person   person_id     FK→person   account
to_person_id   FK→person   label                     ─────────────
label                      monthly_amount            id          PK
amount                                               person_id   FK→person
months_remaining                                     institution
                                                     balance
                                                     as_of  (date)
```

- **PK** = primary key, the row's id, assigned by SQLite on insert.
- **FK** = foreign key, an integer pointing at a `person.id`. That is how the app
  knows the mortgage is paid by Georgia without duplicating her name in every row.

### What each table is for

| Table | Meaning | Example row |
| --- | --- | --- |
| `person` | Who is in the household | `Savvas`, colour `#2f6fed` |
| `income` | Money coming in | Savvas, "Salary", 6000, monthly |
| `expense` | Money going out, with a payer and a `shared` flag | Georgia, "Mortgage", 3000, housing, shared |
| `transfer` | Recurring money moving *between* the two of you | Georgia → Savvas, "Barclays loan", 778.62 |
| `savingsplan` | Intended monthly saving per person | Savvas, 2500 |
| `account` | A balance snapshot for net worth | Savvas, Barclays, 55259, as of today |

### What is *not* stored

Every derived number — totals, fair shares, settlements, projections — is computed on
demand in `budget.py`. Storing them would mean keeping them in sync forever; computing
them means they cannot be stale. This is the database equivalent of "no hard-coded
values in cells".

## Seed data

`backend/app/seed.py` holds your spreadsheet's numbers as plain Python lists and
inserts them if the database is empty. `python -m app.seed --reset` wipes the tables
first. It is the only place your original figures are hard-coded, so it doubles as a
record of the starting point.

## Looking at the data directly

```bash
cd backend
sqlite3 budget.db ".tables"
sqlite3 budget.db "SELECT label, amount, shared FROM expense ORDER BY amount DESC;"
sqlite3 budget.db ".dump" > backup-$(date +%F).sql   # plain-text backup
cp budget.db budget-$(date +%F).db                    # or just copy the file
```

Or use the API without the UI: <http://127.0.0.1:8000/docs>.

## Changing the shape of the data later

`create_all` only creates *missing* tables — it will not add a column to a table that
already exists. When you add a field to a model you have three options:

1. **Delete and re-seed** (fine while the data is disposable):
   `rm budget.db && python -m app.seed`
2. **Add the column by hand**: `ALTER TABLE expense ADD COLUMN notes TEXT;`
3. **Use migrations** (the grown-up answer): add Alembic, which records each schema
   change as a versioned script you can apply to a database that holds real data.

## Moving to PostgreSQL (when/if)

```bash
pip install psycopg[binary]
export BUDGET_DATABASE_URL=postgresql+psycopg://user:pass@localhost/budget
```

No other code changes: SQLModel/SQLAlchemy generates the right SQL per dialect. Do
this when you want the app hosted, multiple writers, or real backups.
