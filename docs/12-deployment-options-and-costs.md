# 12. Deployment options and cost research

This document lays out realistic ways to take the local Household Budget app online, with current pricing and trade-offs for each piece. Prices were researched in September 2026 and are listed in USD; check each provider before committing, as rates change frequently.

---

## 1. What you are actually paying for

To host any web app you need four things:

1. **Compute** — a server running the FastAPI backend.
2. **Database / persistence** — somewhere durable to store user data.
3. **Frontend delivery** — serving the React build to browsers.
4. **Auth & email** — only if you want real users, sign-up, password reset, etc.
5. **Domain & TLS** — a friendly URL and HTTPS certificate.

For a private couple/family budget, (4) can be skipped or replaced with a single shared password. For a SaaS that strangers sign up to, (4) becomes mandatory.

---

## 2. High-level shape: private vs. SaaS

| Shape | Who uses it | Auth | Effort | Typical monthly cost |
| --- | --- | --- | --- | --- |
| **A. Private instance** | You and your partner/family | Shared password or Cloudflare Access | Low | **$3–10/month** |
| **B. Multi-user household product** | Friends, extended family, small groups | Built-in JWT accounts (already implemented) or Clerk/Supabase Auth | Medium | **$10–40/month** at low scale |
| **C. Public SaaS** | Anyone on the internet | Managed auth + email verification + Postgres | Medium-high | **$25–100/month** to start, scaling with users |

The rest of this doc prices each layer so you can mix and match for A, B, or C.

---

## 3. Compute / backend hosting

| Provider | Why use it | Free tier | Paid starting point | Best for |
| --- | --- | --- | --- | --- |
| **Fly.io** | VM-style containers, persistent volumes, excellent for FastAPI + SQLite | None for new accounts; tiny usage can be ~$2/month | shared-cpu-1x + 256 MB ≈ **$1.94/month**; 1 GB volume ≈ **$0.15/GB/month** | Private instance with SQLite |
| **Railway** | Git-push deploy, very little config | $1/month free credit; Free plan with 1 replica / 0.5 GB RAM | Hobby plan **$5/month** includes $5 of usage credit; resources billed at CPU $20/vCPU/mo, RAM $10/GB/mo | Private instance or small SaaS |
| **Render** | Simplest static + web service in one dashboard | Free web service (sleeps after 15 min, 750 h/month cap), free Postgres for 30 days | Starter web service **$7/month**, Postgres from **$7/month** | Prototyping and hobby projects |
| **DigitalOcean App Platform** | Predictable PaaS | N/A | Basic tier from **$5/month** | Small production apps |
| **AWS / GCP / Azure** | Maximum control, but more complex | Always-free tiers exist but rarely cover a 24/7 app | Lightsail from **$5/month**, EC2/GCE from ~$15/month | Not worth it until you need scale |

**Cost examples for a tiny private instance**

| Setup | Estimated monthly cost |
| --- | --- |
| Fly.io shared-cpu-1x (256 MB) + 1 GB volume + minimal egress | ~$2.50–4 |
| Railway Hobby plan + 0.25 vCPU + 0.5 GB RAM + 1 GB volume | ~$5–8 |
| Render Starter web service + basic Postgres | ~$14–20 |

---

## 4. Database choices

### 4.1 SQLite on a persistent volume (cheapest)

- Keep the existing `budget.db` on a volume attached to the container.
- Backups: nightly `sqlite3 budget.db ".backup /backups/budget-$(date +%F).db"` or platform volume snapshots.
- Limit: only one process should write to the file. Do **not** run multiple backend replicas.
- Cost: the volume fee only (e.g. Fly.io ~$0.15/GB/month, Railway ~$0.15/GB/month).

### 4.2 Managed Postgres

