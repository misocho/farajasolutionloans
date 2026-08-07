# Verification Recipe — Faraja Solution Loans

Canonical local verification for every task. Run the same matrix so results are comparable across sessions.

## Fast gate (before finishing any task)

```bash
./scripts/verify.sh          # backend ruff + frontend build + frontend lint
./scripts/verify.sh backend  # ruff only
./scripts/verify.sh frontend # build + lint only
```

Expectation: `pnpm build` MUST pass. `ruff check` and `pnpm lint` will report **pre-existing debt** (ruff B008/UP045/E501; eslint ~50 issues in accept-invite, layout, users, sidebar, admin/api.ts, login-form, clients page `as any`). Only fail if the output includes errors in files/lines you touched.

## Dev servers (keep running across tasks)

```bash
# Terminal 1 — backend against local docker Postgres (faraja / postgres:postgres@localhost:5432)
cd backend && uv run uvicorn app.main:app --port 8001 --reload

# Terminal 2 — frontend
cd frontend && pnpm dev   # :3000 (points at localhost:8001 via .env.local)
```

## Local database

- Docker Postgres: `postgresql://postgres:postgres@localhost:5432/faraja`
- Seed is idempotent and safe to re-run: `cd backend && python -m app.db.seed`
  (adds 11 branches, 3 loan products, roles, demo users, 9 clients, 8 loans covering every state, fee payments — **local only**; staging DB is migrations-only, never reseed)
- Cleanup test rows: `PGPASSWORD=postgres psql -h localhost -U postgres -d faraja -c "DELETE FROM clients WHERE phone = '<test-phone>';"`

## Seed users (password: `Faraja@2026` unless noted)

| Employee no. | Role | Branch scope |
|---|---|---|
| FS-DIR001 | Director | All (unrestricted) |
| FS-SYS001 | System Admin | All |
| FS-AUD001 | Auditor | All |
| FS-MGR001 | Manager | Mombasa |
| FS-MGR002 | Manager | Kilifi |
| FS-LO001 | Loan Officer | Mombasa |
| FS-LO002 | Loan Officer | Kilifi |
| FS-ACC001 | Finance Officer | Mombasa |

## Branch UUIDs (local dev)

| Branch | UUID |
|---|---|
| Head Office - Miritini | `33cb87bb-db6a-4666-bff1-cf2ff2e5975c` |
| Kilifi | `6a1b1023-0b39-4c0c-9102-572dfe84d177` |
| Mombasa | `d5811a12-c73a-4339-b260-7ebc3a2b3405` |

## Auth

```bash
BASE=http://localhost:8001/api/v1
TOK_MGR=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"employee_number":"FS-MGR001","password":"Faraja@2026"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
# Same pattern for FS-DIR001 / FS-LO001 / FS-ACC001
```

## Endpoint → expected status matrix

| Endpoint | Token | Expect |
|---|---|---|
| `GET /branches` | MGR | 200, only Mombasa |
| `GET /branches` | DIR | 200, all 11 |
| `GET /branches/{kilifi}` | MGR | 403 |
| `GET /clients` | MGR | 200, Mombasa clients only |
| `GET /clients?branch_id={kilifi}` | MGR | 403 |
| `GET /clients/{id}` (other branch) | MGR | 403 |
| `GET /clients/{id}` (own branch) | MGR | 200 |
| `POST /clients` (scoped, foreign `branch_id`) | MGR | 403 |
| `POST /clients` (scoped, no `branch_id`) | MGR | 201, branch auto = own |
| `POST /clients` (unrestricted, no `branch_id`) | DIR | 400 |
| `POST /clients` (unrestricted, bogus UUID) | DIR | 400 |
| `POST /clients` (unrestricted, valid branch) | DIR | 201 |
| `POST /loans` (client outside scope) | MGR | 403 |
| `POST /loans` (no verified application fee) | LO | 400 |
| `GET /dashboard/stats?branch_id={kilifi}` | MGR | 403 |
| `GET /dashboard/stats` | MGR | 200, Mombasa figures only |
| `GET /search?q={name}` | MGR | 200, own branch only |
| Any endpoint, no/invalid token | — | 401 |
| Any permission-less endpoint | ACC | 403 |
| `GET /auth/me` | MGR | 200, `branch_ids` = [Mombasa], `permissions` populated |
| `GET /admin/users` | SYS | 200 (U1: SysAdmin admitted; LO → 403) |
| `GET /admin/users/{id}` | DIR/SYS | 200, detail + full `permissions` list |
| `GET /admin/users/{id}` | LO | 403 |
| `GET /admin/users/{bogus-uuid}` | DIR | 404 |
| `PUT /admin/roles/{id}/permissions` | DIR | 200, `/auth/me` of affected user reflects change instantly |

## Money workflow smoke (full loan lifecycle)

1. `POST /clients` (LO, own branch) → 201, grab `id`
2. `POST /fees` (record application fee) → verify as ACC/DIR (`POST /fees/{id}/verify`)
3. `POST /loans` (fee verified) → 201 Pending → `PATCH /loans/{id}/approve` (MGR) → `PATCH /loans/{id}/disburse` (DIR) → installments generated
4. `POST /repayments` (LO, cash) → unverified → `PATCH /repayments/{id}/verify` (MGR) → outstanding drops

## Staging (Render)

- API: `https://farajasolutionloans.onrender.com/api/v1` — same matrix, seed users work
- Push to `main` auto-deploys; confirm after each roadmap commit before moving on
