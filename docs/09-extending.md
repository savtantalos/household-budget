# 9. Extending the app

Three recipes, smallest first. Each one shows the full set of files a change touches —
that pattern repeats for almost any feature.

## 9.1 Add a field to an existing table

Goal: a free-text `notes` on each expense.

1. **Model** — `backend/app/models.py`:
   ```python
   class Expense(SQLModel, table=True):
       ...
       notes: str | None = None
   ```
2. **Schemas** — `backend/app/schemas.py`: add `notes: str | None = None` to
   `ExpenseCreate` and `ExpenseUpdate`.
3. **Database** — the column will not appear in an existing file. Either
   `rm backend/budget.db && python -m app.seed`, or
   `sqlite3 budget.db "ALTER TABLE expense ADD COLUMN notes TEXT;"`.
4. **Types** — `frontend/src/types.ts`: `notes: string | null`.
5. **UI** — a cell in `ExpensesPanel.tsx` following the existing `onBlur` pattern.

No changes to `crud.py`: the generic router already handles any field.

## 9.2 Add a whole resource

Goal: track one-off purchases separately (a `Purchase` table).

1. `models.py` — new `Purchase(SQLModel, table=True)` class.
2. `schemas.py` — `PurchaseCreate` / `PurchaseUpdate`.
3. `main.py` — one more entry in the `crud_router(...)` tuple with
   `prefix="/purchases"`. That is the entire backend API.
4. `budget.py` + `tests/test_budget.py` — only if it should affect the summary.
5. `types.ts`, `api.ts` (`purchases: resource<Purchase>('/purchases')`),
   `useBudget.ts` (fetch it), a new component, and a tab in `App.tsx`.

## 9.3 Change a rule

Goal: split shared costs by income instead of evenly.

Only `build_summary` in `backend/app/budget.py` changes:

```python
for person in by_id.values():
    person.fair_share = (
        summary.shared_expenses * person.income / summary.total_income
        if summary.total_income else 0.0
    )
```

Then update the expectations in `tests/test_budget.py`. Nothing in the frontend moves —
it renders whatever `fair_share` and `settlement` come back as. That is the payoff of
keeping derived numbers server-side.

## 9.4 Ideas worth building next

| Idea | Where the work is |
| --- | --- |
| Month-by-month history instead of one "current" month | New `month` column (or a `BudgetMonth` table) + a month selector in the UI |
| Actual vs budgeted (import bank CSV) | New `Transaction` table + an upload endpoint + a comparison view |
| Honour `Transfer.months_remaining` so loans end | `build_summary` + a projection that steps month by month |
| Mortgage amortisation page | New pure function in `budget.py` + a chart component |
| Multiple households / login | Auth (FastAPI users + JWT), a `household_id` on every table |
| Deploy it | Doc 08 §8.6 |

## 9.5 House rules

- Derived numbers belong in `budget.py`, never in the browser.
- Every rule change gets a test in `tests/test_budget.py` — that suite is your safety
  net when the formulas get more interesting.
- Keep `api.ts` the only place that calls `fetch`.
- Keep `schemas.py` and `types.ts` in step; they are the contract.
