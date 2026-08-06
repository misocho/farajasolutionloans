# Faraja Solution Loans — Master Implementation Plan

> **Last updated:** 2026-08-06
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
| Lumpsum product rates | Pending |
| Defaulter definition | Past maturity > 1 month ✅ |

---

## Existing Infrastructure (Already Done — DO NOT redo)

| What | Where | Notes |
|------|-------|-------|
| Auth — login (employee_number + password), JWT, `/auth/me` | `backend/app/api/routers/auth.py` | ✅ Real DB |
| Admin — list users, roles, permissions CRUD, update user roles, update role permissions | `backend/app/api/routers/admin.py` | ✅ Real DB, Director-only |
| Users admin page (directory + permissions matrix) | `frontend/app/(dashboard)/users/page.tsx` | ✅ Built |
| 6 Roles seeded: Director, Manager, Loan Officer, Finance Officer, System Admin, Auditor | `backend/app/db/seed_data.py` | ✅ In DB |
| 53 Permissions seeded across all modules | `backend/app/core/permissions.py` | ✅ In DB |
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
| **Loan Officer** | dashboard.view, clients.view/create/update, loans.view/create, repayments.view/record |
| **Finance Officer** | dashboard.view, repayments.view/record, expenses.view/create/approve, reports.view/export |
| **System Admin** | dashboard.view, users CRUD, roles.view/manage, branches.view/manage, audit.view |
| **Auditor** | dashboard.view, clients.view, loans.view, repayments.view, reports.view, audit.view |

---

## Architecture Snapshot — Current State

| Area | Backend | Frontend | DB-backed? |
|------|---------|----------|------------|
| Auth (login, JWT, /me) | ✅ | ✅ | ✅ Real DB |
| Admin — users/roles/permissions CRUD | ✅ | ✅ | ✅ Real DB |
| **User invite/onboarding flow** | ❌ | ❌ | — |
| Loan products (Faraja 4wk, 5wk, Lumpsum) | ⚠️ Mock | ⚠️ Partial | ❌ |
| Client registration (full form with photos, signatures) | ⚠️ Mock | ✅ Form built | ❌ |
| Loan workflow (pending→approved→disbursed) | ⚠️ Mock | ✅ Built | ❌ |
| Weekly installment schedule | ❌ | ❌ | ❌ |
| Repayments & penalty calc | ⚠️ Mock | ✅ Built | ❌ |
| Branches | ⚠️ Mock | ✅ Built | ⚠️ Branch model exists, router still mocked |
| Reports (portfolio, arrears, collections, financial) | ⚠️ Mock | ✅ Built | ❌ |
| Notifications (in-app) | ⚠️ Mock | ✅ Built | ❌ |
| Email notifications (Resend) | ❌ | ❌ | — |
| PDF form generation + e-signature | ❌ | ❌ | — |
| M-Pesa | ⏳ Future | — | — |

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
> **Status:** `[ ]` Not started

### Backend

#### [ ] New DB table: `user_invites`
- Fields: `id`, `email`, `first_name`, `last_name`, `token` (UUID), `role_name`, `branch_id`, `invited_by_id`, `status` (pending/accepted/expired), `expires_at`, `created_at`
- Alembic migration: `add_user_invites_table`

#### [ ] `app/services/email_service.py` — Resend integration
- Configure Resend API key from `settings`
- `send_invite_email(to_email, invite_link, invited_by_name)`
- `send_password_reset_email(to_email, reset_link)`
- `send_account_approved_email(to_email, user_name)`

#### [ ] `app/services/invite_service.py`
- `create_invite(db, email, first_name, last_name, role_name, branch_id, invited_by_id)` → generate token, store, send email
- `validate_token(db, token)` → return invite or raise expired/used error
- `accept_invite(db, token, password)` → create User (status=PENDING_APPROVAL), mark invite accepted

#### [ ] New API endpoints in `admin.py`:
- `POST /admin/users/invite` — Director sends invite
- `GET /admin/users/invites` — list all invites with status
- `DELETE /admin/users/invites/{id}` — cancel/revoke an invite
- `PATCH /admin/users/{id}/approve` — Director approves PENDING_APPROVAL → ACTIVE
- `PATCH /admin/users/{id}/status` — activate / deactivate / suspend
- `POST /admin/users/{id}/reset-password` — Director triggers reset email
- `PATCH /auth/change-password` — authenticated user changes own password

#### [ ] New public auth endpoints in `auth.py`:
- `POST /auth/accept-invite` — validate token, set password, create user
- `POST /auth/complete-profile` — staff completes phone, ID, photo (after accepting invite)

