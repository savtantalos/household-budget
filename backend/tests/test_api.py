import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.db import get_session
from app.main import app
from app.seed import seed


@pytest.fixture(name="client")
def client_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        seed(session)

        def override():
            return session

        app.dependency_overrides[get_session] = override
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
    assert client.get("/api/settings").json() == {"split_mode": "even"}

    updated = client.patch("/api/settings", json={"split_mode": "difference"})
    assert updated.status_code == 200
    assert updated.json() == {"split_mode": "difference"}

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
    assert body["winner"] in {"invest", "overpay"}
    assert body["overpay_months_to_repay"] < 300
    assert len(body["points"]) == 301
    assert body["points"][-1]["invest_wealth"] > 0
    assert body["points"][-1]["overpay_wealth"] > 0


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
