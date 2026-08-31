# Household Budget

A web version of the household budget spreadsheet: two people, shared and personal
expenses, who-owes-who settlement, savings tracking and a savings simulator.

- **Backend** — FastAPI + SQLModel on SQLite (`backend/`)
- **Frontend** — React + TypeScript + Vite + Recharts (`frontend/`)

## Run it

```bash
# terminal 1 - API on http://127.0.0.1:8000 (docs at /docs)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.seed          # loads the current budget as starting data
.venv/bin/uvicorn app.main:app --reload

# terminal 2 - UI on http://localhost:5173
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to the backend, so the UI needs no configuration.

## What it does

| Tab | Contents |
| --- | --- |
| Dashboard | Income/expense/cash-balance stats, settlement between the two people, category pie chart, per-person bar chart, full breakdown table |
| Income | Salaries and other income, plus recurring person-to-person transfers (e.g. loan repayments) |
| Expenses | Every monthly cost — editable inline, marked shared or personal, categorised |
| Savings | Monthly savings plans, account balances, and a compound-growth simulator |
| Mortgage | Repayment simulator: monthly overpayments and one-off lump sums vs the original plan, with interest saved and years shaved off |

### How the split works

Shared expenses are pooled and divided evenly between everyone. Each person's
*settlement* is what they paid into the pool minus their fair share, netted against
person-to-person transfers; the dashboard turns those into "X pays Y £Z".
Personal expenses (gym, car) stay with whoever pays them.

## Documentation

Full docs are in [`docs/`](docs/README.md) — architecture, how the frontend and backend
talk to each other, where the data is stored, the budget formulas, and how to extend it.

## Development

```bash
cd backend && .venv/bin/ruff check . && .venv/bin/pytest   # lint + tests
cd frontend && npm run lint && npm run build               # lint + typecheck + build
```

## Data model

`Person`, `Income`, `Expense` (payer + `shared` flag), `Transfer` (person → person),
`SavingsPlan` (monthly contribution) and `Account` (balance snapshot). All budget maths
lives in `backend/app/budget.py` as pure functions, so it is unit-tested without a
database.
