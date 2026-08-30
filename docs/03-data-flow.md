# 3. Data flow — reading and writing

This is the doc that answers "how does the frontend link to the backend?".

## 3.1 Reading: what happens when you open the page

1. Chrome loads `http://localhost:5173` and runs `src/main.tsx` → `App.tsx`.
2. `App` calls the hook `useBudget()` (`src/useBudget.ts`). On first render its
   `useEffect` fires `refresh()`.
3. `refresh()` issues **seven parallel HTTP GETs** through `src/api.ts`:

   ```
   GET /api/people          GET /api/incomes      GET /api/expenses
   GET /api/transfers       GET /api/savings-plans GET /api/accounts
   GET /api/summary
   ```

4. Vite forwards each to `127.0.0.1:8000`. FastAPI matches the path to a Python
   function, that function queries SQLite via SQLModel, and returns rows.
5. FastAPI serialises the result to JSON:

   ```json
   [{ "id": 1, "payer_id": 2, "label": "Mortgage", "amount": 3000.0,
      "category": "housing", "due_day": null, "shared": true, "frequency": "monthly" }]
   ```

6. `useBudget` stores all seven responses in React state (`setData({...})`).
7. React re-renders. `Dashboard` receives `summary` and `expenses` as props and draws
   the stat cards, the settlement list and the charts.

```
useBudget()  ──7×fetch──▶  Vite proxy  ──▶  FastAPI  ──SELECT──▶  SQLite
    ▲                                                                │
    └────────────────  JSON  ◀──────────────────────────────────────┘
                         │
                         ▼
              React state → components render
```

## 3.2 Writing: what happens when you edit an expense amount

Say you change the gym from £368 to £400 on the Expenses tab.

1. **You blur the input.** `ExpensesPanel` renders an *uncontrolled* input
   (`defaultValue`), so React does not fight your typing. The `onBlur` handler
   compares the new value with the old one and only acts if it changed:

   ```tsx
   onBlur={(event) => {
     const value = Number(event.target.value)
     if (value !== expense.amount) void patch(expense, { amount: value })
   }}
   ```

2. **`patch` calls the API layer**, which sends a partial update:

   ```
   PATCH /api/expenses/7
   Content-Type: application/json

   { "amount": 400 }
   ```

   `PATCH` (not `PUT`) means "change only these fields"; everything else is left alone.

3. **FastAPI validates** the body against `ExpenseUpdate` in `schemas.py`. Every field
   there is optional, and `model_dump(exclude_unset=True)` gives back *only* the keys
   you actually sent — so a missing key is never mistaken for `null`.

4. **The row is updated** in `crud.py`:

   ```python
   item = load(session, item_id)                  # SELECT … WHERE id = 7
   for key, value in payload.items():
       setattr(item, key, value)                  # in-memory change
   session.commit()                               # UPDATE expense SET amount = 400 …
   ```

5. **The frontend refetches.** `patch` awaits `onChange()`, which is `refresh()` from
   `useBudget` — the same seven GETs as on load. The dashboard totals, the pie chart
   and the settlement line all change together because they all come from the freshly
   computed `/api/summary`.

```
input onBlur → api.expenses.update(id, {amount}) → PATCH /api/expenses/7
                                                        │
                                     UPDATE …  ◀────────┘
                                                        │
        refresh()  ◀── await ─────────────────────────  ┘
             │
             └─ 7 GETs → new state → re-render
```

### Why refetch everything instead of patching state locally?

Because one edit changes *many* derived numbers (each person's fair share, the
settlement, the spend ratio, the pie chart). Re-reading the server's answer keeps the
screen honest and keeps the maths in exactly one place. The payload is a few
kilobytes, so on a local database it is instant. If the dataset ever grew, the next
step would be a caching library (TanStack Query) that does the same thing with
deduplication and background updates.

## 3.3 Creating and deleting

Same pattern, different verb:

| Action in the UI | HTTP | Backend result |
| --- | --- | --- |
| "Add" form submit | `POST /api/expenses` with the full object | `INSERT`, returns the row with its new `id` (HTTP 201) |
| "Delete" button | `DELETE /api/expenses/7` | `DELETE`, returns HTTP 204 with no body |
| Inline edit | `PATCH /api/expenses/7` | `UPDATE` only the given fields |
| Page load | `GET /api/expenses` | `SELECT *` |

That four-verb mapping is what "REST API" means in practice.

## 3.4 The one file that talks HTTP

`frontend/src/api.ts` is the *only* place in the frontend that calls `fetch`.
Components never build URLs. It defines one helper per resource with the same four
methods:

```ts
export const api = {
  people:       resource<Person>('/people'),
  incomes:      resource<Income>('/incomes'),
  expenses:     resource<Expense>('/expenses'),
  transfers:    resource<Transfer>('/transfers'),
  savingsPlans: resource<SavingsPlan>('/savings-plans'),
  accounts:     resource<Account>('/accounts'),
  summary:      () => request<Summary>('/summary'),
  projection:   (years, pct) => request<Projection>(`/projection?years=${years}…`),
}
```

Benefits: error handling and JSON headers exist once; swapping the base URL (e.g. to a
deployed API) is a one-line change; and every call is typed, so `api.expenses.update`
will not accept a field the backend does not have.

## 3.5 The savings simulator (a read-only round trip)

Dragging the sliders in `SavingsPanel` does **not** write anything. A `useEffect`
watches `years` and `returnPct` and refetches
`GET /api/projection?years=10&annual_return_pct=5`. The compounding happens in Python
(`budget.project_savings`) and the chart just draws the returned points — again, no
duplicate maths in the browser.
