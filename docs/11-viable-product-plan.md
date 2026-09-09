# 11. Viable product plan — hosting, auth, and user data

This document turns the local budget app into a hosted product. It assumes the existing stack (FastAPI + SQLModel + React + SQLite) and explains how to make it reachable from an iPad, give each household its own data, and keep costs low.

## 1. Current state

- The app is designed for **one household at a time**. There is one SQLite file, one `person` table, one set of incomes/expenses/etc.
- There is **no authentication**. Anyone who can reach `http://localhost:5173` sees and edits the same data.
- The frontend fetches from `http://localhost:8000/api/*` via the Vite dev proxy.
- All derived numbers are computed on the backend; the database only stores raw inputs.

## 2. Two product shapes

Pick one before writing code. They need very different changes.

| Shape | Who uses it | Auth needs | Data model | Effort | Typical cost at small scale |
| --- | --- | --- | --- | --- | --- |
| **A. Private household instance** | Just you and Georgia (or one couple/family) | One shared login, or none behind a private network | One household per deployed app | Low | ~$3–7/month |
| **B. Multi-tenant SaaS** | Anyone can sign up | Full user/tenant auth with sign-up, login, password reset, email verification | One `household`/`tenant` table; all other tables scoped to it | Medium-high | Free tier initially, $25–50/month as it grows |

For a first viable product, **start with A**. It gets you a real iPad-accessible website for your own data in a weekend. You can add multi-tenancy later if you want to let other people sign up.

## 3. Hosting the backend and frontend

### 3.1 Recommended path for a private instance

```text
Custom domain (e.g. budget.example.com)
           │ HTTPS
           ▼
    Cloudflare / platform-provided proxy
           │
           ▼
   ┌───────────────┐
   │  Fly.io /     │   FastAPI + SQLite on a persistent volume
   │  Railway      │   (single container/VM)
   └───────────────┘
           │
           ▼
   Static React build served by the same backend,
   or by Vercel/Railway static hosting
```

You can either:

1. **Serve the React build from FastAPI** (simplest): run `npm run build` and put the contents of `frontend/dist` behind FastAPI. Then the whole product lives on one host at `https://your-domain.com`. The Vite proxy is replaced by a production `BASE_URL`.
2. **Host frontend separately on Vercel** and backend on Fly/Railway. This is cleaner but needs CORS and two deployments. For one household it is overkill.

### 3.2 Platform options

| Platform | Why use it | Rough cost for one small app |
| --- | --- | --- |
| **Fly.io** | Native Docker/VM feel, persistent volumes, good for FastAPI. No free tier for new accounts; pay-as-you-go. | ~$2–5/month for a shared-cpu-1x 256 MB VM + 1 GB volume. Data transfer extra. |
| **Railway** | Very easy `git push` deploy, includes free $1/month credit and a $5 Hobby plan, volumes supported. | Free for very light use; otherwise $5/month Hobby + usage. |
| **Render** | Similar to Railway, free web services with automatic deploys. | Free tier available (sleeps after 15 min inactivity); paid from ~$7/month. |
| **Vercel** | Excellent for the frontend, but not a natural fit for a long-running FastAPI backend. | Free for frontend static hosting; backend would need a different platform. |

For a private instance, **Railway** or **Fly.io** are the most straightforward. **Vercel is best kept for the frontend only** if you split the two.

## 4. Database choices

### 4.1 SQLite with a persistent volume

The cheapest path for one household.

- Keep using `budget.db` on a persistent volume.
- Backups: copy the file daily (`sqlite3 budget.db ".backup /backups/budget-$(date +%F).db"`) or use the platform's volume snapshots.
- Limit: only one process should write to the file. Running multiple backend instances requires Postgres.

### 4.2 Postgres

The right choice if you later go multi-tenant or want managed backups/pooling.

| Provider | Free tier | Paid starting point | Notes |
| --- | --- | --- | --- |
| **Supabase** | 500 MB database, 50k MAU, pauses after 1 week inactivity | ~$25/month Pro | Includes auth, storage, REST API; easiest migration path to multi-tenant |
| **Railway** | N/A (uses provisioned Postgres per project) | Included in your project bill (~$5–15/month typical) | Same platform as the app |
| **Neon** | 0.5 GB storage | From ~$5/month for Pro | Serverless Postgres, good for variable traffic |

SQLModel uses SQLAlchemy under the hood, so moving from SQLite to Postgres is mostly a matter of changing the `DATABASE_URL` to `postgresql+psycopg2://...` or `postgresql+asyncpg://...` and adding `psycopg2` or `asyncpg` to `requirements.txt`.

## 5. Authentication options

### 5.1 Private instance: one shared login

The simplest viable auth. Add one environment variable on the server:

```bash
APP_PASSWORD=your-shared-password
```

FastAPI checks a session cookie or HTTP Basic Auth header. The frontend shows a single password gate. No database of users is needed.

Pros: trivial to implement. Cons: no per-user history, no sign-up flow, not suitable for SaaS.

### 5.2 Private instance: Cloudflare Access / Tailscale

Even simpler: put the app behind **Cloudflare Access** (free for up to 50 users) or connect via **Tailscale**. Users authenticate through Google/Apple ID, and you do not write any auth code. This is often the cheapest and safest private option.

### 5.3 SaaS: managed auth providers

