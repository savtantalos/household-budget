from app.budget import (
    LumpSum,
    build_summary,
    monthly,
    mortgage_payment,
    project_savings,
    simulate_mortgage,
)
from app.models import Account, Expense, Frequency, Income, Person, SavingsPlan, Transfer


def make_household():
    people = [Person(id=1, name="Savvas"), Person(id=2, name="Georgia")]
    incomes = [
        Income(id=1, person_id=1, label="Salary", amount=6000),
        Income(id=2, person_id=2, label="Salary", amount=4750),
    ]
    expenses = [
        Expense(id=1, payer_id=2, label="Mortgage", amount=3000, shared=True),
        Expense(id=2, payer_id=2, label="Super", amount=400, shared=True),
        Expense(id=3, payer_id=1, label="Electricity", amount=93, shared=True),
        Expense(id=4, payer_id=1, label="Council tax", amount=201, shared=True),
        Expense(id=5, payer_id=1, label="Internet", amount=45, shared=True),
        Expense(id=6, payer_id=1, label="Water", amount=58.35, shared=True),
        Expense(id=7, payer_id=1, label="Gym", amount=368, shared=False),
        Expense(id=8, payer_id=1, label="Car service", amount=38, shared=False),
    ]
    transfers = [
        Transfer(id=1, from_person_id=2, to_person_id=1, label="Loan", amount=778.62)
    ]
    plans = [
        SavingsPlan(id=1, person_id=1, monthly_amount=2500),
        SavingsPlan(id=2, person_id=2, monthly_amount=1000),
    ]
    accounts = [Account(id=1, person_id=1, institution="Barclays", balance=55259)]
    return people, incomes, expenses, transfers, plans, accounts


def test_monthly_normalisation():
    assert monthly(1200, Frequency.yearly) == 100
    assert monthly(50, Frequency.monthly) == 50
    assert monthly(500, Frequency.one_off) == 0


def test_summary_totals_match_spreadsheet():
    summary = build_summary(*make_household())

    assert summary.total_income == 10750
    assert summary.shared_expenses == 3797.35
    assert summary.personal_expenses == 406
    assert round(summary.total_expenses, 2) == 4203.35
    assert round(summary.cash_balance, 2) == 6546.65
    assert round(summary.spend_ratio, 4) == 0.3910


def test_shared_costs_are_split_evenly():
    summary = build_summary(*make_household())
    savvas, georgia = summary.people

    assert savvas.fair_share == georgia.fair_share == 3797.35 / 2
    assert round(savvas.paid_shared, 2) == 397.35
    assert round(georgia.paid_shared, 2) == 3400.00


def test_settlement_nets_transfers_against_shared_spend():
    summary = build_summary(*make_household())
    savvas, georgia = summary.people

    # Savvas underpays the shared pot but is owed the loan repayment.
    assert round(savvas.settlement, 2) == round(397.35 - 1898.675 + 778.62, 2)
    assert round(savvas.settlement + georgia.settlement, 2) == 0

    assert len(summary.settlements) == 1
    settlement = summary.settlements[0]
    assert settlement.from_person == "Savvas"
    assert settlement.to_person == "Georgia"
    assert settlement.amount == 722.7


def test_remaining_after_savings():
    summary = build_summary(*make_household())
    savvas = summary.people[0]

    assert round(savvas.true_cost, 2) == round(1898.675 + 406 - 778.62, 2)
    assert round(savvas.remaining, 2) == round(6000 - savvas.true_cost, 2)
    assert round(savvas.remaining_after_savings, 2) == round(savvas.remaining - 2500, 2)


def test_projection_without_growth_is_linear():
    points = project_savings(1000, 500, years=1)
    assert points[0].balance == 1000
    assert points[-1].balance == 1000 + 500 * 12
    assert points[-1].contributed == 6000


def test_projection_with_growth_beats_contributions():
    points = project_savings(10000, 500, years=5, annual_return_pct=7)
    assert points[-1].balance > 10000 + 500 * 60


def test_mortgage_payment_matches_annuity_formula():
    # £300k over 25 years at 4.5% is the standard textbook ~£1,667/month.
    payment = mortgage_payment(300_000, 4.5, 25)
    assert round(payment, 2) == 1667.50


def test_mortgage_zero_rate_is_straight_line():
    result = simulate_mortgage(120_000, 0.0, 10)
    assert result.monthly_payment == 1000.0
    assert result.months_to_repay == 120
    assert result.total_interest == 0.0


def test_mortgage_runs_full_term_without_overpayments():
    result = simulate_mortgage(300_000, 4.5, 25)
    assert result.months_to_repay == 300
    assert result.months_saved == 0
    assert result.interest_saved == 0.0
    assert result.total_paid == round(300_000 + result.total_interest, 2)
    assert result.points[-1].balance == 0.0


def test_monthly_overpayment_shortens_the_term_and_saves_interest():
    result = simulate_mortgage(300_000, 4.5, 25, monthly_overpayment=300)
    assert result.months_to_repay < result.baseline_months_to_repay
    assert result.months_saved > 48
    assert result.interest_saved > 40_000
    assert result.total_interest < result.baseline_total_interest


def test_lump_sum_reduces_the_balance_in_that_month():
    plain = simulate_mortgage(300_000, 4.5, 25)
    lumped = simulate_mortgage(300_000, 4.5, 25, lump_sums=[LumpSum(month=12, amount=20_000)])
    assert lumped.points[12].balance == round(plain.points[12].balance - 20_000, 2)
    assert lumped.points[12].baseline_balance == plain.points[12].balance
    assert lumped.months_saved > 0


def test_final_payment_never_overpays_the_balance():
    result = simulate_mortgage(10_000, 5.0, 2, monthly_overpayment=5_000)
    assert result.points[-1].balance == 0.0
    assert result.total_paid == round(10_000 + result.total_interest, 2)
