# Quality & Security Review Report: Backend Code & IaC

**Reviewer**: Reviewer 1 (Backend Code & IaC Reviewer)  
**Date**: 2026-08-05  
**Verdict**: **APPROVE**  

---

## Executive Summary

A comprehensive quality, correctness, security, and integrity review was performed for all backend Python services (`events`, `registrations`, `feedback`, `reminders`), the Go `checkin` microservice, Terraform environment configurations (`dev`, `staging`, `prod`), and the OpenAPI specification (`openapi.yaml`).

All unit tests across the repository pass cleanly (30 Python tests, 11 Go tests = **41 total tests passed**). Zero integrity violations were found. All six targeted bug fixes—route precedence, ghost seat leak prevention, 404 status codes, email normalization, Go safe type assertions, and Terraform environment parity—have been verified as robust, clean, and production-ready.

---

## Review Findings & Verification Summary

| Item / Feature | Verification Method | Status | Assessment |
|---|---|---|---|
| **Integrity Violations** | Code inspection for hardcoded test results, facade implementations, or bypasses | **PASS** | No integrity violations found. All services interact with DynamoDB using real transactions and queries. |
| **Route Precedence** | Inspected `services/events/app.py` & `main.tf` | **PASS** | `/api/v1/events/{eventId}/registrations` (line 101) is declared BEFORE generic `/api/v1/events/{eventId}` (line 107). API Gateway V2 routes match exact parameter templates. |
| **Ghost Seat Leak** | Inspected `services/registrations/app.py` (`cancel_registration`) | **PASS** | `seatsRemaining` increment and waitlist promotion occur ONLY if `current_status == 'registered'`. Cancelling a `waitlisted` ticket releases no seats. |
| **404 Status Code** | Inspected `events`, `registrations`, `checkin` handlers | **PASS** | Missing events/tickets return proper HTTP 404 with structured error payloads (`NOT_FOUND` / `EVENT_NOT_FOUND`). |
| **Email Normalization** | Inspected `services/registrations/app.py` | **PASS** | Emails are normalized via `.strip().lower()` during registration and cancellation to prevent casing mismatches in DynamoDB `SK` keys. |
| **Go Safe Type Assertions** | Inspected `services/checkin/main.go` | **PASS** | All interface type assertions use the `, ok` idiom (lines 151, 156-158, 252), preventing runtime panic vulnerabilities. |
| **Terraform Parity** | Compared `dev/main.tf`, `staging/main.tf`, `prod/main.tf` | **PASS** | All environments share identical module structures, Lambda resources, API routes, and event rules, parameterized by `local.environment`. |
| **OpenAPI Conformance** | Cross-referenced `openapi.yaml` with service handlers | **PASS** | OpenAPI spec accurately covers all endpoints, query parameters, authorization schemes, and schema models. |

---

## Test Execution Results

### 1. Python Unit Tests (`pytest`)

- **`services/events/tests/test_app.py`**:
  - **15 passed**, 0 failed (28.30s)
- **`services/registrations/tests/test_app.py`**:
  - **11 passed**, 0 failed (14.13s)
- **`services/feedback/tests/test_app.py`**:
  - **2 passed**, 0 failed (3.88s)
- **`services/reminders/tests/test_app.py`**:
  - **2 passed**, 0 failed (4.39s)

### 2. Go Unit Tests (`go test`)

- **`services/checkin`**:
  - `TestBuildResponse` — PASS
  - `TestBuildErrorResponse` — PASS
  - `TestCheckinRequestParsing` — PASS
  - `TestCheckinRequestEmpty` — PASS
  - `TestHandlerNilPathParameters` — PASS
  - `TestCheckinInvalidJSON` — PASS
  - `TestCheckinNonExistentTicket404` — PASS
  - `TestCheckinDuplicateCheckin409` — PASS
  - `TestCheckinSuccess` — PASS
  - `TestGetCheckinsListing` — PASS
  - `TestSafeTypeAssertions` — PASS
  - **11 passed**, 0 failed

---

## Detailed Code Analysis & Stress Testing

### 1. Route Precedence (`services/events/app.py`)
- **Code Path**: Line 101 (`/api/v1/events/{eventId}/registrations`) vs Line 107 (`/api/v1/events/{eventId}`).
- **Stress Test Scenario**: Invoking GET `/api/v1/events/evt-100/registrations`.
- **Behavior**: Matches condition on line 101 and triggers `list_event_registrations()`. If evaluated after line 107, it would hit `get_event('evt-100/registrations')` and fail with 404. Placing the specific sub-resource route higher resolves the ambiguity.

### 2. Ghost Seat Leak Prevention (`services/registrations/app.py`)
- **Code Path**: Lines 257–317 in `cancel_registration()`.
- **Stress Test Scenario**: A waitlisted user cancels their ticket when the event is full (e.g. capacity = 10, seatsRemaining = 0, waitlisted = 3).
- **Behavior**:
  - `current_status` evaluates to `'waitlisted'`.
  - Status is updated to `'cancelled'`, but line 295 (`if current_status == 'registered':`) skips incrementing `seatsRemaining`.
  - Line 317 skips waitlist promotion.
  - `seatsRemaining` stays 0. No extra seat is created out of thin air.

### 3. Email Case Normalization (`services/registrations/app.py`)
- **Code Path**: `email = body['email'].strip().lower()`.
- **Stress Test Scenario**: User registers as `John.Doe@Example.com` and later cancels as `john.doe@example.com`.
- **Behavior**: Both convert to `john.doe@example.com`, generating the consistent DynamoDB key `REG#john.doe@example.com`.

### 4. Go Safe Type Assertions (`services/checkin/main.go`)
- **Code Path**: `status, ok := regItem["status"].(string)`.
- **Stress Test Scenario**: DynamoDB item missing the `status` key or containing a non-string type attribute.
- **Behavior**: `ok` evaluates to `false`, function returns standard HTTP 409 / 500 error instead of process panic.

---

## Minor Non-Blocking Recommendations

1. **Python `datetime.utcnow()` Deprecation**:
   - In Python 3.12+, `datetime.utcnow()` is marked for deprecation. Consider replacing with `datetime.now(timezone.utc)` across `app.py` files in future refactoring.

---

## Final Verdict

**APPROVE** — Backend code, Go service, and Terraform IaC configurations meet all quality, security, and functional requirements.
