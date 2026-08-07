# AGENTS.md — Faraja Solution Loans

> Instructions for AI coding agents working in this repo. This file is behavior-shaping, not documentation: read it, follow it, keep it up to date.

## Role & working style

Act as a **senior staff engineer** on a production microfinance (lending) system.

- **Inspect before assuming.** Never guess how something works — read the actual files first (`PLAN.md`, the relevant router/model/page, `AGENTS.md`).
- **Propose before changing.** For anything non-trivial, state the plan and the smallest change that achieves it before writing code.
- **Keep changes minimal.** Never rewrite working code, restructure files, or "improve" style unless asked.
- **Three-strikes rule.** If the same fix fails three times, stop, re-read the surrounding code, and report the blocker instead of retrying.
- **Never fabricate.** No invented test results, no fake data in new code, no pretending an endpoint exists. If something doesn't exist, say so.
- **No tests.** This project has **no test suite** — do not create test files, fixtures, or test tooling unless explicitly asked.
- **Money is real.** This is a lending system: a rounding or duplicate-payment bug costs actual money. Slow down on anything touching amounts, statuses, or dates.
- **Report honestly.** After a task, state exactly what changed and what you verified (commands run, build/lint results).

## Roadmap execution (per-item workflow)

We work through the **Roadmap to Launch** checklist in `PLAN.md`. Every completed item follows the same loop:

1. Implement the smallest safe change (verify with `ruff check` backend / `pnpm build` + `pnpm lint` frontend).
2. Tick the item `[x]` in `PLAN.md`; if the item changes architecture, permissions, or known bugs, update the matching section here and in `PLAN.md` too.
3. Commit code + `PLAN.md` + `AGENTS.md` together in **one logical commit** (Conventional Commits: `feat:`, `fix:`, `docs:`).
4. Push immediately (`git push origin main` → Render auto-deploy).
5. Confirm the item is live on staging before moving to the next.

- One commit per item; no force push, no amending pushed commits.
- Deferred items get `[~]` plus a note in the Decisions Log (`PLAN.md`) and are never silently dropped.

## Project overview

Microloan management system for Faraja Solution Loans (Kenya): loan products (Faraja 4wk / 5wk / Lumpsum), client registration with KYC documents and signatures, loan workflow (pending → approved → disbursed → closed), weekly installment tracking, penalty calculation (3% per 2 days), repayments with manual verification, branches, users/roles/permissions, reports, and notifications. Master plan + live progress: `PLAN.md` (read before starting work).

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python >=3.14 · FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL (psycopg3) · python-jose · Resend · ReportLab (unused) · APScheduler (unused) |
| Frontend | Next.js 16.2 (Turbopack) · React 19 · TypeScript · Tailwind 4 · shadcn-style UI · TanStack Query/Table · axios · react-hook-form + zod · recharts · react-signature-canvas · sonner |
| Packaging | Backend: `uv` · Frontend: `pnpm` — **never npm** (deployment build runs pnpm) |

## Commands (prove-it)

```bash
# Backend (backend/)
uv run uvicorn app.main:app --reload      # dev server :8000 (real entry is app/main.py)
uv run alembic upgrade head
uv run ruff check . && uv run ruff format .   # line-length 100, double quotes
uv run mypy app                           # strict type checking

# Frontend (frontend/)
pnpm dev                                  # dev server :3000
pnpm build                                # MUST pass before finishing frontend work (Vercel runs this)
pnpm lint                                 # eslint
```

Before finishing any frontend task: run `pnpm build` and `pnpm lint`. Backend: `ruff check`. Fix only issues your change introduced — the repo has pre-existing lint errors (84) and no tests; leave unrelated ones alone unless asked.

## Agent tooling — skills & MCPs (installed 2026-08-07)

Use these when relevant; they are the sanctioned way to fill framework-knowledge gaps and verify UI work.