#### [ ] `app/schemas/users.py` — Add:
- `InviteUserRequest`, `UserInviteResponse`, `AcceptInviteRequest`, `CompleteProfileRequest`, `UpdateUserStatusRequest`, `ChangePasswordRequest`

#### [ ] `app/core/config.py` — Add:
- `RESEND_API_KEY`, `FRONTEND_URL`

### Frontend

#### [ ] `app/(auth)/accept-invite/page.tsx`
- Read `?token=...` from URL
- Show form: set password + confirm password
- On submit → `POST /auth/accept-invite` → redirect to `/auth/complete-profile?token=...`

#### [ ] `app/(auth)/complete-profile/page.tsx`
- Form: phone number, national ID, profile photo upload
- On submit → `PATCH /auth/complete-profile` → redirect to login with "Account pending approval" message

#### [ ] `app/(dashboard)/users/page.tsx` — Add:
- **"Invite User"** button → modal (name, email, role dropdown, branch dropdown)
- **"Pending Invites"** tab — list invites with: email, role, status badge, sent date, cancel button
- **"Approve Account"** action on users with PENDING_APPROVAL status
- **Status badge** per user (Active / Locked / Suspended / Pending Approval)
- **User actions dropdown:** Activate / Deactivate / Suspend / Reset Password

#### [ ] `features/admin/api.ts` — Add:
- `inviteUserApi()`, `fetchInvitesApi()`, `cancelInviteApi()`, `approveUserApi()`, `updateUserStatusApi()`, `resetPasswordApi()`

#### [ ] `features/auth/api.ts` — Add:
- `acceptInviteApi()`, `completeProfileApi()`, `changePasswordApi()`

#### [ ] `app/(dashboard)/settings/page.tsx`
- Wire "Change Password" form to `PATCH /auth/change-password` (currently a no-op)

---

## PRIORITY 2 — Loan Products, Client Registration & Loan Workflow (Real DB)
> **Status:** `[ ]` Not started

### Backend — New Models

#### [ ] `app/models/enums.py` — Add:
- `LoanStatus`: Pending, Approved, Disbursed, Rejected, Closed
- `PaymentMode`: Cash, MPesa, BankTransfer, Cheque, Other
- `LoanProductType`: Faraja4Weeks, Faraja5Weeks, Lumpsum

#### [ ] `app/models/loan_product.py`
- `id`, `name`, `product_type` (enum), `duration_days`, `interest_rate` (Decimal), `penalty_rate` (Decimal, default 0.03), `penalty_interval_days` (int, default 2), `max_penalty_amount` (Decimal, nullable), `is_active` (bool)

#### [ ] `app/models/client.py`
- Personal: `name`, `phone`, `email`, `id_no`, `pin`, `gender`, `marital_status`, `occupation`, `address`, `period_years`, `accommodation`, `landmark`
- Location: `residential_maps_link` (Google Maps URL), `business_maps_link` (Google Maps URL)
- Spouse: `spouse_name`, `spouse_id`, `spouse_phone`, `spouse_occupation`, `spouse_address`
- Dependants (JSON): `applicant_dependants`, `spouse_dependants`, `dependants_count`, `dependants_ages`, `school_going_count`, `school_details`
- Next of kin (JSON): `next_of_kin_list`
- Business: `business_name`, `business_type`, `business_sector_custom`, `business_landmark`, `business_years`, `business_location`
- Guarantor: `guarantor_surname`, `guarantor_first_name`, `guarantor_middle_name`, `guarantor_id_no`, `guarantor_phone`, `guarantor_relationship`, `guarantor_address`, `guarantor_occupation`, `guarantor_period_known`
- Properties (JSON): `properties_list`
- Photos (S3 URLs): `applicant_id_photo`, `applicant_passport_photo`, `guarantor_id_photo`, `guarantor_passport_photo`
- Signatures (S3 URLs): `applicant_signature`, `guarantor_signature`
- Fees: `registration_fee`, `application_fee`
- FK: `branch_id`, `registered_by_id` (FK User)
- `date_registered`, `client_number` (auto: `CL-YYYY-NNN`)

#### [ ] `app/models/loan.py`
- `id`, `loan_number` (auto: `LN-YYYY-NNN`)
- FK: `client_id`, `branch_id`, `loan_product_id`
- `amount`, `interest_amount` (computed at disbursement), `total_repayable`, `application_fee`
- `duration_days`, `installment_amount` (total_repayable / num_weeks)
- `status` (LoanStatus enum)
- FK: `submitted_by_id`, `approved_by_id`, `disbursed_by_id`
- `approval_note`, `rejection_reason`, `notes`
- `date_submitted`, `date_approved`, `disbursed_date`, `due_date`

