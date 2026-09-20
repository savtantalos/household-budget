from datetime import date
from enum import Enum

from sqlmodel import Field, SQLModel


class Frequency(str, Enum):
    monthly = "monthly"
    yearly = "yearly"
    one_off = "one_off"


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str


class Person(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str = Field(index=True)
    colour: str = "#2f6fed"


class Income(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    person_id: int = Field(foreign_key="person.id", index=True)
    label: str
    amount: float
    frequency: Frequency = Frequency.monthly


class Expense(SQLModel, table=True):
    """A recurring household cost, paid by one person.

    ``shared`` expenses are split evenly between everyone; personal ones are
    carried entirely by the payer.
    """

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    payer_id: int = Field(foreign_key="person.id", index=True)
    label: str
    amount: float
    category: str = "general"
    due_day: int | None = None
    shared: bool = True
    frequency: Frequency = Frequency.monthly


class Category(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str = Field(index=True)


class Transfer(SQLModel, table=True):
    """A recurring payment from one person to another (e.g. a personal loan)."""

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    from_person_id: int = Field(foreign_key="person.id", index=True)
    to_person_id: int = Field(foreign_key="person.id", index=True)
    label: str
    amount: float
    months_remaining: int | None = None


class SavingsPlan(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    person_id: int = Field(foreign_key="person.id", index=True)
    label: str = "Monthly savings"
    monthly_amount: float


class Investment(SQLModel, table=True):
    """A holding that grows: current value, monthly top-up, expected return."""

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    person_id: int = Field(foreign_key="person.id", index=True)
    name: str
    category: str = "index fund"
    balance: float = 0.0
    monthly_contribution: float = 0.0
    annual_return_pct: float = 5.0
    color: str | None = None


class SplitMode(str, Enum):
    """How shared costs are settled between people."""

    even = "even"
    difference = "difference"


class Setting(SQLModel, table=True):
    """Single-row household preferences and persisted simulation inputs per user."""

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    split_mode: SplitMode = SplitMode.even

    # Mortgage simulator defaults
    mortgage_principal: float = 300000.0
    mortgage_rate_pct: float = 4.5
    mortgage_term_years: int = 25
    mortgage_overpayment: float = 0.0
    mortgage_lump_sums: str = "[]"

    # Invest-vs-overpay simulator defaults
    invest_principal: float = 300000.0
    invest_mortgage_rate_pct: float = 4.5
    invest_term_years: int = 25
    invest_monthly_amount: float = 500.0
    invest_annual_return_pct: float = 7.0

    # User-selected chart colours, stored as a JSON map keyed by series id.
    chart_colors: str = "{}"


class Account(SQLModel, table=True):
    """A point-in-time balance for a savings/investment account."""

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    person_id: int = Field(foreign_key="person.id", index=True)
    institution: str
    balance: float
    as_of: date = Field(default_factory=date.today)
