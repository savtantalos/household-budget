from datetime import date
from enum import Enum

from sqlmodel import Field, SQLModel


class Frequency(str, Enum):
    monthly = "monthly"
    yearly = "yearly"
    one_off = "one_off"


class Person(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    colour: str = "#2f6fed"


class Income(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
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
    payer_id: int = Field(foreign_key="person.id", index=True)
    label: str
    amount: float
    category: str = "general"
    due_day: int | None = None
    shared: bool = True
    frequency: Frequency = Frequency.monthly


class Transfer(SQLModel, table=True):
    """A recurring payment from one person to another (e.g. a personal loan)."""

    id: int | None = Field(default=None, primary_key=True)
    from_person_id: int = Field(foreign_key="person.id", index=True)
    to_person_id: int = Field(foreign_key="person.id", index=True)
    label: str
    amount: float
    months_remaining: int | None = None


class SavingsPlan(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    person_id: int = Field(foreign_key="person.id", index=True)
    label: str = "Monthly savings"
    monthly_amount: float


class Account(SQLModel, table=True):
    """A point-in-time balance for a savings/investment account."""

    id: int | None = Field(default=None, primary_key=True)
    person_id: int = Field(foreign_key="person.id", index=True)
    institution: str
    balance: float
    as_of: date = Field(default_factory=date.today)
