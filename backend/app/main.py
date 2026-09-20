from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, delete, select

from . import schemas
from .auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from .budget import (
    LumpSum,
    build_summary,
    compare_invest_vs_overpay,
    project_savings,
    simulate_mortgage,
)
from .crud import crud_router
from .db import get_session, init_db
from .models import (
    Account,
    Category,
    Expense,
    Income,
    Investment,
    Person,
    SavingsPlan,
    Setting,
    Transfer,
    User,
)


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

def _delete_person_with_dependents(session: Session, person: Person) -> None:
    session.exec(delete(Income).where(Income.person_id == person.id))
    session.exec(delete(Expense).where(Expense.payer_id == person.id))
    session.exec(delete(Transfer).where(Transfer.from_person_id == person.id))
    session.exec(delete(Transfer).where(Transfer.to_person_id == person.id))
    session.exec(delete(SavingsPlan).where(SavingsPlan.person_id == person.id))
    session.exec(delete(Investment).where(Investment.person_id == person.id))
    session.exec(delete(Account).where(Account.person_id == person.id))


for router in (
    crud_router(
        model=Person,
        create_model=schemas.PersonCreate,
        update_model=schemas.PersonUpdate,
        prefix="/people",
        tag="people",
        pre_delete=_delete_person_with_dependents,
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
        model=Investment,
        create_model=schemas.InvestmentCreate,
        update_model=schemas.InvestmentUpdate,
        prefix="/investments",
        tag="investments",
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


def _load_category(
    session: Session, category_id: int, user: User
) -> Category:
    category = session.get(Category, category_id)
    if category is None or category.user_id != user.id:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@app.get("/api/categories", response_model=list[Category], tags=["categories"])
def list_categories(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[Category]:
    return list(session.exec(select(Category).where(Category.user_id == user.id)).all())


@app.post("/api/categories", response_model=Category, status_code=201, tags=["categories"])
def create_category(
    payload: schemas.CategoryCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Category:
    existing = session.exec(
        select(Category).where(
            Category.user_id == user.id,
            Category.name == payload.name.strip().lower(),
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category already exists")
    category = Category(user_id=user.id, name=payload.name.strip().lower())
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@app.patch(
    "/api/categories/{category_id}", response_model=Category, tags=["categories"]
)
def update_category(
    category_id: int,
    payload: schemas.CategoryUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Category:
    category = _load_category(session, category_id, user)
    new_name = (payload.name or category.name).strip().lower()
    if new_name != category.name:
        if session.exec(
            select(Category).where(
                Category.user_id == user.id,
                Category.name == new_name,
                Category.id != category.id,
            )
        ).first():
            raise HTTPException(status_code=409, detail="Category already exists")
        for expense in session.exec(
            select(Expense).where(
                Expense.user_id == user.id,
                Expense.category == category.name,
            )
        ).all():
            expense.category = new_name
        category.name = new_name
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@app.delete("/api/categories/{category_id}", status_code=204, tags=["categories"])
def delete_category(
    category_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> None:
    category = _load_category(session, category_id, user)
    in_use = session.exec(
        select(Expense).where(
            Expense.user_id == user.id,
            Expense.category == category.name,
        )
    ).first()
    if in_use:
        raise HTTPException(
            status_code=409,
            detail="Category is in use by expenses; reassign them first",
        )
    session.delete(category)
    session.commit()


@app.post("/api/auth/register", response_model=schemas.Token, tags=["auth"])
def register(
    payload: schemas.UserCreate, session: Session = Depends(get_session)
) -> schemas.Token:
    if session.exec(select(User).where(User.email == payload.email)).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return schemas.Token(
        access_token=create_access_token(user.id), token_type="bearer"
    )


@app.post("/api/auth/login", response_model=schemas.Token, tags=["auth"])
def login(
    payload: schemas.UserCreate, session: Session = Depends(get_session)
) -> schemas.Token:
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return schemas.Token(
        access_token=create_access_token(user.id), token_type="bearer"
    )


@app.get("/api/auth/me", response_model=schemas.UserOut, tags=["auth"])
def me(user: User = Depends(get_current_user)) -> schemas.UserOut:
    return schemas.UserOut(id=user.id, email=user.email)


def _settings(session: Session, user_id: int) -> Setting:
    """The single settings row for a user, created with defaults on first use."""
    setting = session.exec(
        select(Setting).where(Setting.user_id == user_id)
    ).first()
    if setting is None:
        setting = Setting(user_id=user_id)
        session.add(setting)
        session.commit()
        session.refresh(setting)
    return setting


def _settings_out(setting: Setting) -> schemas.SettingsOut:
    return schemas.SettingsOut(
        split_mode=setting.split_mode,
        mortgage_principal=setting.mortgage_principal,
        mortgage_rate_pct=setting.mortgage_rate_pct,
        mortgage_term_years=setting.mortgage_term_years,
        mortgage_overpayment=setting.mortgage_overpayment,
        mortgage_lump_sums=setting.mortgage_lump_sums,
        invest_principal=setting.invest_principal,
        invest_mortgage_rate_pct=setting.invest_mortgage_rate_pct,
        invest_term_years=setting.invest_term_years,
        invest_monthly_amount=setting.invest_monthly_amount,
        invest_annual_return_pct=setting.invest_annual_return_pct,
        chart_colors=setting.chart_colors,
    )


@app.get("/api/settings", response_model=schemas.SettingsOut, tags=["settings"])
def get_settings(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> schemas.SettingsOut:
    return _settings_out(_settings(session, user.id))


@app.patch("/api/settings", response_model=schemas.SettingsOut, tags=["settings"])
def patch_settings(
    payload: schemas.SettingsUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> schemas.SettingsOut:
    setting = _settings(session, user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(setting, key, value)
    session.add(setting)
    session.commit()
    session.refresh(setting)
    return _settings_out(setting)


@app.get("/api/summary", response_model=schemas.SummaryOut, tags=["summary"])
def get_summary(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> schemas.SummaryOut:
    summary = build_summary(
        people=list(
            session.exec(select(Person).where(Person.user_id == user.id)).all()
        ),
        incomes=list(
            session.exec(select(Income).where(Income.user_id == user.id)).all()
        ),
        expenses=list(
            session.exec(select(Expense).where(Expense.user_id == user.id)).all()
        ),
        transfers=list(
            session.exec(select(Transfer).where(Transfer.user_id == user.id)).all()
        ),
        plans=list(
            session.exec(
                select(SavingsPlan).where(SavingsPlan.user_id == user.id)
            ).all()
        ),
        accounts=list(
            session.exec(select(Account).where(Account.user_id == user.id)).all()
        ),
        split_mode=_settings(session, user.id).split_mode,
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
        split_mode=summary.split_mode,
    )


@app.get("/api/projection", response_model=schemas.ProjectionOut, tags=["summary"])
def get_projection(
    years: int = Query(5, ge=1, le=50),
    annual_return_pct: float = Query(0.0, ge=-20, le=30),
    person_id: int | None = Query(None),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> schemas.ProjectionOut:
    plans = list(
        session.exec(select(SavingsPlan).where(SavingsPlan.user_id == user.id)).all()
    )
    accounts = list(
        session.exec(select(Account).where(Account.user_id == user.id)).all()
    )
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
    plan_projections = [
        schemas.SeriesProjectionOut(
            id=plan.id,
            name=plan.label,
            points=[
                schemas.SeriesProjectionPointOut(
                    month=p.month, year=p.year, balance=p.balance
                )
                for p in project_savings(
                    starting_balance=0.0,
                    monthly_contribution=plan.monthly_amount,
                    years=years,
                    annual_return_pct=annual_return_pct,
                )
            ],
        )
        for plan in plans
    ]
    account_projections = [
        schemas.SeriesProjectionOut(
            id=account.id,
            name=account.institution,
            points=[
                schemas.SeriesProjectionPointOut(
                    month=p.month, year=p.year, balance=p.balance
                )
                for p in project_savings(
                    starting_balance=account.balance,
                    monthly_contribution=0.0,
                    years=years,
                    annual_return_pct=annual_return_pct,
                )
            ],
        )
        for account in accounts
    ]
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
        plans=plan_projections,
        accounts=account_projections,
    )


@app.post("/api/mortgage", response_model=schemas.MortgageOut, tags=["summary"])
def post_mortgage(payload: schemas.MortgageIn) -> schemas.MortgageOut:
    """Amortise a mortgage, with optional regular and one-off overpayments."""
    result = simulate_mortgage(
        principal=payload.principal,
        annual_rate_pct=payload.annual_rate_pct,
        term_years=payload.term_years,
        monthly_overpayment=payload.monthly_overpayment,
        lump_sums=[
            LumpSum(month=lump.month, amount=lump.amount) for lump in payload.lump_sums
        ],
    )
    return schemas.MortgageOut(
        monthly_payment=result.monthly_payment,
        months_to_repay=result.months_to_repay,
        total_interest=result.total_interest,
        total_paid=result.total_paid,
        baseline_months_to_repay=result.baseline_months_to_repay,
        baseline_total_interest=result.baseline_total_interest,
        interest_saved=result.interest_saved,
        months_saved=result.months_saved,
        points=[
            schemas.MortgagePointOut(
                month=p.month,
                year=p.year,
                balance=p.balance,
                interest_paid=p.interest_paid,
                principal_paid=p.principal_paid,
                baseline_balance=p.baseline_balance,
            )
            for p in result.points
        ],
    )


@app.get(
    "/api/investment-projection", response_model=schemas.ProjectionOut, tags=["summary"]
)
def get_investment_projection(
    years: int = Query(10, ge=1, le=50),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> schemas.ProjectionOut:
    """Grow every investment at its own expected return and sum the results."""
    investments = list(
        session.exec(select(Investment).where(Investment.user_id == user.id)).all()
    )
    months = years * 12
    totals = [0.0] * (months + 1)
    contributed = [0.0] * (months + 1)
    investment_projections: list[schemas.InvestmentProjectionOut] = []
    for inv in investments:
        points = project_savings(
            starting_balance=inv.balance,
            monthly_contribution=inv.monthly_contribution,
            years=years,
            annual_return_pct=inv.annual_return_pct,
        )
        for p in points:
            totals[p.month] += p.balance
            contributed[p.month] += p.contributed
        investment_projections.append(
            schemas.InvestmentProjectionOut(
                id=inv.id,
                name=inv.name,
                points=[
                    schemas.InvestmentProjectionPointOut(
                        month=p.month, year=p.year, balance=p.balance
                    )
                    for p in points
                ],
            )
        )
    return schemas.ProjectionOut(
        starting_balance=round(sum(inv.balance for inv in investments), 2),
        monthly_contribution=round(
            sum(inv.monthly_contribution for inv in investments), 2
        ),
        annual_return_pct=0.0,
        points=[
            schemas.ProjectionPointOut(
                month=month,
                year=round(month / 12, 2),
                contributed=round(contributed[month], 2),
                balance=round(totals[month], 2),
            )
            for month in range(months + 1)
        ],
        investments=investment_projections,
    )


@app.post(
    "/api/invest-vs-overpay", response_model=schemas.InvestVsOverpayOut, tags=["summary"]
)
def post_invest_vs_overpay(
    payload: schemas.InvestVsOverpayIn,
) -> schemas.InvestVsOverpayOut:
    """Compare investing spare cash against overpaying the mortgage with it."""
    result = compare_invest_vs_overpay(
        principal=payload.principal,
        annual_rate_pct=payload.annual_rate_pct,
        term_years=payload.term_years,
        monthly_amount=payload.monthly_amount,
        annual_return_pct=payload.annual_return_pct,
    )
    return schemas.InvestVsOverpayOut(
        monthly_payment=result.monthly_payment,
        invest_final_pot=result.invest_final_pot,
        invest_total_interest=result.invest_total_interest,
        overpay_months_to_repay=result.overpay_months_to_repay,
        overpay_final_pot=result.overpay_final_pot,
        overpay_total_interest=result.overpay_total_interest,
        winner=result.winner,
        advantage=result.advantage,
        points=[
            schemas.InvestVsOverpayPointOut(
                month=p.month,
                year=p.year,
                invest_wealth=p.invest_wealth,
                overpay_wealth=p.overpay_wealth,
            )
            for p in result.points
        ],
    )


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