| Provider | Free tier | Paid starting point | Notes |
| --- | --- | --- | --- |
| **Supabase** | 500 MB database, 2 active projects, pauses after 7 days idle | Pro **$25/month/org** + compute; Micro instance ~$10/month | Includes auth, storage, REST API; smooth multi-tenant path |
| **Neon** | 0.5 GB/project, 100 CU-hours/project, 10 projects | Launch plan: pay-as-you-go, no minimum; ~$7–8/month for light 0.25 CU usage | Serverless, branches, fast scaling; no inactivity pause on paid plans |
| **Railway Postgres** | None | Provisioned in project; typically **$5–15/month** | Same platform as app, easy networking |
| **Render Postgres** | Free for 30 days (1 GB cap), then deleted | Basic-256 MB from **$7/month** | Integrated with Render web services |
| **AWS RDS / GCP Cloud SQL** | None | db.t3.micro ~$15/month + storage | Overkill for one household |

**Recommendation**
- Stay with **SQLite + volume** for a private instance.
- Move to **Neon or Supabase** if you want SaaS sign-ups, managed backups, and the option to scale later.

---

## 5. Frontend hosting

| Option | Cost | Notes |
| --- | --- | --- |
| **Served by FastAPI** | Free (uses same compute) | `app.mount("/", StaticFiles(...))`. One domain, one deploy. Best for private instances. |
| **Vercel** | Free tier generous | Excellent CI/CD from Git, global CDN. Need separate backend host and CORS config. |
| **Netlify** | Free tier generous | Similar to Vercel. |
| **Cloudflare Pages** | Free | Very fast global CDN, works well with Cloudflare Access for private apps. |

For a private instance, serve the React build from FastAPI to keep everything on one host. For a SaaS, Vercel/Netlify/Cloudflare Pages give better CDN performance and CI/CD.

---

## 6. Authentication options

| Option | Cost | Best for |
| --- | --- | --- |
| **Single shared password** (already easy to add via env var) | Free | Private couple/family instance |
| **Built-in JWT accounts** (already implemented) | Free | Multi-user household product where you trust users |
| **Cloudflare Access** | Free for up to 50 users | Private app; users authenticate with Google/Apple/Microsoft, no code needed |
| **Tailscale** | Free for personal use | Private app accessed only from your mesh network |
| **Clerk** | Free to 50,000 monthly retained users; Pro **$25/month** | SaaS with React components, MFA, social login |
| **Supabase Auth** | 50,000 MAU free; Pro **$25/month** | Already bundled if you use Supabase Postgres |
| **Auth0** | 25,000 MAU free; B2C Essentials from **$35/month** | Enterprise features, but more expensive than Clerk/Supabase at scale |

**Recommendation**
- Private instance: **Cloudflare Access** or a single shared password.
- Small product for friends/family: the **built-in JWT auth** already in the codebase.
- Public SaaS: **Clerk** (best React DX) or **Supabase Auth** (if you also use Supabase Postgres).

---

## 7. Domain, TLS, and email

### 7.1 Domain

| Registrar | .com registration | .com renewal | Notes |
| --- | --- | --- | --- |
| **Cloudflare Registrar** | ~$9.77 | Same as registration | At-cost pricing, no markup, free WHOIS privacy |
| **Namecheap** | ~$6.79–11.28 promo | ~$14.78–18.48 | Frequent first-year promos; renewals higher |
| **Google Domains** (now Squarespace) | ~$12–14 | ~$12–14 | Reliable, simple |

Budget roughly **$10–15/year** for a .com, or **$1/month** averaged.

### 7.2 TLS / HTTPS

- **Free** with every major platform (Fly.io, Railway, Render, Vercel, Netlify, Cloudflare) when you use their proxy or custom domain.
- Cloudflare also gives you a free certificate even on the free plan.

### 7.3 Transactional email (password reset, verification)

| Provider | Free tier | Paid starting point | Notes |
| --- | --- | --- | --- |
| **Resend** | 3,000 emails/month, 100/day | Pro **$20/month** for 50,000 emails | Modern API, great deliverability, easy FastAPI integration |
| **SendGrid** | 100 emails/day for 60-day trial only | Essentials from **$19.95/month** | Free plan being retired; paid plans are mature |
| **AWS SES** | 62,000 emails/month from EC2 or 3,000 out | $0.10 per 1,000 emails + attachments | Cheapest at scale, but setup is more complex |
| **Postmark** | 100 emails/month test | From ~$15/month for 10,000 emails | Excellent deliverability, focused on transactional |

For a SaaS, **Resend** is the best starting point: free tier is plenty for early users, and it is simpler than AWS SES.

