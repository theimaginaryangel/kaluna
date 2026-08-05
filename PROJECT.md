# Project: Kaluna Backend Audit & Bug Fixes

## Architecture
- **Platform**: Serverless Ticketing Platform
- **Infrastructure**: Terraform (`terraform/modules/`, `terraform/environments/dev`, `staging`, `prod`)
- **Backend Services**:
  - `services/events`: Python 3.12 Lambda (Event management, listing, analytics, registrations CSV export)
  - `services/registrations`: Python 3.12 Lambda (Event registration, ticket generation, waitlist, cancellation)
  - `services/checkin`: Go 1.22 Lambda (`provided.al2023`, attendee ticket check-in & check-in listing)
  - `services/feedback`: Python 3.12 Lambda (Background cron worker for feedback requests)
  - `services/reminders`: Python 3.12 Lambda (Background cron worker for event reminders)
- **API Specification**: `openapi.yaml` (OpenAPI 3.0.3)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Infrastructure & API Gateway Routing Fixes | Route precedence, OpenAPI alignment, Terraform env parity (`staging`/`prod`), build scripts | none | DONE |
| 2 | Python & Go Service Bug Fixes & Unit Tests | Ghost seat leak fix, 404 status code fix, email casing normalization, Go panic guards, Pytest & Go test expansion | M1 | DONE |
| 3 | Automated E2E Testing Suite | Python E2E test runner hitting live/local API Gateway endpoints verifying core flows | M2 | DONE |
| 4 | Independent Verification & Forensic Audit | Reviewers, Challenger stress test, Forensic Auditor integrity check | M3 | DONE |

## Interface Contracts
### API Gateway Endpoint Routing
- `GET /health` -> `events` Lambda
- `GET /api/v1/events` -> `events` Lambda (returns `{ "events": [...], "nextCursor": "..." }`)
- `POST /api/v1/events` -> `events` Lambda
- `GET /api/v1/events/{eventId}` -> `events` Lambda
- `PUT /api/v1/events/{eventId}` -> `events` Lambda
- `DELETE /api/v1/events/{eventId}` -> `events` Lambda
- `GET /api/v1/events/{eventId}/registrations` -> `events` Lambda (MUST evaluate before generic `/events/{eventId}` route)
- `GET /api/v1/analytics` -> `events` Lambda
- `POST /api/v1/events/{eventId}/register` -> `registrations` Lambda
- `GET /api/v1/registrations/{ticketId}` -> `registrations` Lambda
- `POST /api/v1/registrations/{ticketId}/cancel` -> `registrations` Lambda
- `POST /api/v1/check-in` -> `checkin` Lambda (Go)
- `GET /api/v1/events/{eventId}/check-ins` -> `checkin` Lambda (Go)

## Code Layout
- `services/events/` — Python event service (`app.py`, `utils.py`, `tests/`)
- `services/registrations/` — Python registration service (`app.py`, `utils.py`, `tests/`)
- `services/checkin/` — Go checkin service (`main.go`, `main_test.go`, `go.mod`)
- `services/feedback/` — Python feedback worker (`app.py`)
- `services/reminders/` — Python reminders worker (`app.py`)
- `terraform/` — IaC definitions (`environments/dev`, `staging`, `prod`, `modules/`)
- `openapi.yaml` — API Gateway contract