- **Skills** (`.opencode/skills/frameworks/`, load on demand at the start of relevant work):
  - `fastapi` — backend conventions: Pydantic v2 schemas, versioned routes, dependency injection, structured logging. Load before backend work in `backend/`.
  - `nextjs` — frontend conventions: App Router, shadcn/ui primitives, server components, Tailwind tokens, accessibility. Load before frontend work in `frontend/`.
- **MCPs** (context7 is global in `~/.config/opencode/opencode.jsonc`; playwright is repo-local in `opencode.json`):
  - `context7` — live library docs (FastAPI, Pydantic, SQLAlchemy, Next.js, React). Consult it instead of guessing version-specific APIs — especially for Next.js 16 breaking changes (complements `frontend/node_modules/next/dist/docs/`).
  - `playwright` — browser verification of frontend flows. Use for end-to-end checks of UI work (it is the exception to the frontend "no browser" rule, updated 2026-08-07). The human mobile-width (375px) check remains mandatory.

## Kenya locale & financial rules (non-negotiable)

- **Currency:** Kenyan Shilling (KES). Display with `Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 })` — never hardcode "KES" strings and never format amounts with bare `.toLocaleString()` without the `en-KE` locale. Dates: `toLocaleDateString("en-KE", ...)`, timezone `Africa/Nairobi` (`settings.DEFAULT_TIMEZONE`).
- **Money = Decimal, never float.** Use `Decimal` in Python and `Numeric(18, 2)` in DB columns (existing models already do this — keep it). Round only at display/persist boundaries, as late as possible. Never sum floats.
- **Don't invent money.** Partial payments must not round up or drop residuals; track exact amounts.
- **Idempotency & duplicate protection.** Any new money-moving endpoint (repayments, fees, future M-Pesa) must be safe against double submission — unique constraints on reference numbers, check-before-insert, or an idempotency key. The system is still manual-verified: repayment recording and verification are separate steps (four-eyes principle, `recorded_by` vs `verified_by`).
- **Audit trail.** Financial state changes (loan approve/disburse/close, repayment record/verify) must record who did it (`*_by_id` fields) and when. Never add a column like "updated" to fake an audit trail; append events.
- **KYC & data protection (Kenya Data Protection Act 2019, ODPC).** Client data includes national ID numbers, KRA PINs, photos, and signatures — collect only what the form requires, never log them, never expose them in list endpoints, treat consent as a real requirement. Photos/signatures may be base64 in dev; S3 in prod.
- **Payment modes:** `Cash`, `MPesa`, `BankTransfer`, `Cheque`, `Other` (existing enum — don't invent new modes). Kenyan phone numbers: store as `+2547XXXXXXXX`-compatible format.
- **Swahili/locale terms used in the product:** "Kesho kutwa" = day after tomorrow (used for due-date notifications). Keep them where they exist.
- **Compliance-aware reporting:** reports/arrears must support CBK-style classification (days past due, non-performing exposure) — don't silently drop overdue or past-maturity data from aggregations.

## Code style

**Backend (FastAPI)**
- Routers = endpoints only; business logic goes in `app/services/` (see `loan_service.py`).
- Auth on every endpoint: `Depends(get_current_user)` + `_require_permission(user, "perm.name")` — permission names MUST exist in `app/core/permissions.py` (a typo silently 403s everyone).
- Models: SQLAlchemy 2.0 style — `Mapped[...]` + `mapped_column(...)`, UUID PKs, `BaseModel` in `app/models/base.py`. New tables need an Alembic migration.
- Enums from `app/models/enums.py` (StrEnum). Serialize with `.value`.
- Format: ruff, line-length 100, double quotes, section-divider comments like existing files.

**Frontend (Next.js 16)**
- ⚠️ Next.js 16 has breaking changes vs older versions — read `frontend/node_modules/next/dist/docs/` before writing code (see `frontend/AGENTS.md`).
- Functional components only; `"use client"` for pages (this app is fully client-side, no `route.ts`).
- All HTTP via `features/*/api.ts` modules using the axios instance from `app/lib/api.ts` — the canonical loan/client/repayment/report module is `features/clients/api.ts`. Add typed functions there; never call axios directly from a page.
- Data fetching via TanStack Query (`useQuery`/`useMutation`); validation with zod; forms with react-hook-form.
- Never use `any`; keep functions small; use `async/await`; no hardcoded fallback numbers (existing dashboard/settings pages violate this — don't extend the pattern).
- UI primitives from `components/ui/` (shadcn-style). Brand colors: primary `#0D44A2`, accent `#F57424`. Tailwind 4 (no config file).

## Architecture (where things live)

- Backend entry: `app/main.py` → `app/create_app.py`; routers registered in `app/api/router.py` under `/api/v1`.
- Routers: `auth`, `admin`, `loans_clients` (clients, loans, installments, repayments, dashboard stats), `branches`, `reports`, `notifications`, `search`, `fees`, `seed`.
- Branch scope helper: `get_user_branch_ids(user)` in `app/core/permissions.py` (None = unrestricted; list = scoped; empty = see nothing). Used by clients/loans/repayments/search/branches/dashboard-stats. **Write side enforced too (2026-08-07):** client create/update and loan create validate the branch — scoped users can only assign their own branch (403), unrestricted users must supply an existing branch (400); `GET /clients/{id}` is branch-scoped like the list; client registration UI sends `branch_id` (dropdown for unrestricted, auto-assigned for scoped) and gates on the real `clients.create` permission.
- **Client list slims media (2026-08-07):** `GET /clients` returns base64 photo/signature fields as `null` (payload bloat); the full KYC media comes only from `GET /clients/{id}` via `fetchClientApi` — the client detail drawer fetches per client (`["client-detail", id]` query, snapshot → live swap, Retry banner on error). Don't re-add media to the list serializer.
- **Profile photos (2026-08-07):** `GET /auth/me` returns `profile_photo` (base64, `AuthUser` schema ← `users.profile_photo` set by the invite `complete-profile` step). Sidebar user card and topbar user-menu render `<img class="size-full rounded-full object-cover">` inside the Avatar with the initials `AvatarFallback` when absent. Keep the fallback whenever a new avatar appears.
- **Dashboard activity feed (2026-08-07):** `/dashboard/stats` `recent_activity` emits 6 types — `repayment`, `loan` (application), `approval`, `disbursement`, `client`, `fee` — each queried per module (latest 8), merged and sorted by time desc, trimmed to 8. Frontend `DashboardActivity` union + `ACTIVITY_ICONS` map must be extended whenever a new event type is added (icon-only Record, missing keys break the build).
- **Notification prefs (2026-08-07):** per-user `notification_prefs` table (user_id PK, JSONB `prefs`, default all-true in `DEFAULT_PREFS` in `app/models/notification_pref.py`). `GET/PATCH /notifications/preferences` (Pydantic `NotificationPrefs` schema — field names are the 6 live notification types: `due_today`, `due_tomorrow`, `almost_due`, `arrears`, `repayment_pending`, `pending_approval`). `_build_notifications` filters server-side by prefs. New notification types MUST be added to `DEFAULT_PREFS` + the `NotificationPrefs` schema + Settings toggle list in `settings/page.tsx` + frontend `NotificationPrefs` type.
- **Deep-link params (2026-08-07):** dashboard pages read one-shot URL params at render time (guarded render-time state init, param cleared via `history.replaceState`): `/clients?client=<id>` opens the detail drawer, `/loans?loan=<id>` opens the loan drawer, `/loans?apply=true` opens the new-loan form. Topbar global search navigates with the record id (`?client=`/`?loan=`). Keep this convention for new deep links — don't use `useSearchParams` on these static pages (Suspense constraint).
- `app/services/` = business logic · `app/models/` = schema · `app/core/` = config/security/permissions/seed data · `app/schemas/` = Pydantic.
- `app/tasks/` (empty) = future APScheduler jobs · `app/reports/` (empty) = future report layer · `app/storage/s3_service.py` = dev no-op until prod.
- Frontend pages: `app/(dashboard)/{dashboard,loans,clients,repayments,reports,schedule,branches,users,settings}/page.tsx` (single-file pages, detail views are drawers). Auth: `app/(auth)/{login,accept-invite}`. JWT cookie `faraja_token` via `app/lib/auth.ts`; axios interceptor auto-redirects to `/login?expired=true` on 401.

## Canonical permissions (`app/core/permissions.py`)

`dashboard.view` · `audit.view` · `branches.{view,manage}` · `clients.{view,create,update,delete}` · `loans.{view,create,approve,reject,disburse,update,writeoff}` · `repayments.{view,record,verify}` · `fees.{view,record,verify}` · `reports.{view,export}` · `roles.{view,manage}` · `users.{view,create,update,delete}` · `settings.manage` · `expenses.{view,create,approve}` (defined, unused yet).

Use these exact strings. Known historical violations (do not reintroduce): `clients.edit` → `clients.update`; `repayments.create` → `repayments.record`. New `fees.*` permissions require a seed re-run (`app/db/seed.py` is idempotent) to take effect.

## Business rules quick reference

| Product | Duration | Rate (flat) | Installments | Penalty |
|---|---|---|---|---|
| Faraja 4 Weeks | 28 days | 20% | 4 weekly | 3% every 2 days on outstanding |
| Faraja 5 Weeks | 35 days | 30% | 5 weekly | 3% every 2 days |
| Lumpsum | agreed | TBD (20% placeholder) | lump at end | TBD |

- Installments = equal weekly splits of total repayable, generated at disbursement.
- Loan statuses: `Pending / Approved / Disbursed / Rejected / Closed` (DB). Computed states: Almost Due (2 days before due), Due, Arrears, Past Maturity, Defaulter (past maturity > 1 month), Missed Payment.
- Payment verification is manual (Manager/Director). M-Pesa is future scope. Locations = Google Maps links.
- **Application fee (2026-08-07):** collected at loan application, NOT registration. Tiers: 4–10k → KES 800 new / 600 existing; >10k → 1,500 new / 1,000 existing (existing = client with ≥1 disbursed/closed loan). Non-refundable, excluded from the repayment schedule. `POST /loans` refuses applications below KES 4,000 or without a **verified** `fee_payments` row matching the quote; the fee is consumed (linked) by the first loan. Recorder may verify their own record (cash collected at the desk, 2026-08-07). `fee_service.py` = quote/eligibility logic.

## Known bugs & current work (see PLAN.md)

1. ✅ **Fixed 2026-08-07** — permission mismatches `clients.edit`→`clients.update`, `repayments.create`→`repayments.record` (`loans_clients.py:288`, `:681`). Do not reintroduce.
2. ✅ **Fixed 2026-08-07** — duplicated admin route block deleted (`admin.py`); duplicate unguarded `GET /branches` removed from `loans_clients.py` (guarded branches.py version now serves).
3. ⚠️ **Decision reversed 2026-08-07** — `backend/.env` was committed by design, but GitHub push protection blocks any push containing the real Resend key, so it is now **gitignored** (history purged). Copy `.env.example` to `backend/.env` locally. Treat the exposed keys as compromised: **rotate the Resend API key and SECRET_KEY**, never add secrets to any other file.
4. ✅ **Fixed 2026-08-07** — permission resolution `ur.role.permissions` raised `AttributeError` (Role has no `permissions` relationship) → 500 on every permission-checked endpoint for authenticated users (notifications, loans, clients, repayments, reports, branches). All routers now use `get_user_permissions(db, user)` from `app/core/permissions.py`; `_require_permission` signature is `(db, user, perm)`.
5. ✅ **Fixed 2026-08-07** — notification read-state now DB-backed (`notification_reads` + `PATCH /notifications/{id}/read`); `5df95998dc2f` added `PENDING_APPROVAL` to the userstatus enum (invitees could not be inserted); `RESEND_FROM_EMAIL` override in `.env` (key is domain-restricted to `faraja.enkaai.net`).
6. Missing (planned): financial report, APScheduler email jobs, PDF service. ✅ `POST /auth/complete-profile` shipped 2026-08-07 (see invite flow note below).
6b. ✅ **Invite flow (2026-08-07)** — `accept-invite` creates the user (`PENDING_APPROVAL`) but the invite stays `PENDING` until `POST /auth/complete-profile` saves phone/ID/photo (`users.phone`, `users.id_no`, `users.profile_photo` — migration `6f2942b8aaea`) and marks it `ACCEPTED`. Re-submitting accept-invite mid-setup is idempotent (returns the existing user). User can't log in until the Director approves (`PATCH /admin/users/{id}/approve` → `ACTIVE`). Frontend: accept-invite page = password step → profile step → success.
7. ✅ **Fixed 2026-08-07** — client registration 500 `AttributeError: 'dict' object has no attribute 'model_dump'`: Pydantic v2 `model_dump()` already serializes nested models to dicts, so `create_client`'s list comprehension crashed on any non-empty dependants/next-of-kin/properties (empty lists passed silently). Fixed: `**request.model_dump()` (`loans_clients.py`).
8. ✅ **Fixed 2026-08-07** — expired/invalid JWT returned 500 instead of 401 on every authed endpoint: `get_current_user` only caught `AuthenticationError` but jose raises `ValueError`. Fixed: catch both → 401 (`dependencies/auth.py`), so the frontend interceptor redirects to `/login?expired=true`.

## Staging database policy (2026-08-07) — FIRST AND LAST RESET

- **The staging DB was reset exactly once** (2026-08-07) so the seed could be rebuilt to match the current schema: 11 branches, 6 roles + 2 extra demo users (FS-LO002/FS-MGR002, Kilifi), 3 loan products, 9 demo clients (full KYC), 8 loans covering **every state** (Pending, Approved, Rejected, Performing, Arrears, Past Maturity, Defaulter, Paid/Closed), installments + repayments (verified **and** unverified for the Finance Officer), and 9 fee payments (8 verified + 1 unverified for the verification workflow). Seed data lives in `app/db/seed_data.py`; dates are day-offsets so states stay valid whenever reseeded.
- **This is the LAST full database reset. From now on: migrations only.** Any schema or data change ships as a new Alembic revision (`uv run alembic revision --autogenerate`, review it, apply with `uv run alembic upgrade head`). Never drop/recreate the staging or production database again without explicit user authorization.
- `python -m app.db.seed` (and `POST /internal/seed` with `X-Seed-Key`) is **additive and idempotent** — safe to re-run any time; it never deletes or rewrites existing rows.
- Staging DB connection details live in the Render service env vars (the Neon URL is commented out in `backend/.env` — the active local URL points at the dev docker Postgres).

## Boundaries — do not touch without asking

- `backend/.env` (secrets — gitignored, never commit), `frontend/.env.local`, `node_modules/`, `.next/`, `.venv/`, `uv.lock`/`pnpm-lock.yaml` (no dependency changes without approval), `alembic/versions/*` (migrations are immutable once applied — new revisions only), `PLAN.md` status sections (update only as part of a plan-update task).
- Never commit anything (no `git commit`/`git push` unless explicitly asked). **Exception:** roadmap-item completion commits are pre-approved by the owner (see "Roadmap execution" above) — code + `PLAN.md` + `AGENTS.md` in one Conventional Commit per item, pushed immediately.
- Never delete or rewrite seeded data definitions (`app/core/branches.py`, `app/core/permissions.py`, `app/db/seed.py`) without flagging that DB reseeding will be needed.

## Git workflow

If asked to commit: stage only files relevant to the task (check `git status` + `git diff` first), Conventional Commits style (`fix:`, `feat:`, `docs:`, `chore:`), one logical change per commit. No force push, no amending pushed commits. Roadmap items bypass the "ask first" rule — see "Roadmap execution".

## Prompting the user's way (for agents and humans)

Well-formed tasks for this repo look like:
> Inspect the relevant code, propose a plan, wait for approval, then implement the smallest safe change. Verify with `pnpm build` (frontend) or `ruff check` (backend) and explain what changed.

---
*Keep this file updated: when the architecture, permissions, or known-bugs change, update the matching section here and in `PLAN.md`.*