---

## 8. Three complete budget estimates

### Option A — Private instance for one household

| Component | Choice | Monthly cost |
| --- | --- | --- |
| Compute | Fly.io shared-cpu-1x + 256 MB | ~$1.94 |
| Storage | 1 GB persistent volume | ~$0.15 |
| Database | SQLite on volume | $0 |
| Auth | Shared password or Cloudflare Access | $0 |
| Frontend | Served by FastAPI | $0 |
| Domain | Cloudflare .com | ~$0.82/year = ~$0.07/mo |
| Backups | Platform snapshots + manual export | $0 |
| **Total** | | **~$2–4/month** |

### Option B — Multi-user household product (no public marketing)

| Component | Choice | Monthly cost |
| --- | --- | --- |
| Compute | Railway Hobby + small resources | ~$5–8 |
| Database | SQLite on volume, or Neon free tier | $0–7 |
| Auth | Built-in JWT accounts (already done) | $0 |
| Email | Resend free tier | $0 |
| Frontend | Served by FastAPI | $0 |
| Domain | Cloudflare .com | ~$0.07/mo |
| **Total** | | **~$5–15/month** |

### Option C — Public SaaS with sign-ups

| Component | Choice | Monthly cost |
| --- | --- | --- |
| Compute | Railway Hobby / Fly.io | ~$5–10 |
| Database | Supabase Pro / Neon Launch | ~$25–35 |
| Auth | Clerk free tier (up to 50K retained users) or Supabase Auth | $0–25 |
| Email | Resend free tier or Pro | $0–20 |
| Frontend | Vercel free or served by FastAPI | $0 |
| Domain | Cloudflare .com | ~$0.07/mo |
| **Total** | | **~$30–90/month to start** |

---

## 9. Security checklist before going live

- [ ] Use **HTTPS only** (all platforms above handle this automatically).
- [ ] Move `SECRET_KEY`, `DATABASE_URL`, and any API keys into environment variables — never commit them.
- [ ] Set FastAPI `allow_origins` to your exact production domain, not `*`.
- [ ] Enable **rate limiting** on `/api/auth/login` and `/api/auth/register` (`slowapi` or Cloudflare rules).
- [ ] Store passwords as bcrypt hashes (already done).
- [ ] Add **input validation** / length limits to the registration endpoint to prevent abuse.
- [ ] Set up **automated backups** before storing real financial data.
- [ ] If you use SQLite, run only one backend replica; for multiple replicas, switch to Postgres.
- [ ] Add logging/monitoring (Sentry free tier, or platform logs) so you know if the app breaks.

---

## 10. Recommended first step

For a private budget website you can access from an iPad:

1. **Deploy to Fly.io or Railway** with SQLite on a persistent volume.
2. **Use a single shared password** or **Cloudflare Access** for auth.
3. **Serve the React build from FastAPI** so everything lives on one domain.
4. **Buy a cheap .com** (Cloudflare Registrar or Namecheap promo).
5. **Set up nightly backups** of the SQLite file.

This gets you a real, secure-enough private website for roughly **$3–7/month**.

If you later want friends or other households to sign up, upgrade to:

- **Postgres** (Neon or Supabase) instead of SQLite.
- **Built-in JWT auth** (already implemented) or **Clerk**.
- **Resend** for password resets.
- Separate frontend hosting (Vercel/Cloudflare Pages) for better performance.

That upgrade path costs roughly **$25–50/month** at low scale.

---

## 11. Things to watch out for

- **Free tiers with inactivity shutdowns**: Render free web services spin down after 15 minutes; Supabase free projects pause after 7 days. For a budget app you use occasionally, this means a slow first request. Paid tiers stay awake.
- **Egress charges**: if your app sends a lot of chart data or serves big JS bundles, bandwidth can add up. Most small apps will never hit the free egress limits.
- **Renewal traps**: domain first-year promo prices are much lower than renewals. Cloudflare is usually the cheapest long-term option.
- **Overage math**: auth providers meter “monthly active/retained users.” A household budget app has low user counts, so free tiers go a long way.

---

*Last updated: September 2026. Prices are indicative — verify on each provider’s pricing page before deploying.*
