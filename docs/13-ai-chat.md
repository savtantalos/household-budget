# 13. The AI chat (LangChain + Claude)

The **Chat** tab lets you ask questions about your budget in plain English
("Can we afford a £300 holiday next month?"). Answers come from Anthropic's
Claude model, called through the LangChain library from the backend.

## 13.1 The big picture

```
Browser (ChatPanel.tsx)
   │  POST /api/chat {"message": "..."}        ← your JWT, never the AI key
   ▼
FastAPI (main.py → post_chat)
   │  1. load this user's chat history   (ChatMessage table, budget.db)
   │  2. build the dashboard summary     (same numbers as the Dashboard tab)
   ▼
LangChain (chat.py)
   │  prompt = system rules + budget numbers + history + new question
   │  chain  = prompt | ChatAnthropic
   ▼
Anthropic API (internet)  ── uses ANTHROPIC_API_KEY from backend/.env
   │  reply text
   ▼
FastAPI saves question + reply → returns both to the browser
```

Key idea: **the model remembers nothing between calls.** Every request re-sends
the system prompt, your budget numbers, and the last 20 messages
(`HISTORY_LIMIT` in `chat.py`). "Memory" is just rows in our own database.

## 13.2 Where the data lives

| Data | Stored in | Notes |
| --- | --- | --- |
| Chat messages | `chatmessage` table in `backend/budget.db` | One conversation per user; "Clear chat" deletes your rows |
| API key | `backend/.env` (gitignored) | Server only. Never put it in frontend code or git |
| System prompt | `SYSTEM_PROMPT` in `backend/app/chat.py` | Edit it to change tone or rules |
| Budget numbers sent to Claude | Built fresh each message by `budget_context()` from a `ChatContext` | Totals, per-person figures, settlements, every expense with its pay date, incomes, savings plans, investments, account balances, and the saved mortgage / invest-vs-overpay inputs |

Privacy: each question sends your household's full budget — including expense
names and pay dates — plus recent chat to Anthropic.

Expense pay dates let Claude answer "which payments are due before the 15th?"
and "how much will be left?": monthly expenses use `due_day` (day of month),
while yearly and one-off expenses use `due_date` (a full date, repeating
annually for yearly items).

## 13.3 Setting it up

1. Create an API key at <https://console.anthropic.com> (Settings → API keys) and
   set a monthly spend limit there.
2. Copy the example file and paste your key after `ANTHROPIC_API_KEY=`:
   ```bash
   cd backend && cp .env.example .env
   ```
3. Install the new packages and restart the backend:
   ```bash
   .venv/bin/pip install -r requirements.txt
   ```

Without a key the app still works; the Chat tab shows
"AI chat is not set up: add ANTHROPIC_API_KEY…" (HTTP 503).

The default model is `claude-haiku-4-5` (fast and cheap). To use another, add
`ANTHROPIC_MODEL=...` to `.env`.

## 13.4 The files

| File | What it does |
| --- | --- |
| `backend/app/chat.py` | Prompt template, `budget_context()`, `get_chat_model()`, `ask()` |
| `backend/app/models.py` | `ChatMessage` table and `ChatRole` (`human` / `ai`) |
| `backend/app/main.py` | `GET`, `POST`, `DELETE /api/chat` |
| `frontend/src/components/ChatPanel.tsx` | Message list, suggestions, input box |
| `frontend/src/api.ts` | `chatHistory`, `sendChat`, `clearChat` |
| `backend/tests/test_api.py` | Chat tests using LangChain's `FakeListChatModel`, so no key or cost |

## 13.5 Ideas for next steps

- **Streaming**: show the reply word by word (`chain.stream(...)` + a streaming response).
- **Tools**: let Claude call functions such as "run the mortgage simulator" via
  `llm.bind_tools([...])`, so it can do exact maths with our own code.
- **Agents (LangGraph)**: multi-step reasoning with tools and checkpoints.
