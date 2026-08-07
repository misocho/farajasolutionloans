# AGENTS.md — Faraja Backend (FastAPI)

Backend of the Faraja Solution Loans microfinance system. Read the root `../AGENTS.md` for role, money/locale rules, and project-wide conventions — this file adds the **FastAPI architecture and coding standards**, which are the priority here.

## Stack & commands

| Item | Standard |
|---|---|
| Runtime | Python ≥ 3.14 · FastAPI 0.139 · SQLAlchemy 2.0 (Mapped/mapped_column) · PostgreSQL (psycopg3) · Alembic |
| Packaging | `uv` (pyproject.toml + uv.lock are the source of truth; requirements.txt mirrors them) |
| Lint | `uv run ruff check .` — line-length 100, double quotes, section-divider comments (`# ── Section ──`) |
| Format | `uv run ruff format .` |
| Types | `uv run mypy app` (strict) |
| Dev server | `uv run uvicorn app.main:app --reload` (real entry is `app/main.py`, NOT `backend/main.py`) |
| Migrations | `uv run alembic upgrade head` — revisions are immutable once applied; new changes = new revision |

**No test suite exists — do not create tests unless explicitly asked.**

## Skills & MCPs

- Load the `fastapi` skill (`.opencode/skills/frameworks/fastapi`) at the start of backend work — it encodes the Pydantic v2, route-structure, DI, and logging conventions this repo follows.
- Use the `context7` MCP for live FastAPI/Pydantic/SQLAlchemy docs whenever unsure about a version-specific API (signatures, deprecations, behavior). Don't guess from memory.

## Architecture — where logic lives

- `app/api/routers/` — endpoints ONLY. Thin: parse request → call service → return schema. No business logic.
- `app/services/` — business logic (see `loan_service.py`, `invite_service.py`, `auth_service.py`).
- `app/core/` — config, security, canonical `PERMISSIONS`, `get_user_permissions()`.
- `app/schemas/` — Pydantic v2 request/response models (from_attributes for ORM responses).
- `app/models/` — SQLAlchemy 2.0 models, UUID PKs via `BaseModel`.
- `app/repositories/` — data access (`auth_repository.py` is the pattern).

## FastAPI standards (non-negotiable)

1. **Dependency injection, not globals.** Every endpoint declares `db: Session = Depends(get_db)` and `current_user: User = Depends(get_current_user)` — pass them explicitly to helpers. Never reach for globals or module singletons for per-request state.
2. **Auth + permission pattern (canonical).** Every endpoint: `current_user=Depends(get_current_user)` then `_require_permission(db, current_user, "perm.name")` — the signature is `(db, user, perm)`.
   - Permission names MUST come from the canonical list in `app/core/permissions.py` (a typo silently 403s everyone — historical bugs: `clients.edit`, `repayments.create`).
   - Resolve permissions ONLY via `get_user_permissions(db, user)` in `app/core/permissions.py`. **NEVER** access `ur.role.permissions` — the `Role` model has NO `permissions` relationship; that raised `AttributeError` 500s across notifications/loans/reports/branches (fixed 2026-08-07). `RolePermission` is the join table.
   - Director/System Admin gates (admin.py) use role-name checks (`check_is_director` accepts **"Director" OR "System Admin"** since 2026-08-07 — System Admin was silently 403-locked out of the console while the frontend admitted them) — keep the two patterns separate: permission-based for features, role-based only for admin console.
3. **Pydantic v2 for every request/response.** `response_model=` on `@router` decorators; schemas in `app/schemas/`, never inline dicts in routers. `ConfigDict(from_attributes=True)` for ORM-backed responses. Enums serialize via `.value`.
4. **HTTPException with the right status code.** 400 for bad input/invariants, 401 auth, 403 permission, 404 not found, 409/400 for state conflicts. In `except ValueError` re-raises use `raise ... from exc` (ruff B904).
5. **Routers stay thin; services own the rules.** Loan approval/disbursement/close, penalty math, installment generation → `app/services/loan_service.py`. New money-moving endpoints → service + idempotency (unique constraint/check-before-insert, see root AGENTS.md).
6. **No `Depends()` in default expressions?** — `Depends(get_db)` in endpoint signatures is the FastAPI idiom and fine; do NOT "fix" B008-style lint noise in working code (pre-existing debt, leave unless the file is already being rewritten).
7. **Money & time.** Decimal + `Numeric(18, 2)` everywhere; round only at display. `datetime.now(UTC)`; Kenya tz from `settings.DEFAULT_TIMEZONE` for display. Never log KYC data (national IDs, KRA PINs, photos, signatures).
8. **Keep changes minimal.** Never rewrite working code or "improve" style while fixing a bug. Fix only what your change touches; the repo has pre-existing lint debt (B008/UP017/E501) — leave it unless explicitly tasked.
9. **Verify before finishing:** `uv run ruff check .` on touched files + exercise the endpoint with a real token (login as a seeded user, hit the route, expect 2xx) — a 500 in a stack trace means a bug, not a lint problem.

## Boundaries

- `backend/.env` holds live keys and is **gitignored** — never commit it (GitHub push protection blocks pushes containing the Resend key; earlier "committed by design" decision reversed 2026-08-07), never log secrets, rotate if leaked, placeholders only in `.env.example`.
- `uv.lock` / `pyproject.toml` — no dependency changes without approval.
- `alembic/versions/*` — immutable once applied; new revisions only.
- Seeded data definitions (`app/core/branches.py`, `app/core/permissions.py`, `app/db/seed.py`, `app/db/seed_data.py`) — never rewrite without flagging that reseeding is needed.
- **Database resets are forbidden.** The staging DB was reset exactly once (2026-08-07, see root `../AGENTS.md`) to rebuild the seed for the current schema. All subsequent changes ship as Alembic revisions only. `python -m app.db.seed` is idempotent and may be re-run freely.
- `PLAN.md` status sections — update only as part of a plan-update task.
- No `git commit`/`git push` unless explicitly asked.

---
*Keep this file updated: when architecture, permissions, or standards change, update the matching section here and in root `../AGENTS.md`.*
