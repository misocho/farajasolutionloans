# Faraja Solution Loans — Master Implementation Plan

> **Last updated:** 2026-08-07
> **Progress legend:** `[ ]` Not started · `[/]` In progress · `[x]` Done

---

## Decisions Log

| Decision | Answer |
|----------|--------|
| Almost Due threshold | **2 days** before due date |
| Email provider | **Resend** |
| M-Pesa integration | Deferred — future scope |
| Installment schedule (4wk / 5wk loans) | **Weekly installments** |
| Location storage | **Google Maps link** (no self-hosted maps) |
| Company section in client form | Pending |
| Lumpsum product rates | ⚠️ **Still pending** — seeded with 20% placeholder (`app/db/seed.py:301`) |
| Defaulter definition | Past maturity > 1 month ✅ |
| Application fee collection point | **At loan application** (2026-08-07) — tier from loan amount + client history; block loan creation until fee paid & verified |
| Application fee tiers | 4–10k: **800 new / 600 existing** · >10k: **1500 new / 1000 existing** (existing = ≥1 disbursed/closed loan); non-refundable, NOT part of loan schedule; **minimum loan = KES 4,000** |
| Fee permissions | **Dedicated** `fees.view` / `fees.record` / `fees.verify` (2026-08-07); recorder may verify own record (cash at desk) |
| Estimated asset value | **Client-level business field** `clients.estimated_asset_value` (2026-08-07) |
| Dashboard scope | **P7 2026-08-07** — rebuild to real data, zero placeholders; inline quick modals removed (they duplicated pages with incomplete forms); Quick Actions navigate to the real pages; trend + quality stats come from an extended `/dashboard/stats`; real audit trail (`audit_logs`) deferred to P7-C |

---

## Roadmap to Launch — CLIENT-APPROVED + LAUNCH-READY (2026-08-07)

> **Definition of done:** Phase A feedback loop closed with client sign-off + phases B–E complete + launch gate (Phase F) passed.
> **Workflow:** tick each item `[x]` and **commit + push immediately on completion** — one logical commit per item (see AGENTS.md "Roadmap execution"). Deferred items get `[~]` + a Decisions Log note.
> **Standing decisions:** no automated tests (AGENTS.md) · M-Pesa remains future scope · complete-profile IS in scope · total effort ≈ 6 weeks of work.

### Phase A — Client UAT + feedback loop (staging, ongoing)

