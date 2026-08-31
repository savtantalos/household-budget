# 6. Frontend reference

Stack: **React 19** (UI), **TypeScript** (types), **Vite** (dev server + build),
**Recharts** (charts). No CSS framework — one hand-written stylesheet.

## 6.1 File by file

| File | Responsibility |
| --- | --- |
| `index.html` | The single HTML page; loads `src/main.tsx` |
| `src/main.tsx` | Mounts `<App />` into `<div id="root">` |
| `src/App.tsx` | Header, tab switching, passes data down to panels |
| `src/api.ts` | Every HTTP call (the only `fetch` in the app) |
| `src/types.ts` | TypeScript mirrors of the backend JSON |
| `src/useBudget.ts` | Loads all data, exposes `{ data, loading, error, refresh }` |
| `src/format.ts` | `£` formatting, compact axis labels, percentages |
| `src/components/Dashboard.tsx` | Stats, settlement, pie + bar charts, breakdown table |
| `src/components/IncomePanel.tsx` | Income rows + person-to-person transfers |
| `src/components/ExpensesPanel.tsx` | Editable expense table + add form |
| `src/components/SavingsPanel.tsx` | Savings plans, accounts, simulator sliders + chart |
| `src/components/InvestmentsPanel.tsx` | Investments table, growth chart, invest-vs-overpay comparison |
| `src/components/MortgagePanel.tsx` | Mortgage sliders, lump-sum list, repayment chart |
| `src/components/SliderInput.tsx` | Reusable slider + number box pair, kept in sync |
| `src/App.css` | All styling, driven by CSS custom properties in `:root` |

## 6.2 How state works

There is no Redux/Zustand — the app is small enough for one hook:

```ts
const { data, error, loading, refresh } = useBudget()
```

- `data` holds the six lists **plus** the computed `summary`.
- `refresh()` refetches everything and replaces `data`.
- Every panel receives `onChange={refresh}` and calls it after a successful write.

So the loop is: *render from server state → mutate → refetch → render again*. The
frontend keeps no derived numbers of its own.

The only local state is UI state: the selected tab, the text in the "add" forms, and
the simulator's slider positions.

## 6.3 Inline editing pattern

Table cells are **uncontrolled** inputs (`defaultValue` + `onBlur`) rather than
controlled (`value` + `onChange`):

```tsx
<input
  type="number"
  defaultValue={expense.amount}
  onBlur={(event) => {
    const value = Number(event.target.value)
    if (value !== expense.amount) void patch(expense, { amount: value })
  }}
/>
```

Why: a controlled input would fire a request on every keystroke ("3", "36", "368").
Blur means one request per finished edit, and typing never lags. Dropdowns and
checkboxes *are* controlled, because a single click is already the finished edit.

## 6.4 Charts

Recharts components take an array of objects and map fields to axes/series. Data is
reshaped just before rendering:

```tsx
const byCategory = Object.entries(
  expenses.reduce((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + e.amount }), {})
).map(([name, value]) => ({ name, value }))
```

- **Pie** — spending by category (from the expense rows).
- **Bar** — income / true cost / savings / leftover per person (from `/api/summary`).
- **Area** — savings projection, contributions-only vs with-growth (from
  `/api/projection`, sampled every three months so the axis stays readable).

`ResponsiveContainer` makes them resize with the window.

## 6.5 Types

`types.ts` mirrors `schemas.py`. It buys real safety: `api.expenses.update(id, { amout: 5 })`
fails to compile, and `summary.people[0].fair_share` autocompletes. It is a manual
mirror today; if the API grows, generate it from the OpenAPI schema
(`npx openapi-typescript http://127.0.0.1:8000/openapi.json -o src/types.ts`).

## 6.6 Styling

`App.css` defines a small design system with CSS variables:

```css
:root { --bg: #f4f6fb; --card: #fff; --brand: #2f6fed; --positive: #1f9d6b; --negative: #d94848; }
```

Layout uses CSS grid with `repeat(auto-fit, minmax(...))`, so cards and charts reflow
on narrow screens without media queries. Change the palette in one place to restyle
the whole app.

## 6.7 Commands

```bash
npm run dev      # dev server with hot reload on :5173
npm run build    # type-check (tsc) + production bundle into dist/
npm run lint     # oxlint
npm run preview  # serve the built bundle locally
```

`npm run build` is also the type-check gate — it fails on any TypeScript error.
