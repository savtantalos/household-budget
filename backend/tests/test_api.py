import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select, text
from sqlmodel.pool import StaticPool

from app import db
from app.auth import get_current_user, hash_password
from app.db import get_session
from app.main import app
from app.models import Setting, User
from app.seed import seed


@pytest.fixture(name="client")
def client_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        test_user = User(
            email="test@example.com", hashed_password=hash_password("password")
        )
        session.add(test_user)
        session.commit()
        session.refresh(test_user)

        seed(session, user_id=test_user.id)

        def override_session():
            return session

        def override_current_user():
            return test_user

        app.dependency_overrides[get_session] = override_session
        app.dependency_overrides[get_current_user] = override_current_user
        yield TestClient(app)
        app.dependency_overrides.clear()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_seeded_summary(client):
    summary = client.get("/api/summary").json()

    assert summary["total_income"] == 10750
    assert summary["cash_balance"] == 6546.65
    assert [p["name"] for p in summary["people"]] == ["Savvas", "Georgia"]
    assert summary["settlements"] == [
        {"from_person": "Savvas", "to_person": "Georgia", "amount": 722.7}
    ]


def test_split_mode_setting_changes_the_settlement(client):
    body = client.get("/api/settings").json()
    assert body["split_mode"] == "even"
    assert body["mortgage_principal"] == 300000.0

    updated = client.patch("/api/settings", json={"split_mode": "difference"})
    assert updated.status_code == 200
    assert updated.json()["split_mode"] == "difference"

    summary = client.get("/api/summary").json()
    savvas, georgia = summary["people"]
    assert summary["split_mode"] == "difference"
    assert savvas["fair_share"] == georgia["paid_shared"]
    assert georgia["fair_share"] == savvas["paid_shared"]
    # Georgia paid £3,002.65 more into the shared pot; the loan nets off £778.62.
    assert summary["settlements"] == [
        {"from_person": "Savvas", "to_person": "Georgia", "amount": 2224.03}
    ]

    client.patch("/api/settings", json={"split_mode": "even"})
    assert client.get("/api/summary").json()["settlements"] == [
        {"from_person": "Savvas", "to_person": "Georgia", "amount": 722.7}
    ]


def test_settings_rejects_an_unknown_split_mode(client):
    assert client.patch("/api/settings", json={"split_mode": "vibes"}).status_code == 422


def test_settings_rejects_an_unknown_theme(client):
    assert client.patch("/api/settings", json={"theme": "sepia"}).status_code == 422


CHART_DEFAULTS = {
    "savings_years": 5,
    "savings_annual_return_pct": 5.0,
    "investment_projection_years": 10,
    "mortgage_lump_month": "12",
    "mortgage_lump_amount": "10000",
    "invest_comparison_years": None,
    "invest_return_spread_pct": 3.0,
    "theme": "system",
}

CHART_INPUTS = {
    "savings_years": 17,
    "savings_annual_return_pct": 0.0,
    "investment_projection_years": 23,
    "mortgage_lump_month": "36",
    "mortgage_lump_amount": "12500.50",
    "mortgage_principal": 245000.0,
    "mortgage_rate_pct": 0.0,
    "mortgage_term_years": 20,
    "mortgage_overpayment": 250.0,
    "mortgage_lump_sums": '[{"month":12,"amount":10000},{"month":36,"amount":2500.5}]',
    "invest_principal": 275000.0,
    "invest_mortgage_rate_pct": 0.0,
    "invest_term_years": 30,
    "invest_monthly_amount": 700.0,
    "invest_annual_return_pct": -2.5,
    "invest_comparison_years": 12,
    "invest_return_spread_pct": 4.5,
    "split_mode": "difference",
    "chart_colors": '{"savings":"#123456"}',
    "theme": "dark",
}


