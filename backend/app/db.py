import os
from collections.abc import Iterator

from sqlalchemy import inspect
from sqlmodel import Session, SQLModel, create_engine, text

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
)

DATABASE_URL = os.getenv("BUDGET_DATABASE_URL", "sqlite:///./budget.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

USER_SCOPED_TABLES = [
    Person,
    Income,
    Expense,
    Transfer,
    SavingsPlan,
    Investment,
    Account,
    Setting,
    Category,
]


def _ensure_user_id_columns() -> None:
    """One-time migration: add user_id columns to existing tables and assign a default user."""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if "user" not in existing_tables:
        return  # Fresh database; create_all will set up the correct schema.

    tables_missing_user_id: list[str] = []

    with engine.begin() as conn:
        for model in USER_SCOPED_TABLES:
            table_name = model.__tablename__
            if table_name not in existing_tables:
                continue
            columns = {c["name"] for c in inspector.get_columns(table_name)}
            if "user_id" in columns:
                continue
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN user_id INTEGER"))
            tables_missing_user_id.append(table_name)

        # Person previously had a globally unique name index; replace it with a
        # per-user uniqueness constraint by recreating the table without it.
        if "person" in existing_tables:
            for idx in inspector.get_indexes("person"):
                if idx.get("unique") and "name" in idx.get("column_names", []):
                    conn.execute(text(f"DROP INDEX {idx['name']}"))

        if tables_missing_user_id:
            default_email = "user@example.com"
            default_password = "password"
            result = conn.execute(
                text("SELECT id FROM user WHERE email = :email"),
                {"email": default_email},
            ).fetchone()
            if result is None:
                from .auth import hash_password

                conn.execute(
                    text(
                        "INSERT INTO user (email, hashed_password) VALUES (:email, :password)"
                    ),
                    {
                        "email": default_email,
                        "password": hash_password(default_password),
                    },
                )
                result = conn.execute(
                    text("SELECT id FROM user WHERE email = :email"),
                    {"email": default_email},
                ).fetchone()
            user_id = result[0]  # type: ignore[index]

            for model in USER_SCOPED_TABLES:
                table_name = model.__tablename__
                if table_name not in existing_tables:
                    continue
                columns = {c["name"] for c in inspector.get_columns(table_name)}
                if "user_id" in columns:
                    continue
                conn.execute(
                    text(f"UPDATE {table_name} SET user_id = :user_id"),
                    {"user_id": user_id},
                )


def _ensure_setting_columns() -> None:
    """Add any Setting columns introduced after the initial schema."""
    inspector = inspect(engine)
    if "setting" not in inspector.get_table_names():
        return

    existing = {c["name"] for c in inspector.get_columns("setting")}
    columns_to_add = [
        ("mortgage_principal", "REAL DEFAULT 300000"),
        ("mortgage_rate_pct", "REAL DEFAULT 4.5"),
        ("mortgage_term_years", "INTEGER DEFAULT 25"),
        ("mortgage_overpayment", "REAL DEFAULT 0"),
        ("mortgage_lump_sums", "TEXT DEFAULT '[]'"),
        ("invest_principal", "REAL DEFAULT 300000"),
        ("invest_mortgage_rate_pct", "REAL DEFAULT 4.5"),
        ("invest_term_years", "INTEGER DEFAULT 25"),
        ("invest_monthly_amount", "REAL DEFAULT 500"),
        ("invest_annual_return_pct", "REAL DEFAULT 7"),
        ("chart_colors", "TEXT DEFAULT '{}'"),
    ]

    with engine.begin() as conn:
        for name, definition in columns_to_add:
            if name not in existing:
                conn.execute(text(f"ALTER TABLE setting ADD COLUMN {name} {definition}"))


def _ensure_default_categories() -> None:
    """Create Category rows from categories already used in expenses."""
    inspector = inspect(engine)
    if "category" not in inspector.get_table_names():
        return

    with Session(engine) as session:
        for user in session.execute(text("SELECT id FROM user")).all():
            user_id = user[0]  # type: ignore[index]
            existing = {
                c[0]  # type: ignore[index]
                for c in session.execute(
                    text("SELECT name FROM category WHERE user_id = :user_id"),
                    {"user_id": user_id},
                ).all()
            }
            for row in session.execute(
                text("SELECT DISTINCT category FROM expense WHERE user_id = :user_id"),
                {"user_id": user_id},
            ).all():
                name = row[0]  # type: ignore[index]
                if name and name.lower() not in existing:
                    session.execute(
                        text(
                            "INSERT INTO category (user_id, name) VALUES (:user_id, :name)"
                        ),
                        {"user_id": user_id, "name": name.lower()},
                    )
        session.commit()


def _ensure_investment_color_column() -> None:
    """Add the optional color column to existing investment tables."""
    inspector = inspect(engine)
    if "investment" not in inspector.get_table_names():
        return

    columns = {c["name"] for c in inspector.get_columns("investment")}
    if "color" in columns:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE investment ADD COLUMN color VARCHAR"))


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_user_id_columns()
    _ensure_setting_columns()
    _ensure_default_categories()
    _ensure_investment_color_column()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
