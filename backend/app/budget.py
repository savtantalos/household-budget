"""Pure budget maths: monthly normalisation, expense splitting, projections."""

from dataclasses import dataclass, field

from .models import Account, Expense, Frequency, Income, Person, SavingsPlan, Transfer

MONTHS_PER_YEAR = 12


def monthly(amount: float, frequency: Frequency) -> float:
    if frequency == Frequency.monthly:
        return amount
    if frequency == Frequency.yearly:
        return amount / MONTHS_PER_YEAR
    return 0.0


@dataclass
class PersonSummary:
    id: int
    name: str
    income: float = 0.0
    paid_shared: float = 0.0
    paid_personal: float = 0.0
    fair_share: float = 0.0
    transfers_out: float = 0.0
    transfers_in: float = 0.0
    savings: float = 0.0
    net_worth: float = 0.0

    @property
    def settlement(self) -> float:
        """Positive when the household owes this person money."""
        return self.paid_shared - self.fair_share - self.transfers_out + self.transfers_in

    @property
    def true_cost(self) -> float:
        return self.fair_share + self.paid_personal + self.transfers_out - self.transfers_in

    @property
    def remaining(self) -> float:
        return self.income - self.true_cost

    @property
    def remaining_after_savings(self) -> float:
        return self.remaining - self.savings


@dataclass
class Settlement:
    from_person: str
    to_person: str
    amount: float


@dataclass
class Summary:
    people: list[PersonSummary] = field(default_factory=list)
    settlements: list[Settlement] = field(default_factory=list)
    total_income: float = 0.0
    total_expenses: float = 0.0
    shared_expenses: float = 0.0
    personal_expenses: float = 0.0
    total_savings: float = 0.0
    net_worth: float = 0.0

    @property
    def cash_balance(self) -> float:
        return self.total_income - self.total_expenses

    @property
    def spend_ratio(self) -> float:
        return self.total_expenses / self.total_income if self.total_income else 0.0


def _settle(people: list[PersonSummary]) -> list[Settlement]:
    """Greedily match debtors to creditors so everyone ends up square."""
    debtors = sorted(
        ((p, -p.settlement) for p in people if p.settlement < -0.005),
        key=lambda pair: pair[1],
        reverse=True,
    )
    creditors = sorted(
        ((p, p.settlement) for p in people if p.settlement > 0.005),
        key=lambda pair: pair[1],
        reverse=True,
    )
    settlements: list[Settlement] = []
    i = j = 0
    owed = [amount for _, amount in debtors]
    due = [amount for _, amount in creditors]
    while i < len(debtors) and j < len(creditors):
        amount = min(owed[i], due[j])
        if amount > 0.005:
            settlements.append(
                Settlement(debtors[i][0].name, creditors[j][0].name, round(amount, 2))
            )
        owed[i] -= amount
        due[j] -= amount
        if owed[i] <= 0.005:
            i += 1
        if due[j] <= 0.005:
            j += 1
    return settlements


def build_summary(
    people: list[Person],
    incomes: list[Income],
    expenses: list[Expense],
    transfers: list[Transfer],
    plans: list[SavingsPlan],
    accounts: list[Account],
) -> Summary:
    by_id = {p.id: PersonSummary(id=p.id or 0, name=p.name) for p in people}
    summary = Summary(people=list(by_id.values()))

    for income in incomes:
        if income.person_id in by_id:
            by_id[income.person_id].income += monthly(income.amount, income.frequency)

    for expense in expenses:
        amount = monthly(expense.amount, expense.frequency)
        if not amount:
            continue
        if expense.shared:
            summary.shared_expenses += amount
            if expense.payer_id in by_id:
                by_id[expense.payer_id].paid_shared += amount
        else:
            summary.personal_expenses += amount
            if expense.payer_id in by_id:
                by_id[expense.payer_id].paid_personal += amount

    for transfer in transfers:
        if transfer.from_person_id in by_id:
            by_id[transfer.from_person_id].transfers_out += transfer.amount
        if transfer.to_person_id in by_id:
            by_id[transfer.to_person_id].transfers_in += transfer.amount

    for plan in plans:
        if plan.person_id in by_id:
            by_id[plan.person_id].savings += plan.monthly_amount

    for account in accounts:
        if account.person_id in by_id:
            by_id[account.person_id].net_worth += account.balance

    share = summary.shared_expenses / len(by_id) if by_id else 0.0
    for person in by_id.values():
        person.fair_share = share

    summary.total_income = sum(p.income for p in by_id.values())
    summary.total_expenses = summary.shared_expenses + summary.personal_expenses
    summary.total_savings = sum(p.savings for p in by_id.values())
    summary.net_worth = sum(p.net_worth for p in by_id.values())
    summary.settlements = _settle(list(by_id.values()))
    return summary


@dataclass
class ProjectionPoint:
    month: int
    year: float
    contributed: float
    balance: float


def project_savings(
    starting_balance: float,
    monthly_contribution: float,
    years: int,
    annual_return_pct: float = 0.0,
) -> list[ProjectionPoint]:
    """Compound monthly contributions at ``annual_return_pct`` for ``years``."""
    monthly_rate = (1 + annual_return_pct / 100) ** (1 / MONTHS_PER_YEAR) - 1
    balance = starting_balance
    contributed = 0.0
    points = [ProjectionPoint(0, 0.0, 0.0, round(balance, 2))]
    for month in range(1, years * MONTHS_PER_YEAR + 1):
        balance = balance * (1 + monthly_rate) + monthly_contribution
        contributed += monthly_contribution
        points.append(
            ProjectionPoint(
                month=month,
                year=round(month / MONTHS_PER_YEAR, 2),
                contributed=round(contributed, 2),
                balance=round(balance, 2),
            )
        )
    return points