@pytest.fixture
def settings_client(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'settings.db'}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    client = TestClient(app)
    try:
        registered = client.post(
            "/api/auth/register",
            json={"email": "first@example.com", "password": "password"},
        )
        assert registered.status_code == 200
        client.headers["Authorization"] = f"Bearer {registered.json()['access_token']}"
        yield client, engine
    finally:
        client.close()
        app.dependency_overrides.clear()
        engine.dispose()


def test_chart_settings_defaults(settings_client):
    client, _ = settings_client
    response = client.get("/api/settings")
    assert response.status_code == 200
    assert {key: response.json()[key] for key in CHART_DEFAULTS} == CHART_DEFAULTS


def test_chart_settings_roundtrip_with_fresh_sessions(settings_client):
    client, engine = settings_client
    updated = client.patch("/api/settings", json=CHART_INPUTS)
    assert updated.status_code == 200
    assert updated.json() == CHART_INPUTS
    assert client.get("/api/settings").json() == CHART_INPUTS

    with Session(engine) as session:
        setting = session.exec(select(Setting)).one()
        assert {key: getattr(setting, key) for key in CHART_INPUTS} == CHART_INPUTS


def test_chart_settings_partial_update_preserves_other_inputs(settings_client):
    client, _ = settings_client
    assert client.patch("/api/settings", json=CHART_INPUTS).status_code == 200
    updates = {"savings_years": 8}
    response = client.patch("/api/settings", json=updates)
    assert response.status_code == 200
    assert response.json() == CHART_INPUTS | updates
    assert client.get("/api/settings").json() == CHART_INPUTS | updates
    assert client.patch("/api/settings", json={}).json() == CHART_INPUTS | updates


def test_chart_settings_are_isolated_between_users(settings_client):
    client, _ = settings_client
    first_headers = dict(client.headers)
    assert client.patch("/api/settings", json=CHART_INPUTS).status_code == 200
    registered = client.post(
        "/api/auth/register",
        json={"email": "second@example.com", "password": "password"},
    )
    assert registered.status_code == 200
    client.headers["Authorization"] = f"Bearer {registered.json()['access_token']}"
    second_defaults = client.get("/api/settings").json()
    assert {key: second_defaults[key] for key in CHART_DEFAULTS} == CHART_DEFAULTS
    second_inputs = {
        "savings_years": 2,
        "savings_annual_return_pct": 9.5,
        "investment_projection_years": 4,
        "mortgage_lump_month": "",
        "mortgage_lump_amount": "0.",
        "invest_comparison_years": 8,
        "invest_return_spread_pct": 1.5,
        "invest_annual_return_pct": -10,
    }
    updated = client.patch("/api/settings", json=second_inputs)
    assert updated.status_code == 200
    assert updated.json() == second_defaults | second_inputs
    assert client.get("/api/settings").json() == second_defaults | second_inputs
    client.headers.update(first_headers)
    assert client.get("/api/settings").json() == CHART_INPUTS


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("savings_years", 0),
        ("savings_years", 31),
        ("savings_years", 1.5),
        ("savings_annual_return_pct", -0.1),
        ("savings_annual_return_pct", 12.1),
        ("investment_projection_years", 0),
        ("investment_projection_years", 41),
        ("investment_projection_years", 1.5),
        ("invest_comparison_years", 0),
        ("invest_comparison_years", 41),
        ("invest_comparison_years", 1.5),
        ("invest_return_spread_pct", -0.1),
        ("invest_return_spread_pct", 15.1),
        ("invest_annual_return_pct", -30.1),
        ("invest_annual_return_pct", 30.1),
    ],
)
def test_chart_settings_reject_out_of_bounds_numbers(client, field, value):
    before = client.get("/api/settings").json()
    response = client.patch("/api/settings", json={field: value})
    assert response.status_code == 422
    assert client.get("/api/settings").json() == before


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("savings_years", 1),
        ("savings_years", 30),
        ("savings_annual_return_pct", 0),
        ("savings_annual_return_pct", 12),
        ("investment_projection_years", 1),
        ("investment_projection_years", 40),
        ("invest_comparison_years", 1),
        ("invest_comparison_years", 40),
        ("invest_return_spread_pct", 0),
        ("invest_return_spread_pct", 15),
        ("invest_annual_return_pct", -30),
        ("invest_annual_return_pct", 30),
    ],
)
def test_chart_settings_accept_number_bounds(client, field, value):
    response = client.patch("/api/settings", json={field: value})
    assert response.status_code == 200
    assert response.json()[field] == value
    assert client.get("/api/settings").json()[field] == value


