"""AI chat assistant: LangChain + Anthropic Claude, grounded in the user's budget."""

import json
import os
from dataclasses import dataclass, field
from datetime import date

from dotenv import load_dotenv
from fastapi import HTTPException, status
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from .budget import mortgage_payment
from .models import (
    Account,
    ChatMessage,
    ChatRole,
    Expense,
    Frequency,
    Income,
    Investment,
    Person,
    SavingsPlan,
    Setting,
)
from .schemas import SummaryOut

load_dotenv()

DEFAULT_MODEL = "claude-haiku-4-5"
HISTORY_LIMIT = 20

SYSTEM_PROMPT = """You are a friendly assistant inside a household budget app.
Answer briefly, use pounds (£), and show your maths when you calculate something.
Base answers on the household's numbers below. If something is not in them, say so
instead of guessing. You give general budgeting help, not regulated financial advice.

How payment dates work:
- monthly expenses are paid on their "pay day" every month (no pay day = date unknown)
- yearly expenses repeat once a year on their "pay date"
- one_off expenses are paid once on their "pay date"
- incomes use the same rules: monthly incomes arrive on their pay day each month,
  yearly on their pay date; no date set means the timing is unknown

When asked about expected payments until a date, list each payment with its date,
total them, and work out what is left from the income expected in the same period.
State any assumptions you make.

Household budget (monthly figures unless noted):
{budget}"""

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder("history"),
        ("human", "{question}"),
    ]
)


