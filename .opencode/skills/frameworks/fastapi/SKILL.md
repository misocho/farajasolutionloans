---
name: fastapi
description: HumbleBee FastAPI REST service conventions — scaffold from the company template, then structure, validation, auth, and logging.
---

## Start from the template

Scaffold every new FastAPI service from the HumbleBee template — don't hand-roll the layout:

- Default (no ORM): https://github.com/humblebeeai/rest-fastapi-template
- With an ORM / database models: https://github.com/humblebeeai/rest-fastapi-orm-template

Clone the template (or mirror its structure into the project) and keep its `src/`, `scripts/`,
`requirements*.txt`, `compose.yml`, and `templates/` layout. Match its naming and conventions rather
than introducing a different structure.

## Conventions

- **Pydantic v2** models for all request/response schemas; validate every input at the boundary.
- **Versioned routes** under `/api/v1/...`; keep handlers thin and push logic into service/use-case modules.
- **Dependency injection** for auth, DB sessions, and settings (`Depends(...)`); resolve the current
  user from the verified token/session, never from a client-supplied id (no IDOR).
- **Settings via `pydantic-settings`** read from the environment; never hardcode config or secrets.
- **Async** endpoints and async IO/DB clients; offload slow work to background tasks/queues.
- **Structured JSON logging** with `request_id` / `trace_id`; never log secrets or PII.
- **OpenAPI** kept accurate — tags, summaries, and response models on every route.

## ORM variant

If the service persists data with an ORM, use `rest-fastapi-orm-template`. Follow its migration
workflow (additive, reversible migrations) and session management; don't bypass the repository layer.

## Use with

Load alongside the `backend` and `testing` skills. Run `scripts/test.sh` before completion.