def test_comparison_horizon_can_reset_to_mortgage_term(settings_client):
    client, _ = settings_client
    assert client.patch("/api/settings", json=CHART_INPUTS).status_code == 200
    reset = {"invest_comparison_years": None}
    response = client.patch("/api/settings", json=reset)
    assert response.status_code == 200
    assert response.json() == CHART_INPUTS | reset
    assert client.get("/api/settings").json() == CHART_INPUTS | reset


def test_chart_settings_migration_preserves_existing_rows(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    monkeypatch.setattr(db, "engine", engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE setting (id INTEGER PRIMARY KEY, user_id INTEGER, "
                "split_mode TEXT, mortgage_principal REAL, mortgage_lump_sums TEXT, "
                "chart_colors TEXT, invest_term_years INTEGER)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO setting VALUES "
                "(1, 7, 'difference', 245000, :lumps, :colors, 18)"
            ),
            {
                "lumps": CHART_INPUTS["mortgage_lump_sums"],
                "colors": CHART_INPUTS["chart_colors"],
            },
        )
    db._ensure_setting_columns()
    with Session(engine) as session:
        setting = session.exec(select(Setting)).one()
        assert setting.user_id == 7
        assert setting.split_mode == "difference"
        assert setting.mortgage_principal == 245000
        assert setting.invest_term_years == 18
        assert setting.mortgage_lump_sums == CHART_INPUTS["mortgage_lump_sums"]
        assert setting.chart_colors == CHART_INPUTS["chart_colors"]
        assert {key: getattr(setting, key) for key in CHART_DEFAULTS} == CHART_DEFAULTS
        setting.savings_years = 18
        setting.mortgage_lump_month = ""
        setting.invest_comparison_years = 9
        setting.invest_return_spread_pct = 6.5
        session.add(setting)
        session.commit()
    db._ensure_setting_columns()
    with Session(engine) as session:
        setting = session.exec(select(Setting)).one()
        assert setting.savings_years == 18
        assert setting.mortgage_lump_month == ""
        assert setting.invest_comparison_years == 9
        assert setting.invest_return_spread_pct == 6.5
        assert setting.mortgage_lump_sums == CHART_INPUTS["mortgage_lump_sums"]
    engine.dispose()


def test_expense_crud_updates_summary(client):
    before = client.get("/api/summary").json()["total_expenses"]

    created = client.post(
        "/api/expenses",
        json={"payer_id": 1, "label": "Netflix", "amount": 15.99, "shared": True},
    )
    assert created.status_code == 201
    expense_id = created.json()["id"]
    assert client.get("/api/summary").json()["total_expenses"] == round(before + 15.99, 2)

    client.patch(f"/api/expenses/{expense_id}", json={"amount": 20})
    assert client.get("/api/summary").json()["total_expenses"] == round(before + 20, 2)

    assert client.delete(f"/api/expenses/{expense_id}").status_code == 204
    assert client.get("/api/summary").json()["total_expenses"] == before


def test_missing_resource_returns_404(client):
    assert client.patch("/api/expenses/9999", json={"amount": 1}).status_code == 404


def test_projection_endpoint(client):
    payload = client.get("/api/projection", params={"years": 3}).json()

    assert payload["monthly_contribution"] == 3500
    assert payload["starting_balance"] == 88009
    assert len(payload["points"]) == 37
    assert payload["points"][-1]["balance"] == 88009 + 3500 * 36


def test_mortgage_endpoint_compares_against_the_original_plan(client):
    response = client.post(
        "/api/mortgage",
        json={
            "principal": 300000,
            "annual_rate_pct": 4.5,
            "term_years": 25,
            "monthly_overpayment": 300,
            "lump_sums": [{"month": 12, "amount": 20000}],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["monthly_payment"] == 1667.5
    assert body["months_to_repay"] < body["baseline_months_to_repay"]
    assert body["interest_saved"] > 0
    assert body["points"][-1]["balance"] == 0.0


def test_mortgage_rejects_a_negative_principal(client):
    response = client.post(
        "/api/mortgage",
        json={"principal": -1, "annual_rate_pct": 4.5, "term_years": 25},
    )
    assert response.status_code == 422


def test_investment_crud(client):
    created = client.post(
        "/api/investments",
        json={
            "person_id": 1,
            "name": "Pension",
            "category": "pension",
            "balance": 20000,
            "monthly_contribution": 400,
            "annual_return_pct": 6,
        },
    )
    assert created.status_code == 201
    investment_id = created.json()["id"]

    listed = client.get("/api/investments").json()
    assert any(item["name"] == "Pension" for item in listed)

    patched = client.patch(
        f"/api/investments/{investment_id}", json={"monthly_contribution": 450}
    )
    assert patched.json()["monthly_contribution"] == 450

    assert client.delete(f"/api/investments/{investment_id}").status_code == 204


def test_investment_projection_sums_every_holding(client):
    payload = client.get("/api/investment-projection", params={"years": 5}).json()

    # Seeded: 10,000 + 5,000 today, 500 + 250 per month.
    assert payload["starting_balance"] == 15000
    assert payload["monthly_contribution"] == 750
    assert len(payload["points"]) == 61
    assert payload["points"][0]["balance"] == 15000
    assert payload["points"][-1]["balance"] > 15000 + 750 * 60  # growth beats deposits


def test_invest_vs_overpay_endpoint(client):
    response = client.post(
        "/api/invest-vs-overpay",
        json={
            "principal": 300000,
            "annual_rate_pct": 4.5,
            "term_years": 25,
            "monthly_amount": 500,
            "annual_return_pct": 7,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["winner"] in {"invest", "overpay", "tie"}
    assert body["comparison_years"] == 25
    assert body["annual_return_pct"] == 7
    assert body["monthly_payment"] == 1667.5
    assert body["invest_months_to_repay"] == 300
    assert body["overpay_months_to_repay"] < 300
    assert body["invest_remaining_balance"] == 0
    assert body["overpay_remaining_balance"] == 0
    assert len(body["points"]) == 301
    assert body["points"][-1]["invest_wealth"] == body["invest_final_pot"] > 0
    assert body["points"][-1]["overpay_wealth"] == body["overpay_final_pot"] > 0
    assert body["invest_net_position"] == body["invest_final_pot"]
    assert body["overpay_net_position"] == body["overpay_final_pot"]
    assert body["invest_growth"] == pytest.approx(
        body["invest_final_pot"] - body["invest_contributed"], abs=0.01
    )
    assert body["overpay_growth"] == pytest.approx(
        body["overpay_final_pot"] - body["overpay_contributed"], abs=0.01
    )
    assert body["interest_saved"] == pytest.approx(
        body["invest_total_interest"] - body["overpay_total_interest"], abs=0.01
    )
    explicit = client.post(
        "/api/invest-vs-overpay",
        json={
            "principal": 300000,
            "annual_rate_pct": 4.5,
            "term_years": 25,
            "monthly_amount": 500,
            "annual_return_pct": 7,
            "comparison_years": 25,
        },
    )
    assert explicit.status_code == 200
    assert explicit.json() == body


def test_invest_vs_overpay_short_horizon_compares_net_positions(client):
    response = client.post(
        "/api/invest-vs-overpay",
        json={
            "principal": 300000,
            "annual_rate_pct": 4.5,
            "term_years": 25,
            "monthly_amount": 500,
            "annual_return_pct": 0,
            "comparison_years": 5,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["comparison_years"] == 5
    assert len(body["points"]) == 61
    assert body["invest_months_to_repay"] == 300
    assert body["overpay_months_to_repay"] > 60
    assert body["invest_remaining_balance"] > body["overpay_remaining_balance"] > 0
    assert body["invest_final_pot"] == body["invest_contributed"] == 30000
    assert body["overpay_final_pot"] == body["overpay_contributed"] == 0
    assert body["invest_growth"] == body["overpay_growth"] == 0
    assert body["points"][0] == {
        "month": 0,
        "year": 0,
        "invest_wealth": 0,
        "overpay_wealth": 0,
        "invest_net_position": -300000,
        "overpay_net_position": -300000,
    }
    for strategy in ("invest", "overpay"):
        assert body[f"{strategy}_net_position"] == pytest.approx(
            body[f"{strategy}_final_pot"] - body[f"{strategy}_remaining_balance"],
            abs=0.01,
        )
        assert body["points"][-1][f"{strategy}_net_position"] == body[
            f"{strategy}_net_position"
        ]
        assert body["points"][-1][f"{strategy}_wealth"] == body[
            f"{strategy}_final_pot"
        ]
    assert body["winner"] == "overpay"
    assert body["advantage"] == pytest.approx(
        body["overpay_net_position"] - body["invest_net_position"], abs=0.01
    )


@pytest.mark.parametrize("annual_return_pct", [-30, -7, 30])
def test_invest_vs_overpay_accepts_return_bounds(client, annual_return_pct):
    response = client.post(
        "/api/invest-vs-overpay",
        json={
            "principal": 300000,
            "annual_rate_pct": 4.5,
            "term_years": 25,
            "monthly_amount": 500,
            "annual_return_pct": annual_return_pct,
            "comparison_years": 1,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["annual_return_pct"] == annual_return_pct
    assert body["comparison_years"] == 1
    assert len(body["points"]) == 13
    if annual_return_pct < 0:
        assert 0 < body["invest_final_pot"] < body["invest_contributed"]
        assert body["invest_growth"] < 0
        assert body["winner"] == "overpay"


@pytest.mark.parametrize("comparison_years", [None, 40])
def test_invest_vs_overpay_accepts_optional_and_max_horizon(client, comparison_years):
    response = client.post(
        "/api/invest-vs-overpay",
        json={
            "principal": 300000,
            "annual_rate_pct": 4.5,
            "term_years": 25,
            "monthly_amount": 500,
            "annual_return_pct": 7,
            "comparison_years": comparison_years,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["comparison_years"] == (comparison_years or 25)
    assert len(body["points"]) == (comparison_years or 25) * 12 + 1


def test_invest_vs_overpay_reports_tie(client):
    response = client.post(
        "/api/invest-vs-overpay",
        json={
            "principal": 300000,
            "annual_rate_pct": 0,
            "term_years": 25,
            "monthly_amount": 500,
            "annual_return_pct": 0,
            "comparison_years": 5,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["winner"] == "tie"
    assert body["advantage"] == 0
    assert body["invest_net_position"] == body["overpay_net_position"]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("comparison_years", 0),
        ("comparison_years", 41),
        ("comparison_years", 1.5),
        ("annual_return_pct", -30.1),
        ("annual_return_pct", 30.1),
    ],
)
def test_invest_vs_overpay_rejects_out_of_bounds_inputs(client, field, value):
    response = client.post(
        "/api/invest-vs-overpay",
        json={
            "principal": 300000,
            "annual_rate_pct": 4.5,
            "term_years": 25,
            "monthly_amount": 500,
            "annual_return_pct": 7,
            field: value,
        },
    )
    assert response.status_code == 422


def test_invest_vs_overpay_rejects_zero_monthly_amount(client):
    response = client.post(
        "/api/invest-vs-overpay",
        json={
            "principal": 300000,
            "annual_rate_pct": 4.5,
            "term_years": 25,
            "monthly_amount": 0,
            "annual_return_pct": 7,
        },
    )
    assert response.status_code == 422


def _use_fake_model(responses):
    from langchain_core.language_models.fake_chat_models import FakeListChatModel

    from app.chat import get_chat_model

    app.dependency_overrides[get_chat_model] = lambda: FakeListChatModel(responses=responses)


def test_chat_saves_question_and_reply(client):
    _use_fake_model(["Yes, you have £6,546.65 left over."])
    assert client.get("/api/chat").json() == []

    response = client.post("/api/chat", json={"message": "  Can we afford a holiday?  "})
    assert response.status_code == 200
    new = response.json()
    assert [(m["role"], m["content"]) for m in new] == [
        ("human", "Can we afford a holiday?"),
        ("ai", "Yes, you have £6,546.65 left over."),
    ]
    assert client.get("/api/chat").json() == new

    assert client.delete("/api/chat").status_code == 204
    assert client.get("/api/chat").json() == []


def test_chat_rejects_an_empty_message(client):
    _use_fake_model(["unused"])
    assert client.post("/api/chat", json={"message": "   "}).status_code == 422
    assert client.post("/api/chat", json={"message": ""}).status_code == 422


def test_chat_without_api_key_explains_setup(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    response = client.post("/api/chat", json={"message": "hello"})
    assert response.status_code == 503
    assert "ANTHROPIC_API_KEY" in response.json()["detail"]
    assert client.get("/api/chat").json() == []


def test_chat_provider_error_is_reported_and_not_saved(client):
    from langchain_core.runnables import RunnableLambda

    from app.chat import get_chat_model

    def boom(_):
        raise RuntimeError("rate limited")

    app.dependency_overrides[get_chat_model] = lambda: RunnableLambda(boom)
    response = client.post("/api/chat", json={"message": "hello"})
    assert response.status_code == 502
    assert "rate limited" in response.json()["detail"]
    assert client.get("/api/chat").json() == []


def test_chat_prompt_contains_the_household_numbers(client):
    from app.chat import ChatContext, budget_context
    from app.models import Expense
    from app.schemas import SummaryOut

    context = budget_context(
        ChatContext(summary=SummaryOut(**client.get("/api/summary").json()))
    )
    assert "Total income: £10,750.00" in context
    assert "Settlement: Savvas pays Georgia £722.70" in context
    assert "before savings: £6,546.65" in context
    assert "after expenses and savings: £3,046.65" in context


def test_expense_pay_dates_round_trip(client):
    expense_id = client.get("/api/expenses").json()[0]["id"]

    updated = client.patch(
        f"/api/expenses/{expense_id}", json={"due_day": 14, "due_date": "2026-11-01"}
    )
    assert updated.status_code == 200
    assert updated.json()["due_day"] == 14
    assert updated.json()["due_date"] == "2026-11-01"
    assert client.get("/api/expenses").json()[0]["due_day"] == 14

    assert (
        client.patch(f"/api/expenses/{expense_id}", json={"due_day": 32}).status_code
        == 422
    )

    cleared = client.patch(f"/api/expenses/{expense_id}", json={"due_day": None})
    assert cleared.json()["due_day"] is None


def test_chat_context_lists_expense_pay_dates(client):
    from sqlmodel import select

    from app.chat import ChatContext, budget_context
    from app.models import Expense, Person
    from app.schemas import SummaryOut

    expense = client.get("/api/expenses").json()[0]
    client.patch(f"/api/expenses/{expense['id']}", json={"due_day": 3})

    session = client.app.dependency_overrides[get_session]()
    people = list(session.exec(select(Person)).all())
    expenses = list(session.exec(select(Expense)).all())

    context = budget_context(
        ChatContext(
            summary=SummaryOut(**client.get("/api/summary").json()),
            people=people,
            expenses=expenses,
        )
    )
    assert "Expenses:" in context
    assert "paid on day 3 of each month" in context
    assert "no pay day set" in context