def get_chat_model() -> BaseChatModel:
    """FastAPI dependency returning the Claude model; tests override it with a fake."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI chat is not set up: add ANTHROPIC_API_KEY to backend/.env "
            "and restart the backend.",
        )
    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(
        model_name=os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL),
        max_tokens_to_sample=1024,
        timeout=60,
    )


@dataclass
class ChatContext:
    """Everything the model can see about this household for one question."""

    summary: SummaryOut
    today: date = field(default_factory=date.today)
    people: list[Person] = field(default_factory=list)
    incomes: list[Income] = field(default_factory=list)
    expenses: list[Expense] = field(default_factory=list)
    plans: list[SavingsPlan] = field(default_factory=list)
    investments: list[Investment] = field(default_factory=list)
    accounts: list[Account] = field(default_factory=list)
    settings: Setting | None = None


def _pay_rule(item: Expense | Income) -> str:
    if item.frequency == Frequency.monthly:
        if item.due_day:
            return f"on day {item.due_day} of each month"
        return "monthly, no pay day set"
    if item.due_date:
        kind = "yearly, every year on" if item.frequency == Frequency.yearly else "one-off on"
        return f"{kind} {item.due_date.isoformat()}"
    return f"{item.frequency.value}, no pay date set"


def _summary_lines(summary: SummaryOut) -> list[str]:
    lines = [
        f"- Total income: £{summary.total_income:,.2f}",
        f"- Total expenses: £{summary.total_expenses:,.2f} "
        f"(shared £{summary.shared_expenses:,.2f}, "
        f"personal £{summary.personal_expenses:,.2f})",
        f"- Total savings plans: £{summary.total_savings:,.2f}",
        f"- Left over after expenses, before savings: £{summary.cash_balance:,.2f}",
        f"- Left over after expenses and savings: "
        f"£{summary.cash_balance - summary.total_savings:,.2f}",
        f"- Net worth (account balances): £{summary.net_worth:,.2f}",
        f"- Shared-cost split mode: {summary.split_mode.value}",
    ]
    for p in summary.people:
        lines.append(
            f"- {p.name}: income £{p.income:,.2f}, true cost £{p.true_cost:,.2f}, "
            f"savings £{p.savings:,.2f}, left after savings £{p.remaining_after_savings:,.2f}"
        )
    for s in summary.settlements:
        lines.append(f"- Settlement: {s.from_person} pays {s.to_person} £{s.amount:,.2f}")
    return lines


def _settings_lines(settings: Setting) -> list[str]:
    payment = mortgage_payment(
        settings.mortgage_principal,
        settings.mortgage_rate_pct,
        settings.mortgage_term_years,
    )
    try:
        lump_sums = json.loads(settings.mortgage_lump_sums)
    except (TypeError, ValueError):
        lump_sums = []
    lumps = ", ".join(
        f"£{float(lump['amount']):,.2f} in month {lump['month']}" for lump in lump_sums
    ) or "none"
    return [
        "Mortgage simulator inputs (what-if tool, may not be the real mortgage):",
        f"- Amount owed £{settings.mortgage_principal:,.2f} at "
        f"{settings.mortgage_rate_pct}% over {settings.mortgage_term_years} years",
        f"- Scheduled monthly payment: £{payment:,.2f}; extra monthly overpayment "
        f"£{settings.mortgage_overpayment:,.2f}; lump-sum overpayments: {lumps}",
        "Invest-vs-overpay simulator inputs:",
        f"- Mortgage £{settings.invest_principal:,.2f} at "
        f"{settings.invest_mortgage_rate_pct}% over {settings.invest_term_years} years, "
        f"spare cash £{settings.invest_monthly_amount:,.2f}/month invested at "
        f"{settings.invest_annual_return_pct}%",
    ]


def budget_context(context: ChatContext) -> str:
    """Turn the household's data into plain text the model can read."""
    names = {p.id: p.name for p in context.people}
    lines = [f"- Today's date: {context.today.isoformat()}"]
    lines += _summary_lines(context.summary)

    if context.incomes:
        lines.append("Incomes:")
        for income in context.incomes:
            lines.append(
                f"- {names.get(income.person_id, '?')} — {income.label}: "
                f"£{income.amount:,.2f} {_pay_rule(income)}"
            )

    if context.expenses:
        lines.append("Expenses:")
        for expense in sorted(
            context.expenses, key=lambda e: (e.due_day is None, e.due_day or 0)
        ):
            shared = "shared" if expense.shared else "personal"
            lines.append(
                f"- {expense.label} ({expense.category}, {shared}, paid by "
                f"{names.get(expense.payer_id, '?')}): £{expense.amount:,.2f} "
                f"{expense.frequency.value}, paid {_pay_rule(expense)}"
            )

    if context.plans:
        lines.append("Savings plans:")
        for plan in context.plans:
            lines.append(
                f"- {names.get(plan.person_id, '?')} — {plan.label}: "
                f"£{plan.monthly_amount:,.2f}/month"
            )

    if context.investments:
        lines.append("Investments:")
        for inv in context.investments:
            lines.append(
                f"- {names.get(inv.person_id, '?')} — {inv.name} ({inv.category}): "
                f"balance £{inv.balance:,.2f}, adds £{inv.monthly_contribution:,.2f}/month, "
                f"expects {inv.annual_return_pct}%/year"
            )

    if context.accounts:
        lines.append("Account balances:")
        for account in context.accounts:
            lines.append(
                f"- {names.get(account.person_id, '?')} — {account.institution}: "
                f"£{account.balance:,.2f} (as of {account.as_of.isoformat()})"
            )

    if context.settings is not None:
        lines += _settings_lines(context.settings)

    return "\n".join(lines)


def to_langchain(rows: list[ChatMessage]) -> list[BaseMessage]:
    return [
        HumanMessage(content=r.content)
        if r.role == ChatRole.human
        else AIMessage(content=r.content)
        for r in rows
    ]


def ask(
    llm: BaseChatModel, context: ChatContext, history: list[ChatMessage], question: str
) -> str:
    chain = prompt | llm
    result = chain.invoke(
        {
            "budget": budget_context(context),
            "history": to_langchain(history[-HISTORY_LIMIT:]),
            "question": question,
        }
    )
    return result.text
