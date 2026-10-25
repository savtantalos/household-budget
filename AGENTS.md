# Agent rules for Household Budget

## Persistence rule

All data that a user creates or modifies through the website must be persisted to the SQLite database via the FastAPI backend.

This includes:

- Budget entities: people, incomes, expenses, transfers, savings plans, accounts, investments, categories.
- Household settings: split mode, categories list.
- Simulator inputs and state: savings years/annual return, investment projection years, mortgage inputs (amount owed, rate, term, overpayment, lump sums and draft month/amount), invest-vs-overpay inputs (mortgage amount, rate, term, spare cash, investment return), and chart colours are stored in the per-user `Setting` table.

Do not leave user-facing state in local React component state only. If a value needs to survive a tab change, page refresh, or log out/log in, it must be saved to the backend and associated with the current user.

When adding new UI state, prefer extending the `Setting` table or creating a new per-user table. Avoid using `localStorage` for data that should be shared across devices or durable after the browser session ends.

Chart controls receive settings and `onSettingsChange` from `BudgetApp`. Keep chart saves in the shared settings store, not in panel effects whose cleanup can cancel saves during tab changes. Calculation requests may still be debounced.

## Verification

- Frontend settings-store regression tests: `cd frontend && npm test` (Node 22.18+ or 24+, using native TypeScript stripping; no extra test dependencies).
- Include rapid edits, switching tabs during saves, failed-save retries, reloads, and per-user isolation when changing chart persistence.
