# Deploying Faraja Solution Loans to DigitalOcean

Two supported targets, same repo artifacts (Dockerfiles in `backend/` and
`frontend/`, `.do/app.yaml` for App Platform, `docker/nginx.conf` +
`docker-compose.yml` for a Droplet).

> The backend requires **Python ≥ 3.14** and the frontend is **Next.js 16 + pnpm** —
> DO buildpacks cannot build either, so **both paths use the Dockerfiles**.

---

## Option A — App Platform (managed PaaS, recommended)

### 1. Prerequisites

- Repo pushed to GitHub (`git push origin main`).
- `doctl` (optional; the dashboard works too): `doctl auth init`.

### 2. Create the app

Edit `.do/app.yaml` first:

- `YOUR_GITHUB_USERNAME/farajasolutionloans` → your actual repo (both services).
- `NEXT_PUBLIC_API_URL` placeholder → will fix after first deploy (build-time
  vars can't reference the app's own URL).

Then either import the repo in the dashboard (Apps → Create App → GitHub,
settings will be taken from `.do/app.yaml` automatically), or:

```bash
doctl apps create --spec .do/app.yaml
```

This provisions:

| Component | What it is |
|---|---|
| `backend` service | FastAPI on :8000, migrations auto-run at boot (`alembic upgrade head`), health check on `/` |
| `frontend` service | Next.js standalone on :3000 |
| `db` database | Managed PostgreSQL 16 (free trial cluster; upgrade to production later) |

### 3. Set real secrets

In the app dashboard → component env vars (or `doctl apps update`):

| Key | Where | Value |
|---|---|---|
| `SECRET_KEY` | backend | Long random string (`openssl rand -hex 32`) |
| `RESEND_API_KEY` | backend | Your Resend key |
| `RESEND_FROM_EMAIL` | backend | Verified sender (domain-locked to `faraja.enkaai.net` today) |
| `FRONTEND_URL` | backend | `${APP_URL}` (set automatically) |
| `CORS_ORIGINS` | backend | `${APP_URL}` — or comma-separated list for multiple domains |
| `NEXT_PUBLIC_API_URL` | frontend | `https://<backend-app>.ondigitalocean.app/api/v1` — find the backend app URL, then trigger a rebuild of the frontend |

`DATABASE_URL` is auto-injected from the `db` component (`${db.DATABASE_URL}`).

### 4. First deploy

Trigger a deploy. Watch the backend logs for `Application startup complete.`
Then seed the database (one-off):

```bash
# from the DO dashboard: open the backend service console, then:
python -m app.db.seed
```

Or locally against the managed DB:

```bash
uv run python -m app.db.seed   # backend/ — DATABASE_URL must point at the DO cluster
```

Seed is **additive and idempotent** — safe to re-run.

### 5. Domain + TLS

Dashboard → Settings → Domains → add your domain (e.g. `loans.farajasolutions.co.ke`)
and set the CNAME. TLS is automatic. `FRONTEND_URL` / `CORS_ORIGINS` stay
`${APP_URL}`-based and pick up the custom domain automatically.

---

## Option B — Droplet + Docker Compose (single VPS)

### 1. Provision

Create a droplet (Ubuntu 24.04, 2 vCPU / 2 GB is enough to start), then:

```bash
ssh root@<droplet-ip>
apt update && apt install -y docker.io docker-compose-v2
```

### 2. Get the code + env

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/farajasolutionloans.git /opt/faraja
cd /opt/faraja
cp backend/.env.example backend/.env
nano backend/.env    # ← fill DATABASE_URL, SECRET_KEY, RESEND_API_KEY, CORS_ORIGINS, FRONTEND_URL
```

Use a DO Managed PostgreSQL cluster for `DATABASE_URL` (recommended) or the
bundled Postgres container (edit `docker-compose.yml` to point the backend at
`postgres` instead of external):

```yaml
# backend service — for the bundled DB, override DATABASE_URL via shell env:
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/faraja docker compose --profile deploy up -d --build
```

### 3. Build & start

```bash
docker compose --profile deploy up -d --build
docker compose --profile deploy ps          # all three should be healthy
```

The app is live on `http://<droplet-ip>` — nginx serves the frontend and
proxies `/api/*` to FastAPI (`docker/nginx.conf`). Backend migrations run
automatically at boot; seed once:

```bash
docker compose --profile deploy exec backend python -m app.db.seed
```

### 4. TLS with certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d loans.farajasolutions.co.ke
```

Point the domain's A record at the droplet IP first.

### 5. Updates

```bash
cd /opt/faraja && git pull && docker compose --profile deploy up -d --build
```

---

## Environment reference

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string (validated/rewritten to `postgresql+psycopg://`) |
| `SECRET_KEY` | yes | JWT signing secret — long random value |
| `CORS_ORIGINS` | no | Comma-separated browser origins; default `http://localhost:3000,https://faraja.enkaai.net` |
| `FRONTEND_URL` | no | Used in invite/reset links; default `http://localhost:3000` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | Default 60 |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | no* | Email invites — *required in production |
| `APP_ENV` | no | `production` disables debug |
| `NEXT_PUBLIC_API_URL` | build-time | Frontend API base; `/api/v1` when behind nginx, full URL on App Platform |

## Post-deploy checklist

1. Migrations applied (auto at boot; verify `alembic_version` has `71f36ff96244`).
2. Seed ran (`python -m app.db.seed`) — expect 11 branches, 6 roles, 8 users, 9 clients, 8 loans.
3. Login works; invite email arrives (Resend domain verification).
4. A KYC photo upload succeeds (25 MB nginx body limit; check `client_max_body_size` if raised).
5. `CORS_ORIGINS` includes every domain users will open the app from.

## Notes

- Secrets live only in DO env vars / `backend/.env` — never commit them.
- The Dockerfiles are also the build path for Render/Vercel if you ever switch back.
- `docker compose up -d` (no profile) still starts only PostgreSQL for local dev — unchanged.