"""Seed the database with the household's current budget.

Run with ``python -m app.seed`` (add ``--reset`` to wipe existing rows first).
Use ``--user-id`` to seed a specific user's household, or ``--email`` to create
a new user and seed them.
"""

import argparse
from datetime import date

from sqlmodel import Session, delete, select

from .auth import hash_password
from .db import engine, init_db
from .models import (
    Account,
    Category,
    Expense,
    Income,
    Investment,
    Person,
    SavingsPlan,
    Transfer,
    User,
)

PEOPLE = [("Savvas", "#2f6fed"), ("Georgia", "#e0629b")]

INCOMES = [("Savvas", "Salary", 6000.0), ("Georgia", "Salary", 4750.0)]

# (payer, label, amount, category, shared)
EXPENSES = [
    ("Georgia", "Mortgage", 3000.0, "housing", True),
    ("Georgia", "Super", 400.0, "housing", True),
    ("Savvas", "Electricity", 93.0, "utilities", True),
    ("Savvas", "Council tax", 201.0, "utilities", True),
    ("Savvas", "Internet", 45.0, "utilities", True),
    ("Savvas", "Water", 58.35, "utilities", True),
    ("Savvas", "Car service", 38.0, "transport", False),
    ("Savvas", "Gym", 368.0, "lifestyle", False),
]

# (from, to, label, monthly amount, months remaining)
TRANSFERS = [("Georgia", "Savvas", "Barclays loan repayment", 778.62, 48)]

SAVINGS_PLANS = [("Savvas", 2500.0), ("Georgia", 1000.0)]

# (person, name, category, balance, monthly contribution, expected annual return %)
INVESTMENTS = [
    ("Savvas", "Global index fund", "index fund", 10000.0, 500.0, 7.0),
    ("Georgia", "Stocks & shares ISA", "ISA", 5000.0, 250.0, 5.0),
]

ACCOUNTS = [
    ("Savvas", "Barclays", 55259.0),
    ("Savvas", "Revolut", 1750.0),
    ("Georgia", "Barclays", 31000.0),
]


def _get_or_create_user(
    session: Session, user_id: int | None, email: str | None
) -> User:
    if user_id is not None:
        user = session.get(User, user_id)
        if user is None:
            raise ValueError(f"User {user_id} does not exist")
        return user

    if email is not None:
        existing = session.exec(select(User).where(User.email == email)).first()
        if existing:
            return existing
        user = User(email=email, hashed_password=hash_password("password"))
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    first = session.exec(select(User)).first()
    if first is None:
        first = User(email="user@example.com", hashed_password=hash_password("password"))
        session.add(first)
        session.commit()
        session.refresh(first)
    return first


def seed(
    session: Session,
    reset: bool = False,
    user_id: int | None = None,
    email: str | None = None,
) -> None:
    user = _get_or_create_user(session, user_id, email)

    if reset:
        for model in (
            Account,
            Investment,
            SavingsPlan,
            Transfer,
            Expense,
            Income,
            Person,
        ):
            session.exec(delete(model).where(model.user_id == user.id))
        session.commit()

    if session.exec(select(Person).where(Person.user_id == user.id)).first() is not None:
        return

    people = {}
    for name, colour in PEOPLE:
        person = Person(user_id=user.id, name=name, colour=colour)
        session.add(person)
        people[name] = person
    session.commit()

    for name, label, amount in INCOMES:
        session.add(
            Income(
                user_id=user.id, person_id=people[name].id, label=label, amount=amount
            )
        )

    for payer, label, amount, category, shared in EXPENSES:
        session.add(
            Expense(
                user_id=user.id,
                payer_id=people[payer].id,
                label=label,
                amount=amount,
                category=category,
                shared=shared,
            )
        )

    for sender, receiver, label, amount, months in TRANSFERS:
        session.add(
            Transfer(
                user_id=user.id,
                from_person_id=people[sender].id,
                to_person_id=people[receiver].id,
                label=label,
                amount=amount,
                months_remaining=months,
            )
        )

    for name, amount in SAVINGS_PLANS:
        session.add(
            SavingsPlan(user_id=user.id, person_id=people[name].id, monthly_amount=amount)
        )

    for name, label, category, balance, contribution, return_pct in INVESTMENTS:
        session.add(
            Investment(
                user_id=user.id,
                person_id=people[name].id,
                name=label,
                category=category,
                balance=balance,
                monthly_contribution=contribution,
                annual_return_pct=return_pct,
            )
        )

    for name, institution, balance in ACCOUNTS:
        session.add(
            Account(
                user_id=user.id,
                person_id=people[name].id,
                institution=institution,
                balance=balance,
                as_of=date.today(),
            )
        )

    session.commit()

    # Seed categories used by the sample expenses.
    expense_categories = {category.lower() for _, _, _, category, _ in EXPENSES}
    existing_categories = {
        c.name
        for c in session.exec(
            select(Category).where(Category.user_id == user.id)
        ).all()
    }
    for category in expense_categories:
        if category not in existing_categories:
            session.add(Category(user_id=user.id, name=category))
    session.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="delete existing rows first")
    parser.add_argument("--user-id", type=int, help="seed data for this user id")
    parser.add_argument(
        "--email",
        type=str,
        default="user@example.com",
        help="create or use this user and seed them (default: user@example.com)",
    )
    args = parser.parse_args()

    init_db()
    with Session(engine) as session:
        seed(session, reset=args.reset, user_id=args.user_id, email=args.email)
    print("Seeded budget database.")


if __name__ == "__main__":
    main()
