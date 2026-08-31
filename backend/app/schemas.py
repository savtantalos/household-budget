from datetime import date

from sqlmodel import Field, SQLModel

from .models import Frequency


class PersonCreate(SQLModel):
    name: str
    colour: str = "#2f6fed"


class PersonUpdate(SQLModel):
    name: str | None = None
    colour: str | None = None


class IncomeCreate(SQLModel):
    person_id: int
    label: str
    amount: float
    frequency: Frequency = Frequency.monthly


class IncomeUpdate(SQLModel):
    person_id: int | None = None
    label: str | None = None
    amount: float | None = None
    frequency: Frequency | None = None


class ExpenseCreate(SQLModel):
    payer_id: int
    label: str
    amount: float
    category: str = "general"
    due_day: int | None = None
    shared: bool = True
    frequency: Frequency = Frequency.monthly


class ExpenseUpdate(SQLModel):
    payer_id: int | None = None
    label: str | None = None
    amount: float | None = None
    category: str | None = None
    due_day: int | None = None
    shared: bool | None = None
    frequency: Frequency | None = None


class TransferCreate(SQLModel):
    from_person_id: int
    to_person_id: int
    label: str
    amount: float
    months_remaining: int | None = None


class TransferUpdate(SQLModel):
    from_person_id: int | None = None
    to_person_id: int | None = None
    label: str | None = None
    amount: float | None = None
    months_remaining: int | None = None


class SavingsPlanCreate(SQLModel):
    person_id: int
    label: str = "Monthly savings"
    monthly_amount: float


class SavingsPlanUpdate(SQLModel):
    person_id: int | None = None
    label: str | None = None
    monthly_amount: float | None = None


class InvestmentCreate(SQLModel):
    person_id: int
    name: str
    category: str = "index fund"
    balance: float = 0.0
    monthly_contribution: float = 0.0
    annual_return_pct: float = 5.0


class InvestmentUpdate(SQLModel):
    person_id: int | None = None
    name: str | None = None
    category: str | None = None
    balance: float | None = None
    monthly_contribution: float | None = None
    annual_return_pct: float | None = None


class AccountCreate(SQLModel):
    person_id: int
    institution: str
    balance: float
    as_of: date | None = None


class AccountUpdate(SQLModel):
    person_id: int | None = None
    institution: str | None = None
    balance: float | None = None
    as_of: date | None = None


class PersonSummaryOut(SQLModel):
    id: int
    name: str
    income: float
    paid_shared: float
    paid_personal: float
    fair_share: float
    transfers_out: float
    transfers_in: float
    savings: float
    net_worth: float
    settlement: float
    true_cost: float
    remaining: float
    remaining_after_savings: float


class SettlementOut(SQLModel):
    from_person: str
    to_person: str
    amount: float


class SummaryOut(SQLModel):
    people: list[PersonSummaryOut]
    settlements: list[SettlementOut]
    total_income: float
    total_expenses: float
    shared_expenses: float
    personal_expenses: float
    total_savings: float
    net_worth: float
    cash_balance: float
    spend_ratio: float


class ProjectionPointOut(SQLModel):
    month: int
    year: float
    contributed: float
    balance: float


class ProjectionOut(SQLModel):
    starting_balance: float
    monthly_contribution: float
    annual_return_pct: float
    points: list[ProjectionPointOut]


class LumpSumIn(SQLModel):
    month: int = Field(ge=1)
    amount: float = Field(ge=0)


class MortgageIn(SQLModel):
    principal: float = Field(gt=0)
    annual_rate_pct: float = Field(ge=0, le=25)
    term_years: int = Field(ge=1, le=40)
    monthly_overpayment: float = Field(default=0.0, ge=0)
    lump_sums: list[LumpSumIn] = []


class MortgagePointOut(SQLModel):
    month: int
    year: float
    balance: float
    interest_paid: float
    principal_paid: float
    baseline_balance: float


class MortgageOut(SQLModel):
    monthly_payment: float
    months_to_repay: int
    total_interest: float
    total_paid: float
    baseline_months_to_repay: int
    baseline_total_interest: float
    interest_saved: float
    months_saved: int
    points: list[MortgagePointOut]


class InvestVsOverpayIn(SQLModel):
    principal: float = Field(gt=0)
    annual_rate_pct: float = Field(ge=0, le=25)
    term_years: int = Field(ge=1, le=40)
    monthly_amount: float = Field(gt=0)
    annual_return_pct: float = Field(ge=0, le=30)


class InvestVsOverpayPointOut(SQLModel):
    month: int
    year: float
    invest_wealth: float
    overpay_wealth: float


class InvestVsOverpayOut(SQLModel):
    monthly_payment: float
    invest_final_pot: float
    invest_total_interest: float
    overpay_months_to_repay: int
    overpay_final_pot: float
    overpay_total_interest: float
    winner: str
    advantage: float
    points: list[InvestVsOverpayPointOut]
