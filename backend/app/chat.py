"""AI chat assistant: LangChain + Anthropic Claude, grounded in the user's budget."""

import os

from dotenv import load_dotenv
from fastapi import HTTPException, status
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from .models import ChatMessage, ChatRole
from .schemas import SummaryOut

load_dotenv()

DEFAULT_MODEL = "claude-haiku-4-5"
HISTORY_LIMIT = 20

SYSTEM_PROMPT = """You are a friendly assistant inside a household budget app.
Answer briefly, use pounds (£), and show your maths when you calculate something.
Base answers on the household's numbers below. If something is not in them, say so
instead of guessing. You give general budgeting help, not regulated financial advice.

Household budget (monthly figures):
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


def budget_context(summary: SummaryOut) -> str:
    """Turn the dashboard summary into plain text the model can read."""
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
    return "\n".join(lines)


def to_langchain(rows: list[ChatMessage]) -> list[BaseMessage]:
    return [
        HumanMessage(content=r.content)
        if r.role == ChatRole.human
        else AIMessage(content=r.content)
        for r in rows
    ]


def ask(
    llm: BaseChatModel, summary: SummaryOut, history: list[ChatMessage], question: str
) -> str:
    chain = prompt | llm
    result = chain.invoke(
        {
            "budget": budget_context(summary),
            "history": to_langchain(history[-HISTORY_LIMIT:]),
            "question": question,
        }
    )
    return result.text
