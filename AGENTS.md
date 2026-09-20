# Agent rules for Household Budget

## Persistence rule

All data that a user creates or modifies through the website must be persisted to the SQLite database via the FastAPI backend.

This includes:

- Budget entities: people, incomes, expenses, transfers, savings plans, accounts, investments, categories.
- Household settings: split mode, categories list.
- Simulator inputs and state: mortgage simulator inputs (amount owed, rate, term, overpayment, lump sums) and the invest-vs-overpay comparison inputs (mortgage amount, rate, term, spare cash, investment return) are stored in the `Setting` table.

Do not leave user-facing state in local React component state only. If a value needs to survive a tab change, page refresh, or log out/log in, it must be saved to the backend and associated with the current user.

When adding new UI state, prefer extending the `Setting` table or creating a new per-user table. Avoid using `localStorage` for data that should be shared across devices or durable after the browser session ends.
