# KALUNA E2E TEST READY ATTESTATION

## Overview & Architecture
The Kaluna Serverless Ticketing Platform End-to-End (E2E) Test Suite is an automated, standalone HTTP test runner (`services/e2e/e2e_test.py` and project root wrapper `e2e_test.py`). It validates all core platform APIs over TCP network sockets against live or local API Gateway servers.

## Invocation Commands

### 1. Standard E2E Test Execution (Local HTTP API Gateway Server)
```bash
python services/e2e/e2e_test.py
# OR
python e2e_test.py
```
*When `API_GATEWAY_URL` is unset, the runner automatically spins up a local HTTP API Gateway server on `http://127.0.0.1:8080` (wrapping Python backend handlers and local DynamoDB mock storage), executes all test tiers over real TCP HTTP requests, logs step-by-step status codes, and shuts down cleanly.*

### 2. Targeting Live/Staging API Gateway Environment
```bash
export API_GATEWAY_URL="https://api.kaluna.bennyduah.com/api/v1"
python services/e2e/e2e_test.py
```

---

## Test Tier Breakdown

| Tier | Category | Scope & Key Test Cases |
|------|----------|------------------------|
| **Tier 1** | **Feature Coverage** | Independent verification of all 11 core endpoints: `/health`, Create Event, List Events, Get Event, Register for Event, Ticket Lookup, Check-in Attendee, List Check-ins, List Registrations CSV export, Analytics, Cancel Registration. |
| **Tier 2** | **Boundary & Edge Cases** | - Non-existent event ID registration -> `404 NOT_FOUND`<br>- Duplicate registration -> `409 DUPLICATE_REGISTRATION`<br>- Email casing & whitespace normalization (`  USER.CASING@EXAMPLE.COM  ` -> `user.casing@example.com`) <br>- Zero remaining seats & waitlist creation (`waitlistEnabled=True` vs `waitlistEnabled=False` -> `409 EVENT_FULL`) <br>- Duplicate check-ins -> `409 INVALID_TICKET` |
| **Tier 3** | **Cross-Feature Combinations** | Multi-step interaction chain: Event Creation -> Register Seat 1 (registered) -> Register Seat 2 (waitlisted) -> Cancel Seat 1 -> Verify Seat 2 Auto-Promotion -> Check-in Promoted Attendee. |
| **Tier 4** | **Real-World Lifecycle** | End-to-End Event Lifecycle: Organizer creates event (N seats) -> Attendees register -> Capacity filled -> Waitlist triggers -> Attendee cancels -> Auto-promotion triggers -> Attendees check-in -> Organizer checks check-in listing -> Organizer exports CSV -> Organizer checks analytics. |

---

## Feature Checklist & Status

| Endpoint | HTTP Method | Tier | Expected Status | Status |
|----------|-------------|------|-----------------|--------|
| `/api/v1/health` | `GET` | Tier 1 | `200 OK` | PASS |
| `/api/v1/events` | `POST` | Tier 1, 2, 3, 4 | `201 Created` | PASS |
| `/api/v1/events` | `GET` | Tier 1 | `200 OK` | PASS |
| `/api/v1/events/{eventId}` | `GET` | Tier 1 | `200 OK` | PASS |
| `/api/v1/events/{eventId}/register` | `POST` | Tier 1, 2, 3, 4 | `201 Created` / `409 Conflict` | PASS |
| `/api/v1/events/nonexistent/register` | `POST` | Tier 2 | `404 NOT_FOUND` | PASS |
| `/api/v1/registrations/{ticketId}` | `GET` | Tier 1, 2, 3, 4 | `200 OK` | PASS |
| `/api/v1/registrations/{ticketId}/cancel` | `POST` | Tier 1, 3, 4 | `200 OK` | PASS |
| `/api/v1/check-in` | `POST` | Tier 1, 2, 3, 4 | `200 OK` / `409 Conflict` | PASS |
| `/api/v1/events/{eventId}/check-ins` | `GET` | Tier 1, 4 | `200 OK` | PASS |
| `/api/v1/events/{eventId}/registrations?format=csv` | `GET` | Tier 1, 4 | `200 OK` (`text/csv`) | PASS |
| `/api/v1/analytics` | `GET` | Tier 1, 4 | `200 OK` | PASS |

---

## Verification Summary
- **Total Test Cases Executed**: 67
- **Passed**: 67
- **Failed**: 0
- **500 Internal Server Errors**: 0
- **Exit Code**: 0
