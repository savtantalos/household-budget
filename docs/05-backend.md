# 5. Backend reference

Stack: **FastAPI** (web framework) + **SQLModel** (models/ORM, built on SQLAlchemy +
Pydantic) + **Uvicorn** (server) + **SQLite** (storage).

## 5.1 File by file

| File | Responsibility |
| --- | --- |
| `app/db.py` | Engine, `init_db()`, per-request `get_session()` |
| `app/models.py` | Table definitions (`Person`, `Income`, `Expense`, `Transfer`, `SavingsPlan`, `Account`) |
| `app/schemas.py` | Request/response shapes — what the API accepts and returns |
| `app/crud.py` | `crud_router()` factory: list/create/update/delete for any model |
| `app/budget.py` | Pure maths: normalisation, splitting, settlement, projection, mortgage |
| `app/main.py` | App creation, CORS, router wiring, `/api/summary`, `/api/projection`, `/api/mortgage`, `/api/health` |
| `app/seed.py` | Inserts the starting budget |
| `tests/` | `test_budget.py` (maths), `test_api.py` (HTTP behaviour) |

## 5.2 Models vs schemas — why both?

`models.Expense` describes a **database row**. `schemas.ExpenseCreate` /
`ExpenseUpdate` describe **what a client may send**. They are separate so that:

- clients cannot set `id` (the database owns it),
- `Create` can require fields that `Update` makes optional,
- you can later hide internal columns from the API without changing the table.

`Update` models have every field `Optional`, and endpoints use
`model_dump(exclude_unset=True)` so an omitted field is untouched rather than nulled.

## 5.3 The CRUD factory

Six resources need the same four endpoints. Rather than writing 24 near-identical
functions, `crud.py` builds them:

```python
def crud_router(*, model, create_model, update_model, prefix, tag) -> APIRouter:
    @router.get("",             response_model=list[model]) ...   # list
    @router.post("",            response_model=model, status_code=201) ...  # create
    @router.patch("/{item_id}", response_model=model) ...          # partial update
    @router.delete("/{item_id}", status_code=204) ...              # delete
```

`main.py` then does:

```python
crud_router(model=Expense, create_model=schemas.ExpenseCreate,
            update_model=schemas.ExpenseUpdate, prefix="/expenses", tag="expenses")
```

Missing rows raise `HTTPException(404)`, which FastAPI turns into a JSON error.

## 5.4 Endpoints

Base path: `/api`.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/people` `/incomes` `/expenses` `/transfers` `/savings-plans` `/accounts` `/investments` | – | array of rows |
| POST | same paths | the object without `id` | created row, 201 |
| PATCH | `<path>/{id}` | any subset of fields | updated row |
| DELETE | `<path>/{id}` | – | 204 no content |
| GET | `/summary` | – | totals, per-person breakdown, settlements |
| GET | `/settings` | – | household preferences (`split_mode`) |
| PATCH | `/settings` | `split_mode`: `even` or `difference` | the saved preferences |
| GET | `/projection?years=&annual_return_pct=&person_id=` | – | monthly balance points |
| POST | `/mortgage` | principal, rate, term, overpayments | repayment, term, interest, balance points |
| GET | `/investment-projection?years=` | – | every stored investment grown at its own return, summed |
| POST | `/invest-vs-overpay` | mortgage terms, spare monthly cash, expected return | which strategy wins, interest per side, wealth points |
| GET | `/health` | – | `{"status": "ok"}` |

`/mortgage` and `/invest-vs-overpay` are the odd ones out: POSTs that write nothing.
They are calculators, and their inputs have to travel in a JSON body rather than a
query string.

Interactive docs: <http://127.0.0.1:8000/docs> (Swagger UI, generated from the code).

### `/api/summary` response

```json
{
  "people": [{
    "id": 1, "name": "Savvas",
    "income": 6000.0,
    "paid_shared": 397.35,      // what they actually paid into shared costs
    "paid_personal": 406.0,     // their own costs (gym, car)
    "fair_share": 1898.67,      // half of the shared pot
    "transfers_out": 0.0, "transfers_in": 778.62,
    "savings": 2500.0, "net_worth": 57009.0,
    "settlement": -722.70,      // negative = they owe
    "true_cost": 1526.06,       // what the month really costs them
    "remaining": 4473.94,
    "remaining_after_savings": 1973.94
  }, { "...": "Georgia" }],
  "settlements": [{ "from_person": "Savvas", "to_person": "Georgia", "amount": 722.70 }],
  "total_income": 10750.0, "total_expenses": 4203.35,
  "shared_expenses": 3797.35, "personal_expenses": 406.0,
  "total_savings": 3500.0, "net_worth": 88009.0,
  "cash_balance": 6546.65, "spend_ratio": 0.391,
  "split_mode": "even"          // how shared costs are settled
}
```

`/summary` is a pure read: it loads the budget tables plus the `split_mode` setting,
hands them to `budget.build_summary()`, and rounds the result for display. Changing
`split_mode` therefore changes every fair share, settlement and true cost on the next
`/summary` call — nothing is recalculated in the browser.

## 5.5 Dependency injection

```python
def get_summary(session: Session = Depends(get_session)) -> SummaryOut:
```

`Depends(get_session)` tells FastAPI to open a database session, pass it in, and close
it when the response is sent. Tests exploit this: `test_api.py` overrides
`app.dependency_overrides[get_session]` with an in-memory SQLite session, so the whole
API is tested without touching your real `budget.db`.

## 5.6 Startup and CORS

```python
@asynccontextmanager
async def lifespan(app): init_db(); yield          # create tables on boot
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", ...])
```

The lifespan hook replaces the deprecated `@app.on_event("startup")`. CORS is what
lets a page served from port 5173 call port 8000 directly (see doc 02).

## 5.7 Tests

```bash
cd backend && .venv/bin/pytest        # 12 tests
```

- `test_budget.py` rebuilds your household in memory and asserts the totals match the
  spreadsheet (income 10,750; expenses 4,203.35; balance 6,546.65; settlement 722.70).
- `test_api.py` seeds an in-memory database and drives real HTTP: create → summary
  changes → patch → summary changes → delete → summary back to the start.
