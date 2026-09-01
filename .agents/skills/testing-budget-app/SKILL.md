---
name: testing-budget-app
description: How to run and browser-test the household budget app (FastAPI + React/Vite), including the Mortgage simulator tab.
---

# Testing the household budget app

## Running it
- Backend: `cd backend && .venv/bin/uvicorn app.main:app --port 8000` (SQLite at `backend/budget.db`).
- Frontend: `cd frontend && npm run dev` → http://localhost:5173, proxies `/api` to :8000.
- No auth. Re-seed with `cd backend && .venv/bin/python -m app.seed --reset` if data drifts.
- Check both are up before opening the browser: `curl -s localhost:8000/api/health` and `curl -o /dev/null -w '%{http_code}' localhost:5173/`.
- Servers may already be running from a previous session; the UI may also be left in a dirty state — press F5 first, since panel inputs (Mortgage sliders/lump sums) are local React state only and reset on reload.

## Known-good seed values (use as assertions)
- Dashboard: Monthly income £10,750.00, Monthly expenses £4,203.35, Net worth £88,009.00, settlement "Savvas pays Georgia £722.70".
- Mortgage defaults (£300,000 / 4.5% / 25y / £0 overpayment): monthly repayment £1,667.50, life "25 years", total interest £200,249.23, interest saved £0.00, both chart series coincide.
- Editing a *shared* expense paid by Savvas by +£100 (e.g. Electricity 93→193) moves the settlement by exactly -£50 (£722.70 → £672.70). Personal/unshared items (Gym, Car service) do NOT change the settlement — pick a shared one if you want the settlement to move. Always revert edits afterwards; they persist to SQLite.

## Mortgage tab specifics
- Reached via the "Mortgage" nav button (last tab). Sliders: amount £25k–£1M step 5k, rate 0–12% step 0.05, term 1–40y, overpayment £0–£3,000 step 25.
- Sliders are easiest to drive precisely with click-then-`Home`/`End`/arrow keys; use a real mouse drag (with a mid-drag screenshot) when you must prove dragging works.
- Requests to `POST /api/mortgage` are debounced 200 ms — wait ~1-2 s after a change before asserting.
- Lump-sum form validates client-side (`month >= 1`, non-zero amount) and via Pydantic (`month >= 1`, `amount >= 0`, rate <= 25, term 1–40). Empty/negative inputs are silently ignored or blocked by native tooltips; months beyond the term horizon (e.g. 999) are accepted and ignored.
- Cosmetic quirk to expect, not a bug: the chart only plots points where `month % 3 == 0`, so very short simulations (e.g. paid off in 1 month) render an almost empty chart with a single dot.
- Any non-2xx from the API renders a red "Could not run the simulation." card — its absence is decent evidence there were no 422/500s.

## Devin Secrets Needed
None — the app is local and unauthenticated.
