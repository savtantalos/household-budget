# 8. Running it locally

## 8.1 First time

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt   # runtime + pytest/ruff
.venv/bin/python -m app.seed                    # load the starting budget

# Frontend
cd ../frontend
npm install
```

## 8.2 Every time — two terminals

```bash
# terminal 1
cd backend && .venv/bin/uvicorn app.main:app --reload

# terminal 2
cd frontend && npm run dev
```

Open <http://localhost:5173>. API docs at <http://127.0.0.1:8000/docs>.

Both servers hot-reload: save a `.py` file and uvicorn restarts; save a `.tsx` file
and the browser updates without losing your place.

## 8.3 Checks before committing

```bash
cd backend  && .venv/bin/ruff check . && .venv/bin/pytest
cd frontend && npm run lint && npm run build
```

`npm run build` runs `tsc`, so it is the type-check too.

## 8.4 Useful one-liners

```bash
# reset the data to the seeded budget
cd backend && .venv/bin/python -m app.seed --reset

# start completely empty
rm backend/budget.db

# poke the API without the UI
curl -s localhost:8000/api/summary | python3 -m json.tool
curl -s -X POST localhost:8000/api/expenses \
  -H 'Content-Type: application/json' \
  -d '{"payer_id":1,"label":"Netflix","amount":15.99,"shared":true,"category":"lifestyle"}'
```

## 8.5 Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| UI shows "Could not reach the API" | Backend not running, or started from the wrong directory — run uvicorn from `backend/` |
| `no such table: person` | `budget.db` created before the models existed; delete it and re-seed |
| Numbers look wrong after editing a file | uvicorn reloaded but the browser cached state; refresh the page |
| `Cannot find native binding` on `npm run build` | npm's optional-dependency bug — `rm -rf node_modules package-lock.json && npm install` |
| Port already in use | `uvicorn --port 8001` (and update the proxy target) or kill the old process |
| Changed a model, column missing | `create_all` never alters existing tables — see doc 04 §"Changing the shape" |

## 8.6 Deploying later (sketch)

1. `cd frontend && npm run build` → static files in `dist/`.
2. Serve `dist/` from any static host, and point it at the API's public URL.
3. Run the API with `uvicorn app.main:app --host 0.0.0.0` behind a reverse proxy.
4. Move to PostgreSQL, add authentication (right now anyone who can reach the API can
   edit the budget — fine on `localhost`, not on the internet).
