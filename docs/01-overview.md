# 1. Overview

## What this replaces

Your spreadsheet did four jobs:

1. listed income for both of you,
2. listed monthly expenses and who pays them,
3. worked out who owes who once the shared costs are split evenly,
4. projected savings forward a number of years.

The web app does the same four jobs, but the numbers live in a database instead of
cells, and the formulas live in Python instead of `=SUM(...)`.

## Why two halves

A spreadsheet is one file that is both the data *and* the formulas *and* the display.
A web app separates those concerns:

| Half | Lives where | Job |
| --- | --- | --- |
| **Frontend** (React + TypeScript) | Runs *in your browser* | Draw the tables, charts and buttons; send your edits to the backend |
| **Backend** (Python + FastAPI) | Runs *on a server* (your laptop for now) | Own the data, do the maths, expose an API |

The browser cannot read a database directly — it has no file access and it would be
unsafe to hand out database credentials to every visitor. So the frontend asks the
backend over HTTP, and only the backend touches the database.

```
   You  ──clicks/types──▶  Browser (React)
                              │  HTTP request  (fetch)
                              ▼
                          FastAPI (Python)
                              │  SQL
                              ▼
                          SQLite file (budget.db)
```

## The rule that keeps it simple

**The database is the single source of truth, and the backend computes every derived
number.** The frontend never calculates the settlement or the totals itself; it asks
`GET /api/summary` and renders whatever comes back. That means the maths is written
once, is unit-tested, and cannot drift between the dashboard and the tables.

## Repository layout

```
budget-app/
├── backend/
│   ├── app/
│   │   ├── models.py    # database tables
│   │   ├── schemas.py   # shapes of API requests/responses
│   │   ├── db.py        # database connection
│   │   ├── crud.py      # generic create/read/update/delete endpoints
│   │   ├── budget.py    # the maths (pure functions, no database)
│   │   ├── main.py      # the app: wires routes together, /summary, /projection
│   │   └── seed.py      # loads your spreadsheet numbers as starting data
│   └── tests/           # pytest tests for the maths and the API
├── frontend/
│   └── src/
│       ├── api.ts       # the only file that talks HTTP
│       ├── types.ts     # TypeScript mirrors of the backend shapes
│       ├── useBudget.ts # loads everything, exposes refresh()
│       ├── App.tsx      # tabs + layout
│       └── components/  # Dashboard, ExpensesPanel, IncomePanel, SavingsPanel
└── docs/                # you are here
```