#### [ ] `app/models/installment.py`
- `id`, FK `loan_id`, `due_date`, `amount`, `status` (Pending/Paid/Missed/Late)
- Auto-generated on disbursement (weekly schedule)

#### [ ] `app/models/repayment.py`
- `id`, FK `loan_id`, FK `client_id`
- `amount`, `date`, `mode` (PaymentMode enum)
- `reference`, FK `recorded_by_id`
- `verified` (bool), FK `verified_by_id`, `verified_at`

### Backend — Migrations
#### [ ] `alembic revision -m "add_loan_products_table"` + seed 3 products
#### [ ] `alembic revision -m "add_clients_table"`
#### [ ] `alembic revision -m "add_loans_table"`
#### [ ] `alembic revision -m "add_installments_table"`
#### [ ] `alembic revision -m "add_repayments_table"`

### Backend — Repositories
#### [ ] `app/repositories/client_repo.py` — get, list (branch-scoped), create, update, search
#### [ ] `app/repositories/loan_repo.py` — get, list (branch-scoped + status filter), create, update status
#### [ ] `app/repositories/installment_repo.py` — generate schedule, get by loan, mark paid/missed
#### [ ] `app/repositories/repayment_repo.py` — create, list, sum by loan, mark verified

### Backend — Services
#### [ ] `app/services/loan_service.py`
- `calculate_interest(product, amount)` — product-specific flat rate
- `generate_installment_schedule(loan, disbursed_date)` — weekly dates + amounts
- `calculate_penalty(outstanding, due_date, rate, interval_days)` — configurable
- `get_loan_computed_status(loan)` — Almost Due / Due / Arrears / Past Maturity / Defaulter / Missed Payment
- `approve_loan(db, loan_id, officer)`, `reject_loan(...)`, `disburse_loan(...)`, `close_loan(...)`

#### [ ] `app/services/client_service.py`
- `register_client(db, data, branch_id, registered_by)` — auto-generate client_number
- `get_client_with_loans(db, client_id)`

### Backend — Router Replacements
#### [ ] `app/api/routers/loans_clients.py` — **Replace all `MOCK_*` with real DB**
- Add `GET /loan-products` (list active products)
- Add `GET /clients/{id}` (currently missing)
- All routes: add `Depends(get_current_user)` + role/permission guard
- Branch scoping:
  - Loan Officer → sees only own branch
  - Manager → sees only own branch
  - Director / Auditor / Finance Officer → sees all branches (with optional `?branch_id=` filter)
- Role enforcement:
  - `POST /loans` → requires `loans.create` permission (Loan Officer)
  - `PATCH /loans/{id}/approve` → requires `loans.approve` (Manager / Director)
  - `PATCH /loans/{id}/disburse` → requires `loans.disburse` (Director only)
  - `PATCH /loans/{id}/close` → requires `loans.update` (Manager / Director)
  - `POST /repayments` → requires `repayments.record` (Loan Officer / Finance Officer)
  - `PATCH /repayments/{id}/verify` → requires `repayments.reverse` (Manager / Director)

#### [ ] `app/api/routers/branches.py` — Wire to real Branch DB model
- Replace `MOCK_BRANCHES` with SQLAlchemy queries against Branch model
- Compute branch stats from real loan/client joins

### Frontend — Updates
#### [ ] `features/clients/api.ts` — Add:
- `fetchLoanProductsApi()`, `fetchClientApi(id)`, `fetchInstallmentsApi(loan_id)`

#### [ ] Loan creation form — populate product dropdown from `GET /loan-products`
#### [ ] Loan list — display extended status badge (Almost Due / Due / Arrears / Past Maturity / Defaulter)
#### [ ] Client detail page — call `GET /clients/{id}` (currently no backend endpoint)
#### [ ] Location fields — replace text input with Google Maps link input + preview link

---

## PRIORITY 3 — Repayments & Payment Confirmation (Real DB)
> **Status:** `[ ]` Not started — depends on P2

### Backend
#### [ ] Partial payment detection in `loan_service.py`
- If repayment < installment due → flag installment as `Late`, loan status → `Arrears`
- Penalty accrues on outstanding balance every 2 days

#### [ ] Installment matching logic
- On new repayment, match against earliest unpaid installment
- Mark installment Paid / Partial / Missed accordingly

#### [ ] `PATCH /repayments/{id}/verify` — wire to real DB
- Permission check: `repayments.reverse` (Manager / Director)

#### [ ] `PATCH /admin/loan-products/{id}` — allow Admin to edit penalty_rate, penalty_interval_days

### Frontend
#### [ ] Repayments page — verify with real DB data post-P2
#### [ ] Show "Partial Payment" warning when repayment < installment due
#### [ ] Show installment schedule timeline per loan (which weeks paid / missed / upcoming)