| Provider | Free tier | Paid starting point | Best for |
| --- | --- | --- | --- |
| **Clerk** | 50,000 monthly retained users, 3 dashboard seats | $25/month Pro | React integration is very easy, generous free tier |
| **Auth0** | 25,000 monthly active users | $35/month Essentials | Mature, lots of enterprise features |
| **Supabase Auth** | 50,000 monthly active users | $25/month Pro | Already included if you use Supabase Postgres |
| **FastAPI + passlib (roll your own)** | Free | Server cost only | More work; you own password hashing, email verification, password reset, JWT refresh |

For a SaaS, **Clerk** or **Supabase Auth** are the lowest-friction choices. Clerk's React components handle sign-up, login, and user profile with a few lines of code.

## 6. Data model changes for multi-tenancy

Only needed for option B (or if you want a household with multiple users). The core idea: every table gets a `household_id`.

```python
class Household(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = "Our household"
    split_mode: SplitMode = SplitMode.even

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str | None = None
    household_id: int = Field(foreign_key="household.id", index=True)
    # or, with Clerk/Auth0, store only provider_user_id and email

class Person(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    household_id: int = Field(foreign_key="household.id", index=True)
    name: str
    ...

# Income, Expense, Transfer, SavingsPlan, Account, Investment, Setting
# all also get household_id (or move Setting fields onto Household).
```

With SQLModel you add the column, create a migration, then update every query in `main.py` to filter by the current user's `household_id`:

```python
session.exec(select(Person).where(Person.household_id == current_user.household_id))
```

The `crud.py` generic router would need to inject that filter automatically, e.g. by reading `current_user` from the request state.

## 7. How users save their data

The save path stays the same as today; only the *scope* changes.

```text
iPad / browser
     ↓ fetch with token/cookie
FastAPI endpoint
     ↓ verify who is logged in
     ↓ open SQLModel/SQLAlchemy session
     ↓ read/write rows belonging to that household
     ↓ commit
SQLite or Postgres
```

- With a shared password, the backend just checks `session["authed"]` and all rows are the one household.
- With Clerk/Auth0, the frontend sends an access token with each request. FastAPI validates it (via the provider's JWKS endpoint) and looks up the household from the `User`/`Tenant` table.
- With Supabase Auth, the token is a JWT that can be verified locally using Supabase's public key.

## 8. Frontend changes

1. **Remove the Vite dev proxy** in production. The React app calls an absolute URL (`https://api.yourdomain.com/api/*` or the same origin if served from FastAPI).
2. **Add a login route** if you use a managed auth provider or shared password.
3. **Store the auth token** in `httpOnly` cookies (safer) or `localStorage` (simpler for a first pass).
4. **Handle 401 responses** by redirecting to `/login`.

## 9. Deployment checklist for a private instance

This is the recommended Phase 1.

1. **Pick a platform** (Railway or Fly.io) and create an account.
2. **Add a production Dockerfile** for the backend. Example:

    ```dockerfile
    FROM python:3.12-slim
    WORKDIR /app
    COPY backend/requirements.txt ./
    RUN pip install -r requirements.txt
    COPY backend/app ./app
    CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    ```

3. **Build the frontend**:

    ```bash
    cd frontend
    npm run build
    ```

4. **Serve the static build from FastAPI** by mounting `frontend/dist`:

    ```python
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
    ```

    Keep `/api/*` routes before this mount so they are not shadowed.

5. **Use a persistent volume** for `budget.db` so it survives redeploys.
6. **Set environment variables** for secrets (`APP_PASSWORD`, `DATABASE_URL`) via the platform dashboard — never commit them.
7. **Point a custom domain** at the app (most platforms handle HTTPS automatically).
8. **Set up a backup** (volume snapshot or nightly `sqlite3 .backup` to object storage).

Estimated running cost: **$3–7/month** on Fly.io/Railway for a couple using it privately.

## 10. Scaling roadmap

| Phase | Goal | Main changes | Cost signal |
| --- | --- | --- | --- |
| **1** | Private hosted instance | Static-served frontend, shared password, SQLite volume | $3–7/month |
| **2** | Per-user logins + managed DB | Add `User`/`Household` tables, Clerk/Supabase Auth, Postgres | $0–25/month |
| **3** | Multi-tenant SaaS | Tenant isolation, sign-up flow, email verification, rate limiting | $25–50/month at low MAU |
| **4** | Paid product | Stripe subscriptions, per-household billing, advanced features | Variable |

## 11. Security basics

- **HTTPS only**: all platforms provide this for custom domains.
- **Secrets in environment variables**: never commit `.env`, database credentials, or auth provider keys.
- **Input validation**: keep using Pydantic/SQLModel; add rate limiting on login endpoints (`slowapi` or Cloudflare).
- **Backups**: automated daily backups before you store real financial data.
- **CORS**: in production, restrict `allow_origins` to your exact frontend domain.

## 12. Recommendation

For your immediate goal — use the budget website from your iPad without re-seeding data every time — implement **Phase 1 on Railway or Fly.io**:

- One shared login (`APP_PASSWORD`) or Cloudflare Access.
- SQLite on a persistent volume.
- React build served from FastAPI under one domain.
- Nightly backups.

That gives you a real, private website for under $10/month, and the exact same code can later be upgraded to Postgres + Clerk if you decide to open it up to other households.

If you confirm which shape (private vs. SaaS) and platform you prefer, the next step is to implement Phase 1 and deploy it.
