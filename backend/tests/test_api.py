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