- [ ] A1 Verify duplicate-invite fix deployed on staging (health + 409 on duplicate invite, live)
- [ ] A2 Run client through `CLIENT_TEST_GUIDE.txt`; collect feedback
- [ ] A3 Convert feedback to a prioritized backlog (fix / defer / won't-do) — client re-signs at the launch gate

### Phase B — Top navigation & profile (second priority, client-raised 2026-08-07)

- [x] B1 Global search in top nav — backend `GET /search?q=` (clients by name/phone/ID, loans by number, branch-scoped) + debounced results dropdown in topbar → click navigates to the right page
- [x] B2 Branch switcher actually filters — `/auth/me` gains `branch_ids`; `GET /branches` scoped to user's branches (kills manager data leak); `branch_id` params on `GET /clients`, `GET /repayments`, `GET /dashboard/stats`; dashboard/clients/loans/repayments pages pass the selection into their queries
- [x] B3 Profile menu wired — My Profile + Permissions dialogs (from `/auth/me`), Settings → `/settings`, Change Password dialog → `PATCH /auth/change-password`

### Phase C — Core workflow close-out (P1–P3) · ~2 weeks

- [x] C0 Client branch integrity on registration — form sends `branch_id` (dropdown for Director/System Admin, auto-assigned for scoped LO/Manager); backend validates branch exists (400) + enforces user scope on create/update (403); `GET /clients/{id}` and `POST /loans` scope-checked; clients page gate uses real `clients.create` permission
- [x] C1 `POST /auth/complete-profile` + accept-invite → profile step (phone/ID/photo) → PENDING_APPROVAL — accept-invite now defers invite acceptance; profile step in accept-invite flow calls complete-profile (new `users.phone/id_no/profile_photo` columns, migration `6f2942b8aaea`); user stays PENDING_APPROVAL until Director approves
- [x] C2 Settings change-password wired to `PATCH /auth/change-password` — Security section uses `changePasswordApi` (useMutation): validates fields, min-8 check, shows backend `detail` on 400 ("Current password is incorrect."), clears form on success; no more fake setTimeout save in the password flow
- [x] C3 Client detail drawer → `GET /clients/{id}` — new `fetchClientApi`; drawer opens instantly from list snapshot then swaps in fresh detail via `useQuery(["client-detail", id])`; error banner with Retry if refresh fails. Backend: list endpoint now slims base64 media (photos/signatures → null; full payload only in `GET /clients/{id}`)
- [ ] C4 Full computed status badges (Almost Due / Due / Arrears / Past Maturity / Defaulter) + per-loan installment timeline
- [ ] C5 Partial-payment → Arrears verified end-to-end + partial-payment warning in repayments UI
- [ ] C6 `PATCH /admin/loan-products/{id}` (penalty rate/interval config)
- [ ] C7 Google Maps link input + preview on client form
- [ ] C8 Branch-scoping verification pass (LO/Manager see own branch only) + close permission-guard gaps (`GET /loan-products`, `/dashboard/stats`, `/notifications`)

### Phase D — Reports & email notifications (P4–P5) · ~2 weeks

- [ ] D1 Financial report (month/year per branch: active clients, disbursed, repayments, P&L, write-offs) + frontend tab, month/year picker, branch filter, export
- [ ] D2 APScheduler daily job — due/arrears emails (T-2, due-today, arrears, past-maturity) + loan approved/disbursed → LO + penalty snapshot
- [ ] D3 CSV export for existing reports

### Phase E — PDF & audit trail (P6, P7-C) · ~1 week

- [ ] E1 `pdf_service.py` (ReportLab) + `GET /clients/{id}/pdf` + "Download Form PDF" button (signatures already captured)
- [ ] E2 `audit_logs` table + event writes (approve/disburse/close, repayment/fee record+verify, client create) + `GET /audit-logs` + Audit Logs page (replaces dead button)

### Phase F — Production hardening · ~1 week

- [ ] F1 Business answers: Lumpsum rate + company section in client form (needed for launch seed)
- [ ] F2 Backend root `main.py` stub cleanup + register `/health`
- [ ] F3 S3 for photos/signatures + Neon prod DB + backup strategy + secret-rotation verification (Resend key, `SECRET_KEY`)
- [ ] F4 Lint debt (84 pre-existing) + fix stale `make deploy` (uvx → /var/opt/uv) + refresh MANUAL_DEPLOY.md

### Phase G — Launch gate

- [ ] G1 Client sign-off on UAT feedback + final walkthrough on prod data
- [ ] G2 Seed prod DB, flip frontend to prod, go-live

---

## Actual Progress Snapshot (from 2026-08-07 code survey)

> Backend is **fully DB-backed — zero mock-data endpoints remain**. Frontend is mostly wired to real APIs. Remaining work: complete-profile, settings change-password wiring, client detail fetch, advanced loan statuses, financial report, scheduled email jobs, PDF service, and bug fixes below.

### Known Bugs / Blockers (fix first)

| # | Bug | Impact | Location |
|---|-----|--------|----------|
| 1 | Permission name mismatch: checks `clients.edit` but seeded permission is `clients.update` | ✅ **FIXED 2026-08-07** → `clients.update` | `backend/app/api/routers/loans_clients.py:288` |
| 2 | Permission name mismatch: checks `repayments.create` but seeded permission is `repayments.record` | ✅ **FIXED 2026-08-07** → `repayments.record` | `backend/app/api/routers/loans_clients.py:681` |
| 3 | Entire admin route block duplicated (lines 51–267 copied at 270–422) | ✅ **FIXED 2026-08-07** — duplicate block deleted (422 → 269 lines) | `backend/app/api/routers/admin.py` |
| 4 | Duplicate `GET /branches`: unchecked version in `loans_clients.py` registered first, shadows permission-checked one in `branches.py` | ✅ **FIXED 2026-08-07** — removed; guarded version (with stats) now serves; OpenAPI shows 1 definition | `backend/app/api/routers/loans_clients.py` |
| 5 | `.env` (real Resend API key + `SECRET_KEY`) committed to git | ⚠️ **DECISION REVERSED 2026-08-07** — push protection blocked the key; `.env` purged from history and gitignored; **rotate Resend key + SECRET_KEY**; copy `.env.example` | `backend/.env` |
| 6 | Notification read-state is an in-memory dict (resets on restart); frontend mark-read is local state, `PATCH /notifications/read-all` not called | Read state lost on restart | `backend/app/api/routers/notifications.py:35` |
| 7 | Lumpsum interest rate placeholder `0.20` marked TBD | Wrong pricing | `backend/app/db/seed.py:301` |
| 8 | Backend root `main.py` is a "Hello from backend!" stub; real entry is `app/main.py`; `health.py` router never registered | Confusion, no /health | `backend/main.py`, `backend/app/api/router.py` |
| 9 | Notification read-state persisted | ✅ **FIXED 2026-08-07** — `notification_reads` table (migration `2af447094139`) + `PATCH /notifications/{id}/read`; frontend uses server read state | `backend/app/models/notification_read.py` |
| 10 | User enum missing `PENDING_APPROVAL` (new invitees never inserted) | ✅ **FIXED 2026-08-07** — migration `5df95998dc2f` adds value; applied | `backend/app/models/enums.py` |
| 11 | Resend key domain-restricted to `faraja.enkaai.net` (403 on `farajasolutions.co.ke` sender) | ✅ **FIXED 2026-08-07** — `RESEND_FROM_EMAIL` override in `.env`; test send verified | `backend/.env` |
| 12 | Calendar overdue window too narrow (14d) + timezone drift; status case bug | ✅ **FIXED 2026-08-07** — 180d history window; `today_nairobi()`; installment marking on repayment verify | `backend/app/core/time.py` |
| 13 | Branch form had dead manager fields + free-text code; frontend `branch.location` | ✅ **FIXED 2026-08-07** — code auto-generated; `address` field; interface updated | `backend/app/api/routers/branches.py` |
| 14 | Client registration 500 when dependants/next-of-kin/properties lists non-empty: `AttributeError: 'dict' object has no attribute 'model_dump'` (Pydantic v2 `model_dump()` already yields dicts) | ✅ **FIXED 2026-08-07** — `**request.model_dump()`; verified full payload incl. lists (201, data intact) | `backend/app/api/routers/loans_clients.py` |
| 15 | Expired/invalid JWT → 500 on all authed endpoints (`get_current_user` caught only `AuthenticationError`; jose raises `ValueError`) | ✅ **FIXED 2026-08-07** — catch `ValueError` too → 401; verified garbage token = 401 | `backend/app/api/dependencies/auth.py` |
| 16 | System Admin role had no `loans.*`/`clients.*`/`repayments.*` permissions → loans page 403, no approve button | ✅ **FIXED 2026-08-07** — System Admin now = all `PERMISSIONS` (33); seed re-run applied (idempotent); verified `FS-SYS001` GET /loans 200 + `loans.approve` present | `backend/app/db/seed.py` |
| 14 | Pending invites stayed visible after approve | ✅ **FIXED 2026-08-07** — users page filters ACTIVE invitees + invalidates `admin-invites` | `frontend/app/(dashboard)/users/page.tsx` |

---

## Existing Infrastructure (Already Done — DO NOT redo)

| What | Where | Notes |
|------|-------|-------|
| Auth — login (employee_number + password), JWT, `/auth/me` | `backend/app/api/routers/auth.py` | ✅ Real DB |
| Admin — list users, roles, permissions CRUD, update user roles, update role permissions | `backend/app/api/routers/admin.py` | ✅ Real DB, Director-only |
| Users admin page (directory + permissions matrix) | `frontend/app/(dashboard)/users/page.tsx` | ✅ Built |
| 6 Roles seeded: Director, Manager, Loan Officer, Finance Officer, System Admin, Auditor | `backend/app/db/seed_data.py` | ✅ In DB |
| 27 Permissions seeded across all modules | `backend/app/core/permissions.py` | ✅ In DB |
| 11 Branches seeded | `backend/app/core/branches.py` | ✅ In DB |
| Seed endpoint: `POST /internal/seed` (protected) | `backend/app/api/routers/seed.py` | ✅ Working |
| Role-permission mapping per role | `backend/app/db/seed.py` → `ROLE_PERMISSIONS` | ✅ Seeded |
| User model (employee_number, email, name, hashed_password, status, roles, branches) | `backend/app/models/user.py` | ✅ |
| Branch, Role, Permission, UserRole, UserBranch, RolePermission models | `backend/app/models/` | ✅ |

### Roles & Their Permission Summary (from seed.py)

| Role | Key Permissions |
|------|----------------|
| **Director** | All permissions (full access) |
| **Manager** | All except: `settings.manage`, `users.delete`, `roles.manage`, `loans.writeoff` |
| **Loan Officer** | dashboard.view, clients.view/create/update, loans.view/create, repayments.view/record, **fees.view/record** |
| **Finance Officer** | dashboard.view, repayments.view/record, **fees.view/record/verify**, expenses.view/create/approve, reports.view/export |
| **System Admin** | dashboard.view, users CRUD, roles.view/manage, branches.view/manage, audit.view |
| **Auditor** | dashboard.view, clients.view, loans.view, repayments.view, reports.view, audit.view |

---

## Architecture Snapshot — Current State (verified 2026-08-07)

| Area | Backend | Frontend | Notes |
|------|---------|----------|-------|
| Auth (login, JWT, /me) | ✅ Real DB | ✅ | JWT cookie, 401 → redirect login |
| Admin — users/roles/permissions CRUD | ✅ Real DB | ✅ | Directory + permissions matrix |
| **User invite/onboarding flow** | ✅ Real DB + Resend | ✅ Full UI (invite modal, pending invites tab, approve/cancel, status actions) — verified live 2026-08-07 | `POST /auth/complete-profile` missing (backend) |
| Loan products (Faraja 4wk, 5wk, Lumpsum) | ✅ Real DB, 3 seeded | ✅ Product dropdown from `/loan-products` (2026-08-07) | Lumpsum rate placeholder |
| Client registration (full form with photos, signatures) | ✅ Real DB | ✅ 7-step form with signature pads | Detail drawer uses list data, not `GET /clients/{id}` |
| **Application fees** | ✅ Real DB (2026-08-07): `fee_payments` table, quote/record/verify endpoints, loan creation gated on verified fee, 4k min, fee income in dashboard+summary | ✅ Loan-apply modal: client+product selects, quote, pay/verify UI, submit blocked until verified | Seed once for new `fees.*` permissions |
| Loan workflow (pending→approved→disbursed) | ✅ Real DB | ✅ Approve/reject/disburse/close | Status badges: only 5 basic + overdue flag; no Almost Due/Arrears/etc. |
| Weekly installment schedule | ✅ Generated on disbursement | ✅ Schedule calendar page | |
| Repayments & penalty calc | ✅ Real DB | ✅ Record/verify | No partial-payment warning |
| Branches | ✅ Real DB | ✅ CRUD + stats | ⚠️ Duplicate unchecked `/branches` endpoint |
| Reports (portfolio, arrears, collections, clients, summary) | ✅ Real DB | ✅ 3 tabs | ❌ Financial report (month/year) missing; no branch filter |
| Notifications (in-app) | ✅ Real DB queries | ✅ 30s polling | ✅ Read-state persisted (2026-08-07) |
| Email notifications (Resend) | ✅ Invite/approve/reset emails | — | ❌ Due/arrears alert jobs (APScheduler) missing |
| PDF form generation + e-signature | ❌ Not started (reportlab installed) | ❌ No download button | |
| M-Pesa | ⏳ Future | — | |

### Seeded data
- **11 branches** (Head Office–Miritini, Mombasa, Kilifi, Malindi, Watamu, Mariakani, Kwale, Ukunda, Lunga Lunga, Voi, Taveta)
- **6 roles** (Director, Manager, Loan Officer, Finance Officer, System Admin, Auditor) with approval limits
- **30 permissions** mapped per role (fees.view/record/verify added 2026-08-07 — re-run seed once)
- **6 users** (seed password `Faraja@2026` — change after first deploy)
- **3 loan products**: Faraja 4 Weeks (28d, 20%), Faraja 5 Weeks (35d, 30%), Lumpsum (90d, 20% TBD)

### Migrations (13, in `backend/alembic/versions/`)
`fa926c06d967` initial · `67573e441d71` branches/permissions/roles · `942b9ff118aa` users + join tables · `4e466c97d30b` password_hash→hashed_password · `97551a08382c` no-op · `ac3d7f2d3767` user_invites · `78fd0153f296` loan_products/clients/loans/installments/repayments · `9c48321056f4` photo/signature cols → Text · `a9213f2dd78e` clients.business_photo · `5df95998dc2f` userstatus + PENDING_APPROVAL · `2af447094139` notification_reads · `56abb241f073` clients.estimated_asset_value · `d3aa1130642d` fee_payments

### Services & gaps
- `auth_service.py` (login, lockout after 5 fails) ✅ · `invite_service.py` ✅ · `email_service.py` (Resend) ✅ · `loan_service.py` (interest, penalty 3%/2d, schedule, computed status, workflow) ✅
- ❌ `app/tasks/` empty — apscheduler declared but no jobs
- ❌ `app/reports/` empty — report logic lives in router
- ❌ `pdf_service.py` missing · `app/storage/s3_service.py` exists but unused (dev no-op)
- ⚠️ `admin.py` route block duplicated (51–267 vs 270–422)

---

## Business Rules Reference

### Loan Products

| Product | Duration | Interest Rate | Installments | Penalty |
|---------|----------|--------------|-------------|---------|
| **Faraja 4 Weeks** | 28 days | 20% flat on principal | Weekly (4 × installments) | 3% every 2 days on outstanding |
| **Faraja 5 Weeks** | 35 days | 30% flat on principal | Weekly (5 × installments) | 3% every 2 days (up to max amount) |
| **Lumpsum** | Agreed term | TBD | Lump sum at end | TBD |

### Loan Status States
- **Pending** — submitted by Loan Officer, awaiting Manager review
- **Approved** — Manager approved; due date calculated from disbursement date
- **Almost Due** — 2 days before due date (configurable but default = 2)
- **Due** — due date reached, unpaid
- **Arrears** — partial payment made; outstanding > 0; penalty accrues
- **Missed Payment** — weekly installment missed (partial or none)
- **Past Maturity** — loan expired/matured with outstanding balance
- **Defaulter** — Past Maturity AND > 1 month overdue
- **Closed** — fully repaid and verified

### Penalty Rule
- 3% every 2 days on the **total outstanding balance** of all pending loans
- Partial payment → penalty applies on remaining outstanding
- Penalty interval configurable per product by Admin/Manager

### User Invite Flow
```
Director sends invite (Name + Email + Role + Branch)
  → Staff receives Resend email with link
    → Clicks link → sets password
      → Completes profile (phone, ID, photo)
        → Status: PENDING_APPROVAL
          → Director approves → ACTIVE
```

### Payment Confirmation
- **Manual:** Manager or Director verifies payment in system
- **M-Pesa:** Future (Safaricom SDK) — deferred

### Employee Number Format
- `FS-DIR001`, `FS-MGR001`, `FS-LO001`, `FS-ACC001`, `FS-SYS001`, `FS-AUD001`
- Auto-increment suffix per role prefix on creation

---

## PRIORITY 1 — User Onboarding & Invite Flow
> **Status:** `[x]` Invite flow complete (verified live 2026-08-07); remaining: `complete-profile` (deferred), change-password wiring (Settings)

### Backend — ✅ COMPLETE

- [x] `user_invites` table (migration `ac3d7f2d3767`)
- [x] `app/services/email_service.py` — Resend: invite / account-approved / password-reset emails
- [x] `app/services/invite_service.py` — create/validate/accept invite, auto employee numbers
- [x] `POST /admin/users/invite` · `GET /admin/users/invites` · `DELETE /admin/users/invites/{id}`
- [x] `PATCH /admin/users/{id}/approve` · `PATCH /admin/users/{id}/status` · `POST /admin/users/{id}/reset-password`
- [x] `PATCH /auth/change-password`
- [x] `POST /auth/accept-invite` (public, token-based)
- [x] Schemas (`InviteUserRequest`, `AcceptInviteRequest`, `ChangePasswordRequest`, …) in `app/schemas/users.py`
- [x] `RESEND_API_KEY`, `FRONTEND_URL` in config
- [ ] `POST /auth/complete-profile` — ❌ **NOT built** (staff phone/ID/photo completion)

### Frontend

- [x] `app/(auth)/accept-invite/page.tsx` — token read, set password, success w/ employee number
- [ ] `app/(auth)/complete-profile/page.tsx` — ❌ page does not exist
- [x] `app/(dashboard)/users/page.tsx` — ✅ invite modal, pending invites tab, approve/cancel, status badges, activate/deactivate/suspend/reset actions (2026-08-07)
- [x] `features/admin/api.ts` — ✅ invite/fetchInvites/cancelInvite/approveUser/updateUserStatus/resetPassword functions (2026-08-07)
- [x] `features/auth/api.ts` — `acceptInviteApi` added ✅ (2026-08-07); `completeProfileApi`/`changePasswordApi` ❌
- [ ] `app/(dashboard)/settings/page.tsx` — change-password form exists but is a **fake `setTimeout` save**; not wired to `PATCH /auth/change-password`

---

## PRIORITY 2 — Loan Products, Client Registration & Loan Workflow (Real DB)
> **Status:** `[/]` In progress — backend ✅ complete, frontend partial + bugs to fix

### Backend — ✅ COMPLETE (all real DB)

- [x] Enums (`LoanStatus`, `PaymentMode`, `LoanProductType`, `InstallmentStatus`) in `app/models/enums.py`
- [x] `LoanProduct` model + 3 seeded products (Lumpsum rate = TBD placeholder)
- [x] `Client` model (full form: photos, signatures, dependants/next-of-kin/properties JSON, maps links)
- [x] `Loan`, `Installment`, `Repayment` models
- [x] Migration `78fd0153f296` (all P2 tables) + `9c48321056f4` (Text cols) + `a9213f2dd78e` (business_photo)
- [x] `loan_service.py` — interest, weekly schedule, penalty (3%/2d), computed status, approve/reject/disburse/close
- [x] `GET /loan-products` · `GET /clients` · `GET /clients/{id}` · `POST /clients` · `PUT /clients/{id}`
- [x] `GET /loans` · `GET /loans/{id}` (incl. installments + repayments) · `POST /loans` · approve/reject/disburse/close
- [x] `GET /installments/calendar?weeks_ahead=N`
- [x] `branches.py` full CRUD + user assignment (real DB)

### Backend — Bugs to fix

- [ ] **`clients.edit` vs `clients.update`** — PUT /clients always 403s (`loans_clients.py:288`)
- [ ] **`repayments.create` vs `repayments.record`** — POST /repayments always 403s for Loan Officers (`loans_clients.py:681`)
- [ ] **Duplicate `GET /branches`** — unchecked copy in `loans_clients.py:801` shadows `branches.py` version
- [ ] **Duplicate admin route block** — `admin.py:51–267` copied at `270–422`
- [ ] No permission check on `GET /loan-products`, `GET /dashboard/stats`, `GET /notifications` (decision: add or accept)
- [ ] Lumpsum interest rate placeholder (see Decisions Log)

### Frontend

- [x] Clients list + 7-step registration form (photos base64, signature pads, dependants/next-of-kin/properties/guarantor)
- [x] Loans list + creation modal + detail drawer (`GET /loans/{id}`) + approve/reject/disburse/close actions
- [x] Installment schedule calendar page
- [ ] **Client detail drawer uses list-row data** — add `fetchClientApi(id)` in `features/clients/api.ts` + wire `GET /clients/{id}`
- [ ] **Loan creation form** — client free-text input + hardcoded sectors; should use `GET /loan-products` (product dropdown) + client search — ✅ **DONE 2026-08-07** (loans page modal: client select, product select, fee quote/pay/verify, submit blocked until verified fee)
- [ ] **Status badges** — only Pending/Approved/Disbursed/Rejected/Closed + overdue flag; add Almost Due / Due / Arrears / Past Maturity / Defaulter
- [ ] Location fields — Google Maps link input + preview (currently plain text)

---

## PRIORITY 3 — Repayments & Payment Confirmation (Real DB)
> **Status:** `[/]` In progress — core ✅, refinements missing

### Backend
- [x] POST `/repayments` (verified=False) + PATCH `/repayments/{id}/verify` — real DB
- [x] Installment matching on repayment (via `loan_service`)
- [x] Penalty calc on outstanding (3%/2d)
- [ ] `PATCH /admin/loan-products/{id}` — Admin edit of penalty_rate / penalty_interval_days — ❌ not built
- [ ] Partial payment → installment `Late` + loan `Arrears` status logic — verify implemented end-to-end
- [ ] **Bug: `repayments.create` permission check uses non-existent permission** (see Known Bugs)

### Frontend
- [x] Repayments list (All / Pending tabs), record form, verify modal (role-gated)
- [ ] Partial payment warning when repayment < installment due — ❌ missing
- [ ] Installment schedule timeline per loan (which weeks paid/missed/upcoming) in loan detail — ❌ missing (calendar page exists but not per-loan timeline)

---

## PRIORITY 4 — Reports & Financial Summaries (Real DB)
> **Status:** `[/]` In progress — 5 of 6 reports done

### Backend
- [x] `GET /reports/portfolio` — disbursed/outstanding/collected/interest/penalties, by status, by sector (real DB aggregations in `reports.py`)
- [x] `GET /reports/arrears` — overdue list + penalty exposure
- [x] `GET /reports/collections?date_from=&date_to=` — by mode, per loan
- [x] `GET /reports/clients` — by branch, by sector
- [x] `GET /reports/summary`
- [ ] **Financial report (month/year per branch: active clients, disbursed, repayments, profit/loss, write-offs)** — ❌ not built
- [ ] Report logic sits in router (`app/reports/` empty) — optional refactor

### Frontend
- [x] Reports page — Portfolio / Arrears / Collections tabs, KPIs, charts, tables
- [ ] Branch filter dropdown (Director = all; Manager = own branch) — ❌ missing (BranchSelector exists but no page reads it)
- [ ] Month/year picker for financial report — ❌ missing (date-range inputs only)
- [ ] Financial summary card: profit, losses, disbursed, collected — ❌ missing
- [ ] Export buttons — ❌ missing

---

## PRIORITY 5 — Notifications (In-App + Email via Resend)
> **Status:** `[/]` In progress — in-app ✅, email jobs ❌

### In-App
- [x] `GET /notifications` — real DB queries (today/tomorrow dues, arrears, unverified repayments, pending approvals, overdue)
- [x] Frontend polling every 30s + mark-read UI
- [x] Notification read-state persisted — ✅ **DONE 2026-08-07**: `notification_reads` table + `PATCH /notifications/{id}/read`; frontend reads/writes server state

### Email Notifications (Resend)
- [x] `email_service.py` — invite / account-approved / password-reset templates
- [ ] Loan approved → submitting LO · Loan disbursed → submitting LO
- [ ] Due reminder T-2 → Manager · Due today → Manager · Arrears alert → Manager + Director · Past maturity/defaulter → Director
- [ ] `app/tasks/` APScheduler daily job — scan active loans, trigger due/arrears alerts, penalty snapshot — ❌ empty (apscheduler in requirements but unused)

---

## PRIORITY 6 — PDF Form & Electronic Signature
> **Status:** `[ ]` Not started — depends on P2

### Backend
- [ ] `app/services/pdf_service.py` — ReportLab installed but never used
- [ ] `GET /clients/{id}/pdf` — PDF download
- [ ] Signature flow — frontend already captures base64 signatures in client registration; S3 upload via `s3_service.py` exists but unused (dev no-op); decide: store base64 in DB (current) vs S3

### Frontend
- [x] Signature pads (react-signature-canvas) — applicant + guarantor, in client registration
- [x] Photo uploads (4: applicant/guarantor × ID/passport) — base64 to DB
- [ ] **"Download Form PDF"** button on client detail — ❌ missing

---

## PRIORITY 7 — Dashboard Rebuild (Real Data, No Placeholders)
> **Status:** `[x]` A+B implemented 2026-08-07 — backend `/dashboard/stats` extended (guard + monthly series + portfolio quality + MoM changes + recent activity, verified via TestClient with real data) and the dashboard page fully rewired to real data (no fallbacks, no demo chart/feed). C (audit trail) still open.

### P7-A — Kill placeholder data (high priority — doing first)
- [x] Wire existing `GET /dashboard/stats` via new `fetchDashboardStatsApi()` — cards: Active Portfolio, Active Clients, Disbursed (Month), Repayments (Month)
- [x] Remove ALL fake fallbacks + `extraRepayments` demo state + hardcoded MoM % (show real counts/amounts; MoM only where computed)
- [x] Replace fake chart with real 6-month series (disbursed vs verified repayments)
- [x] Replace fake activity feed with real recent events (repayments / loans / clients / fees)
- [x] Loan table: `loan_number` instead of `id`, `formatKES`, `formatDate`
- [x] Branch chip: add branch names to `/auth/me`; delete the fake branch fallback
- [x] Remove inline quick modals (incomplete duplicates of the real pages; loan modal also fails without a verified application fee) — Quick Actions navigate to `/loans`, `/clients`, `/repayments`, `/reports`

### P7-B — Real stats & trends backend (high priority — after A)
- [x] Extend `/dashboard/stats` (missing `dashboard.view` guard — flagged in Cross-Cutting): 6-month monthly series (disbursed, verified repayments, fee income), portfolio quality (arrears count + amount, overdue count, unverified repayments), MoM deltas for the 4 stat cards, recent-activity feed (latest 8 events across repayments/loans/clients/fees)
- [x] Frontend consumes the extended endpoint — no client-side math over list data

### P7-C — Real audit trail (deferred — the honest long-term feed for "Recent Activities")
- [ ] `audit_logs` table (`actor`, `action`, `entity`, `entity_id`, `meta`, `created_at`) + event writes on loan approve/disburse/close, repayment record/verify, fee record/verify, client create
- [ ] `GET /audit-logs` (guarded by `audit.view`) + **Audit Logs page** — replaces the dead "View Full Audit Logs" button

---

## Cross-Cutting Concerns

| Item | Phase | Status |
|------|-------|--------|
| Role/permission guards on ALL API routes | P2 | `[x]` Most routes guarded — ⚠️ gaps: `GET /loan-products`, `GET /dashboard/stats`, `GET /notifications`, dup `GET /branches` |
| Permission name mismatches (`clients.edit`, `repayments.create`) | P2 | `[ ]` 🔴 BREAKS workflows — fix first |
| Branch scoping (LO/Manager see only own branch) | P2 | `[ ]` ⚠️ Verify implementation in queries |
| `GET /clients/{id}` endpoint | P2 | `[x]` Backend ✅ — frontend drawer still uses list data |
| Auto-increment employee numbers per role prefix | P1 | `[x]` `invite_service._next_employee_number()` |
| JWT token refresh / session expiry handling | P1 | `[x]` Cookie 7d, 401 → redirect `/login?expired=true` |
| S3 photo uploads wired to client form | P2/P6 | `[x]` Stored as base64 in DB (dev). S3 service exists, unused — decide storage strategy |
| Settings — change password wired to real API | P1 | `[ ]` Still a fake `setTimeout` save |
| Seed script updated for new models (loan_products, demo clients/loans) | P2 | `[x]` 3 products seeded; demo clients/loans — ⚠️ verify |
| `repayments.verify` permission | P2 | `[x]` Confirmed — verify uses `repayments.verify` |
| Duplicated admin route block (`admin.py:51–267` vs `270–422`) | P1 | `[ ]` Cleanup |
| `.env` committed with real keys | Security | `[x]` Decision reversed 2026-08-07: purged from history + gitignored (push protection); rotate Resend key + `SECRET_KEY` |
| Backend root `main.py` stub + unregistered `/health` router | — | `[ ]` Cleanup |
| Tests | — | `[ ]` No test dirs anywhere (backend or frontend) |

---

## Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Lumpsum product — interest rate, duration, penalty structure? | ⏳ Pending |
| 2 | Manager exact permissions | ✅ Confirmed (in seed.py — all except settings.manage, users.delete, roles.manage, loans.writeoff) |
| 3 | Loan Officer exact permissions | ✅ Confirmed (in seed.py) |
| 4 | Almost Due threshold | ✅ **2 days before due date** |
| 5 | Email provider | ✅ **Resend** |
| 6 | M-Pesa integration | ✅ **Deferred — future scope** |
| 7 | Installment schedule | ✅ **Weekly installments** |
| 8 | Defaulter definition | ✅ Past maturity > 1 month |
| 9 | Location storage | ✅ **Google Maps link** |
| 10 | Company section in client form | ⏳ Pending |
| 11 | `repayments.verify` added (replacing `repayments.reverse` for verification); reversals deferred | ✅ Confirmed |
| 12 | Finance Officer permissions stay as-is; can be adjusted via UI later | ✅ Confirmed |
| 13 | Equal weekly installments: total_repayable / num_weeks | ✅ Confirmed |
