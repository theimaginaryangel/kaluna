# API

Full machine-readable contract: [`openapi.yaml`](../openapi.yaml) — importable directly into Postman or Swagger UI.

Base path: `/api/v1`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Service health check |
| GET | `/events` | none | List events, filterable by status, paginated |
| POST | `/events` | Cognito | Create event |
| GET | `/events/{eventId}` | none | Event detail |
| PUT | `/events/{eventId}` | Cognito | Update event |
| DELETE | `/events/{eventId}` | Cognito | Delete event |
| POST | `/events/{eventId}/register` | none | Register for an event |
| GET | `/events/{eventId}/registrations` | Cognito | List/export attendees |
| GET | `/events/{eventId}/check-ins` | Cognito | Live check-in status |
| GET | `/registrations/{ticketId}` | none | Ticket lookup |
| POST | `/registrations/{ticketId}/cancel` | none | Cancel registration |
| POST | `/check-in` | none* | Check in a scanned ticket |
| GET | `/analytics` | Cognito | Aggregate stats |

*Check-in is unauthenticated at the API level because it's used by a door-scanning device; the ticket ID itself is the credential, and every scan is written to the audit log.

Every response follows the format in `00-engineering-spec.md`. Any change to an endpoint updates this file and `openapi.yaml` in the same PR.