---

## PRIORITY 4 — Reports & Financial Summaries (Real DB)
> **Status:** `[ ]` Not started — depends on P2

### Backend
#### [ ] `app/reports/loan_report.py`
- Portfolio: total disbursed, outstanding, collected, interest earned, penalties accrued
- By status count; by sector breakdown; overdue/arrears list with penalty exposure

#### [ ] `app/reports/collection_report.py`
- By date range, by payment mode; missed payments log

#### [ ] `app/reports/client_report.py`
- Total by branch, by sector; new registrations per month

#### [ ] `app/reports/financial_report.py` ← NEW
- Monthly per branch: active clients, loans disbursed (count + amount), repayments received, profit (interest collected), losses (write-offs / past maturity)
- Org-wide summary (all branches combined)

#### [ ] Report route replacements:
- `GET /reports/portfolio?branch_id=&date_from=&date_to=`
- `GET /reports/arrears?branch_id=`
- `GET /reports/collections?branch_id=&date_from=&date_to=`
- `GET /reports/clients?branch_id=`
- `GET /reports/financial?branch_id=&month=&year=` ← NEW

### Frontend
#### [ ] `app/(dashboard)/reports/page.tsx` — Add:
- Branch filter dropdown (Director = all; Manager = own branch only)
- Month/year picker for financial report
- Financial summary card: profit, losses, disbursed amount, total collected

---

## PRIORITY 5 — Notifications (In-App + Email via Resend)
> **Status:** `[ ]` Not started — depends on P2

### In-App (real DB)
#### [ ] `GET /notifications` — replace mock with real DB queries:
- **Today's dues** — loans/installments due today
- **Tomorrow's dues** — due tomorrow
- **Day after tomorrow** — "Kesho kutwa"
- **Arrears** — outstanding balance + penalty accruing
- **Missed payments** — installment not received
- **Pending approvals** — awaiting Manager
- **Awaiting disbursement** — awaiting Director
- **Unverified repayments** — awaiting Manager/Director
- **Overdue / Past Maturity / Defaulters**

#### [ ] Frontend polling
- `components/layout/notifications.tsx` — `refetchInterval: 5 * 60 * 1000` (every 5 min)

### Email Notifications (Resend)
#### [ ] `app/services/email_service.py` — Templates:
- Invite email (already in P1)
- Loan approved — to submitting LO
- Loan disbursed — to submitting LO
- **Due reminder T-2** — to Manager (almost due)
- **Due today** — to Manager
- **Arrears alert** — to Manager + Director
- **Past maturity / defaulter** — to Director

#### [ ] `app/tasks/` — Background daily job (APScheduler):
- Scan all active loans → trigger due/arrears email alerts
- Penalty recalculation snapshot every 2 days

---

## PRIORITY 6 — PDF Form & Electronic Signature
> **Status:** `[ ]` Not started — depends on P2

### Backend
#### [ ] `app/services/pdf_service.py`
- Generate PDF from client registration data (WeasyPrint or ReportLab)
- Sections: personal details, next of kin, guarantor, dependants, properties
- Append applicant + guarantor signature images at end
- Embed passport photos and ID photos

#### [ ] `GET /clients/{id}/pdf` — return PDF as file download / S3 signed URL

#### [ ] Signature flow:
- Frontend captures signature as base64 PNG
- Upload to S3 via `app/storage/s3_service.py` (already exists)
- Store S3 URL in client record

### Frontend
#### [ ] Client registration form — Add:
- Signature pad component (`react-signature-canvas`) for applicant and guarantor
- Upload fields: applicant ID photo, passport photo, guarantor ID photo, passport photo

#### [ ] Client detail page — Add:
- **"Download Form PDF"** button → `GET /clients/{id}/pdf`

---

## Cross-Cutting Concerns

| Item | Phase | Status |
|------|-------|--------|
| Role/permission guards on ALL API routes | P2 | `[ ]` |
| Branch scoping (LO/Manager see only own branch) | P2 | `[ ]` |
| `GET /clients/{id}` endpoint (currently missing) | P2 | `[ ]` |
| Auto-increment employee numbers per role prefix | P1 | `[ ]` |
| JWT token refresh / session expiry handling | P1 | `[ ]` |
| S3 photo uploads wired to client form | P2/P6 | `[ ]` |
| Settings — change password wired to real API | P1 | `[ ]` |
| Seed script updated for new models (loan_products, demo clients/loans) | P2 | `[ ]` |
| `repayments.reverse` permission — clarify if this is the "verify" permission | P2 | ⚠️ Check |

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
