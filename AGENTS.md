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
- Routers: `auth`, `admin`, `loans_clients` (clients, loans, installments, repayments, dashboard stats), `branches`, `reports`, `notifications`, `seed`.
- `app/services/` = business logic · `app/models/` = schema · `app/core/` = config/security/permissions/seed data · `app/schemas/` = Pydantic.
- `app/tasks/` (empty) = future APScheduler jobs · `app/reports/` (empty) = future report layer · `app/storage/s3_service.py` = dev no-op until prod.
- Frontend pages: `app/(dashboard)/{dashboard,loans,clients,repayments,reports,schedule,branches,users,settings}/page.tsx` (single-file pages, detail views are drawers). Auth: `app/(auth)/{login,accept-invite}`. JWT cookie `faraja_token` via `app/lib/auth.ts`; axios interceptor auto-redirects to `/login?expired=true` on 401.

## Canonical permissions (`app/core/permissions.py`)

`dashboard.view` · `audit.view` · `branches.{view,manage}` · `clients.{view,create,update,delete}` · `loans.{view,create,approve,reject,disburse,update,writeoff}` · `repayments.{view,record,verify}` · `reports.{view,export}` · `roles.{view,manage}` · `users.{view,create,update,delete}` · `settings.manage` · `expenses.{view,create,approve}` (defined, unused yet).

Use these exact strings. Known historical violations (do not reintroduce): `clients.edit` → `clients.update`; `repayments.create` → `repayments.record`.

## Business rules quick reference

| Product | Duration | Rate (flat) | Installments | Penalty |
|---|---|---|---|---|
| Faraja 4 Weeks | 28 days | 20% | 4 weekly | 3% every 2 days on outstanding |
| Faraja 5 Weeks | 35 days | 30% | 5 weekly | 3% every 2 days |
| Lumpsum | agreed | TBD (20% placeholder) | lump at end | TBD |

- Installments = equal weekly splits of total repayable, generated at disbursement.
- Loan statuses: `Pending / Approved / Disbursed / Rejected / Closed` (DB). Computed states: Almost Due (2 days before due), Due, Arrears, Past Maturity, Defaulter (past maturity > 1 month), Missed Payment.
- Payment verification is manual (Manager/Director). M-Pesa is future scope. Locations = Google Maps links.

## Known bugs & current work (see PLAN.md)

1. ✅ **Fixed 2026-08-07** — permission mismatches `clients.edit`→`clients.update`, `repayments.create`→`repayments.record` (`loans_clients.py:288`, `:681`). Do not reintroduce.
2. ✅ **Fixed 2026-08-07** — duplicated admin route block deleted (`admin.py`); duplicate unguarded `GET /branches` removed from `loans_clients.py` (guarded branches.py version now serves).
3. ✅ **Decision 2026-08-07** — `backend/.env` (real Resend key + SECRET_KEY) is **committed by design** (single team repo). Treat it as sensitive: never log secrets, rotate keys if leaked, never add secrets to any other file.
4. Notifications read-state is in-memory (resets on restart); frontend mark-read is local-only.
5. Missing (planned): `POST /auth/complete-profile`, financial report, APScheduler email jobs, PDF service, users-page invite UI, change-password wiring.

## Boundaries — do not touch without asking

- `backend/.env` (secrets), `frontend/.env.local`, `node_modules/`, `.next/`, `.venv/`, `uv.lock`/`pnpm-lock.yaml` (no dependency changes without approval), `alembic/versions/*` (migrations are immutable once applied — new revisions only), `PLAN.md` status sections (update only as part of a plan-update task).
- Never commit anything (no `git commit`/`git push` unless explicitly asked).
- Never delete or rewrite seeded data definitions (`app/core/branches.py`, `app/core/permissions.py`, `app/db/seed.py`) without flagging that DB reseeding will be needed.

## Git workflow

If asked to commit: stage only files relevant to the task (check `git status` + `git diff` first), Conventional Commits style (`fix:`, `feat:`, `docs:`, `chore:`), one logical change per commit. No force push, no amending pushed commits.

## Prompting the user's way (for agents and humans)

Well-formed tasks for this repo look like:
> Inspect the relevant code, propose a plan, wait for approval, then implement the smallest safe change. Verify with `pnpm build` (frontend) or `ruff check` (backend) and explain what changed.

---
*Keep this file updated: when the architecture, permissions, or known-bugs change, update the matching section here and in `PLAN.md`.*
