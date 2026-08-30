from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from . import schemas
from .budget import build_summary, project_savings
from .crud import crud_router
from .db import get_session, init_db
from .models import Account, Expense, Income, Person, SavingsPlan, Transfer


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(title="Household Budget", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    crud_router(
        model=Person,
        create_model=schemas.PersonCreate,
        update_model=schemas.PersonUpdate,
        prefix="/people",
        tag="people",
    ),
    crud_router(
        model=Income,
        create_model=schemas.IncomeCreate,
        update_model=schemas.IncomeUpdate,
        prefix="/incomes",
        tag="incomes",
    ),
    crud_router(
        model=Expense,
        create_model=schemas.ExpenseCreate,
        update_model=schemas.ExpenseUpdate,
        prefix="/expenses",
        tag="expenses",
    ),
    crud_router(
        model=Transfer,
        create_model=schemas.TransferCreate,
        update_model=schemas.TransferUpdate,
        prefix="/transfers",
        tag="transfers",
    ),
    crud_router(
        model=SavingsPlan,
        create_model=schemas.SavingsPlanCreate,
        update_model=schemas.SavingsPlanUpdate,
        prefix="/savings-plans",
        tag="savings plans",
    ),
    crud_router(
        model=Account,
        create_model=schemas.AccountCreate,
        update_model=schemas.AccountUpdate,
        prefix="/accounts",
        tag="accounts",
    ),
):
    app.include_router(router, prefix="/api")


@app.get("/api/summary", response_model=schemas.SummaryOut, tags=["summary"])
def get_summary(session: Session = Depends(get_session)) -> schemas.SummaryOut:
    summary = build_summary(
        people=list(session.exec(select(Person)).all()),
        incomes=list(session.exec(select(Income)).all()),
        expenses=list(session.exec(select(Expense)).all()),
        transfers=list(session.exec(select(Transfer)).all()),
        plans=list(session.exec(select(SavingsPlan)).all()),
        accounts=list(session.exec(select(Account)).all()),
    )
    return schemas.SummaryOut(
        people=[
            schemas.PersonSummaryOut(
                id=p.id,
                name=p.name,
                income=round(p.income, 2),
                paid_shared=round(p.paid_shared, 2),
                paid_personal=round(p.paid_personal, 2),
                fair_share=round(p.fair_share, 2),
                transfers_out=round(p.transfers_out, 2),
                transfers_in=round(p.transfers_in, 2),
                savings=round(p.savings, 2),
                net_worth=round(p.net_worth, 2),
                settlement=round(p.settlement, 2),
                true_cost=round(p.true_cost, 2),
                remaining=round(p.remaining, 2),
                remaining_after_savings=round(p.remaining_after_savings, 2),
            )
            for p in summary.people
        ],
        settlements=[
            schemas.SettlementOut(
                from_person=s.from_person, to_person=s.to_person, amount=s.amount
            )
            for s in summary.settlements
        ],
        total_income=round(summary.total_income, 2),
        total_expenses=round(summary.total_expenses, 2),
        shared_expenses=round(summary.shared_expenses, 2),
        personal_expenses=round(summary.personal_expenses, 2),
        total_savings=round(summary.total_savings, 2),
        net_worth=round(summary.net_worth, 2),
        cash_balance=round(summary.cash_balance, 2),
        spend_ratio=round(summary.spend_ratio, 4),
    )


@app.get("/api/projection", response_model=schemas.ProjectionOut, tags=["summary"])
def get_projection(
    years: int = Query(5, ge=1, le=50),
    annual_return_pct: float = Query(0.0, ge=-20, le=30),
    person_id: int | None = Query(None),
    session: Session = Depends(get_session),
) -> schemas.ProjectionOut:
    plans = list(session.exec(select(SavingsPlan)).all())
    accounts = list(session.exec(select(Account)).all())
    if person_id is not None:
        plans = [p for p in plans if p.person_id == person_id]
        accounts = [a for a in accounts if a.person_id == person_id]

    monthly_contribution = sum(p.monthly_amount for p in plans)
    starting_balance = sum(a.balance for a in accounts)
    points = project_savings(
        starting_balance=starting_balance,
        monthly_contribution=monthly_contribution,
        years=years,
        annual_return_pct=annual_return_pct,
    )
    return schemas.ProjectionOut(
        starting_balance=round(starting_balance, 2),
        monthly_contribution=round(monthly_contribution, 2),
        annual_return_pct=annual_return_pct,
        points=[
            schemas.ProjectionPointOut(
                month=p.month, year=p.year, contributed=p.contributed, balance=p.balance
            )
            for p in points
        ],
    )


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
