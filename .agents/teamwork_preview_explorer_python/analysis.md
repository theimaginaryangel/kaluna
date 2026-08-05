# Python Lambda Services Audit Report

**Date**: 2026-08-05  
**Auditor**: Explorer 2 (Python Services Audit Agent)  
**Target Services**: `services/events`, `services/registrations`, `services/checkin` (Go interop), `services/feedback`, `services/reminders`  

---

## Executive Summary

A comprehensive audit was performed across all Python Lambda services in the Kaluna repository (`services/events`, `services/registrations`, `services/feedback`, `services/reminders`), as well as inspecting the `services/checkin` service (which is implemented in Go).

The audit identified **20 distinct issues** across routing, business logic, DynamoDB transaction handling, status codes, input validation, and unit test coverage. Key critical vulnerabilities include:
1. **Unreachable Route**: `GET /api/v1/events/{eventId}/registrations` is permanently intercepted by `GET /api/v1/events/{eventId}`, rendering registration listing and CSV exports unreachable in `services/events`.
2. **Data Corruption / Ghost Seat Leak**: Cancelling a `waitlisted` registration in `services/registrations` unconditionally increments `seatsRemaining`, leaking artificial seats and exceeding event capacity.
3. **Incorrect Status Code**: Registering for a non-existent event returns `409 Conflict (EVENT_FULL)` instead of `404 Not Found`.
4. **Case-Sensitivity Vulnerability**: Email addresses are not normalized to lowercase, allowing duplicate registrations by changing letter casing (`User@example.com` vs `user@example.com`).
5. **Race Condition & Overwrites**: Admin capacity updates lack optimistic locking, leading to concurrent ticket purchases overwriting remaining seat counts.
6. **Missing Pytest Coverage**: `services/feedback` and `services/reminders` have zero test files. `services/events` lacks tests for `update_event`, `get_analytics`, and `list_event_registrations`. `services/registrations` lacks tests for `cancel_registration` and waitlist promotion.

---

## 1. Architectural Overview & Service Discovery

| Service Directory | Primary Implementation Language | Entrypoint Handler | Key Capabilities | Unit Test Suite Location |
|---|---|---|---|---|
| `services/events` | Python 3.x | `app.lambda_handler` | Health, Event CRUD, Analytics, List Registrations (CSV) | `services/events/tests/test_app.py` |
| `services/registrations` | Python 3.x | `app.lambda_handler` | Event Registration, Waitlisting, Ticket Lookup, Cancellation & Promotion | `services/registrations/tests/test_app.py` |
| `services/feedback` | Python 3.x | `app.lambda_handler` | Post-event attendee feedback email automation (Cron/Scheduled) | None |
| `services/reminders` | Python 3.x | `app.lambda_handler` | Pre-event attendee reminder email automation (Cron/Scheduled) | None |
| `services/checkin` | **Go 1.x** | `main.handler` | Ticket check-in validation & check-in list querying | `services/checkin/main_test.go` |

> **Note**: While the prompt objective referenced `services/checkin` alongside Python Lambda services, codebase examination confirmed `services/checkin` is implemented in **Go** (`main.go`). Its interoperation with Python services via DynamoDB table single-table design (`kaluna-dev-table`) was included in this audit.

---

## 2. Detailed Findings by Category

### Category 1: Routing & Path Handling Bugs

#### Finding 1.1: Unreachable Route for List Event Registrations
- **Location**: `services/events/app.py:97-118`
- **Code Snippet**:
  ```python
  97: elif path.startswith('/api/v1/events/') and event_id:
  98:     if http_method == 'GET':
  99:         response = get_event(event_id)
  ...
  114: elif path.startswith('/api/v1/events/') and path.endswith('/registrations') and event_id:
  115:     if http_method == 'GET':
  116:         response = list_event_registrations(event_id, event)
  ```
- **Root Cause**: Python evaluates `elif` conditions sequentially. A request to `GET /api/v1/events/123/registrations` satisfies line 97 because `path.startswith('/api/v1/events/')` is `True` and `event_id` (`123/registrations` or `123` depending on API Gateway mapping) is truthy. Line 98 executes `get_event()`, returning a 404 or single event metadata item. Line 114 is **dead code**.
- **Impact**: Clients cannot list registrations or export CSV registration reports via `GET /api/v1/events/{eventId}/registrations`.
- **Recommended Fix**: Reorder route checks so that more specific paths (`path.endswith('/registrations')`) are evaluated before generic prefix matches (`path.startswith('/api/v1/events/')`), or use regex/exact path parsing.

#### Finding 1.2: Path Collision in Registrations Service
- **Location**: `services/registrations/app.py:45-56`
- **Root Cause**: `GET /api/v1/registrations/{ticketId}` uses `path.startswith('/api/v1/registrations/')`. Any GET request starting with `/api/v1/registrations/` (such as `GET /api/v1/registrations/123/cancel`) is routed to `get_registration()` instead of returning a 404 or routing to a cancel handler.
- **Impact**: Unexpected behavior for invalid or non-POST HTTP methods on ticket resource sub-paths.

#### Finding 1.3: Unhandled Malformed JSON Request Bodies (500 Errors)
- **Location**: `services/events/app.py:92, 104` and `services/registrations/app.py:39`
- **Root Cause**: `json.loads(event.get('body', '{}'))` is called directly inside `lambda_handler` without catching `json.JSONDecodeError`.
- **Impact**: Invalid JSON payloads trigger the generic `except Exception` block, logging an error and returning `500 Internal Server Error` with code `"INTERNAL_ERROR"` instead of returning `400 Bad Request`.
- **Recommended Fix**: Wrap `json.loads` in a `try...except json.JSONDecodeError` block and return `build_response(400, format_error("Invalid JSON body", "BAD_REQUEST"))`.

---

### Category 2: Business Logic & Data Integrity Bugs

#### Finding 2.1: Waitlisted Registration Cancellation Creates Ghost Seats (Critical)
- **Location**: `services/registrations/app.py:239-305`
- **Code Snippet**:
  ```python
  268: dynamodb.meta.client.transact_write_items(
  269:     TransactItems=[
  270:         {
  271:             'Update': {
  ...
  277:                 'UpdateExpression': "SET #s = :cancelled",
  ...
  282:         {
  283:             'Update': {
  ...
  289:                 'UpdateExpression': "SET seatsRemaining = seatsRemaining + :one",
  ...
  ```
- **Root Cause**: `cancel_registration` queries the ticket by `ticketId` and unconditionally increments `seatsRemaining` by 1 on the event metadata. However, if the cancelled registration had a status of `'waitlisted'`, the user **never decremented** `seatsRemaining` when registering.
- **Impact**: Cancelling a waitlisted ticket increases `seatsRemaining` beyond event capacity, creating phantom available seats.
- **Recommended Fix**: Check `reg_item.get('status')`. Only increment `seatsRemaining` if status was `'registered'`. If status was `'waitlisted'`, update the ticket status to `'cancelled'` without modifying `seatsRemaining`.

#### Finding 2.2: Incorrect Status Code (409 instead of 404) for Non-Existent Event Registration
- **Location**: `services/registrations/app.py:140-175`
- **Root Cause**: When registering for a non-existent `eventId`, Item 0 (`EVENT#{event_id}` `METADATA`) in `transact_write_items` fails condition check `seatsRemaining > 0`. The transaction exception handler checks `reasons[0].get('Code') == 'ConditionalCheckFailed'` and executes `table.get_item()`. Since the event metadata does not exist, `get_item` returns `None`. `event_item.get('waitlistEnabled')` is `False`, leading to line 174:
  `return build_response(409, format_error("Event is full", "EVENT_FULL"))`.
- **Impact**: Callers attempting to register for a non-existent event receive `409 Conflict (EVENT_FULL)` instead of `404 Not Found (EVENT_NOT_FOUND)`.

#### Finding 2.3: Duplicate Registration Logic Overridden when Event is Full
- **Location**: `services/registrations/app.py:140-177`
- **Root Cause**: If a user attempts a duplicate registration (`SK = REG#{email}`) on an event that is currently full (`seatsRemaining == 0`), both Item 0 (seats check) and Item 1 (duplicate check) fail conditional check. The handler checks `reasons[0]` first and returns `409 EVENT_FULL` (or adds to waitlist). Line 175 (`reasons[1]` check for `DUPLICATE_REGISTRATION`) is never reached.
- **Impact**: Duplicate registration requests on full events place the existing attendee on the waitlist again or return `409 EVENT_FULL`.

#### Finding 2.4: Email Case-Sensitivity Vulnerability
- **Location**: `services/registrations/app.py:72, 83`
- **Root Cause**: `reg_sk = f"REG#{email}"` uses raw user input. DynamoDB partition/sort keys are case-sensitive strings. `Alice@example.com` and `alice@example.com` produce `REG#Alice@example.com` and `REG#alice@example.com`.
- **Impact**: Users can bypass the duplicate registration check by changing letter casing in their email address.
- **Recommended Fix**: Normalize email addresses: `email = body['email'].strip().lower()`.

#### Finding 2.5: Unchecked Capacity Reduction in Event Update
- **Location**: `services/events/app.py:246-257`
- **Root Cause**: `update_event` calculates `new_rem = new_cap - (old_cap - old_rem)`. If an event has 50 sold tickets (`old_cap=100`, `old_rem=50`) and admin updates `capacity` to `20`, `new_rem` becomes `20 - 50 = -30`.
- **Impact**: `seatsRemaining` becomes negative. No validation checks if `new_cap >= tickets_sold`.

#### Finding 2.6: Race Condition in Event Capacity Updates
- **Location**: `services/events/app.py:236-302`
- **Root Cause**: `update_event` reads event state via `get_item`, calculates new `seatsRemaining` in Python, and updates via `transact_write_items` without a condition expression verifying `seatsRemaining` hasn't changed.
- **Impact**: If a registration occurs concurrently during an admin capacity update, the seat count decrement will be overwritten and lost.

#### Finding 2.7: Orphaned Registration Data on Event Deletion
- **Location**: `services/events/app.py:309-340`
- **Root Cause**: `delete_event` deletes only `SK="METADATA"`. Registrations (`SK="REG#..."`) and audit entries are left orphaned in DynamoDB. Additionally, deleting a non-existent event returns `204 No Content` without checking if the item existed.

#### Finding 2.8: Unused & Ignored Idempotency Keys
- **Location**: `services/registrations/app.py:67`
- **Root Cause**: `idempotencyKey` is listed as a required payload field, but is never stored in DynamoDB or checked. Retrying a request with the same `idempotencyKey` returns `409 DUPLICATE_REGISTRATION` instead of returning the cached registration result.

---

### Category 3: DynamoDB & Query Bugs

#### Finding 3.1: Flawed Pagination & Filter Expression in `list_events`
- **Location**: `services/events/app.py:135-138`
- **Code Snippet**:
  ```python
  scan_kwargs = {
      'FilterExpression': Attr('SK').eq('METADATA'),
      'Limit': limit
  }
  ```
- **Root Cause**: DynamoDB applies `Limit` *before* `FilterExpression`. If a partition segment contains 20 `REG#` or `AUDIT#` items before a `METADATA` item, DynamoDB returns 0 items in the response page even though `METADATA` items exist in the table.
- **Impact**: `GET /api/v1/events` returns empty lists or missing events when non-metadata items exist in the table.
- **Recommended Fix**: Use a Global Secondary Index (e.g. `GSI1PK = "EVENT"`, `GSI1SK = "METADATA"`) and execute `table.query()` instead of `table.scan()`.

#### Finding 3.2: Missing Pagination in Analytics, Feedback, and Reminders Scans
- **Location**: `services/events/app.py:383`, `services/feedback/app.py:18`, `services/reminders/app.py:19`
- **Root Cause**: `table.scan()` is invoked without a pagination loop inspecting `LastEvaluatedKey`.
- **Impact**: DynamoDB scans cap responses at 1MB. In production tables exceeding 1MB, analytics will be inaccurate, and feedback/reminder emails will skip eligible attendees.

---

### Category 4: Validation & Exception Gaps (Potential 500 Errors)

#### Finding 4.1: Type Errors in Date & Capacity Validation
- **Location**: `services/events/app.py:31-43`
- **Root Cause**:
  1. `datetime.strptime(body['date'], '%Y-%m-%d')` catches `ValueError`, but raises an unhandled `TypeError` if `date` is passed as a non-string type (e.g., integer timestamp or dictionary).
  2. `query_params.get('limit')` in `list_events` (line 132) raises `ValueError` if `limit` is a non-numeric string (`?limit=invalid`), resulting in an unhandled 500 error.
- **Impact**: Malformed input parameters trigger 500 Internal Server Errors instead of 400 Bad Request.

#### Finding 4.2: ZeroDivisionError Risk in `compute_status`
- **Location**: `services/events/app.py:16-21`
- **Root Cause**: `compute_status(capacity, seats_remaining)` evaluates `seats_remaining / capacity`. If `capacity` is 0, a `ZeroDivisionError` occurs, returning 500 Internal Server Error.

#### Finding 4.3: CSV Export Schema Discrepancy Risk
- **Location**: `services/events/app.py:362-365`
- **Root Cause**: `csv.DictWriter(output, fieldnames=registrations[0].keys())` assumes all registration items share identical dictionary keys. Optional fields present in subsequent items cause `DictWriter` to raise `ValueError: dict contains fields not in fieldnames`.

---

### Category 5: Test Execution & Coverage Gaps

#### Finding 5.1: Missing Test Files
- `services/feedback`: **0 tests** (No test directory or test files).
- `services/reminders`: **0 tests** (No test directory or test files).

#### Finding 5.2: Test Coverage Gaps in `services/events`
The existing suite (`services/events/tests/test_app.py`) has 8 test functions, but lacks tests for:
- `update_event` (PUT `/api/v1/events/{id}`) - **0% test coverage**.
- `get_analytics` (GET `/api/v1/analytics`) - **0% test coverage**.
- `list_event_registrations` (GET `/api/v1/events/{id}/registrations`) - **0% test coverage** (writing this test would have caught Finding 1.1!).
- Malformed JSON body handling.
- Query string validation (`limit` non-numeric, invalid cursor).

#### Finding 5.3: Test Coverage Gaps in `services/registrations`
The existing suite (`services/registrations/tests/test_app.py`) has 6 test functions, but lacks tests for:
- `cancel_registration` (POST `/api/v1/registrations/{id}/cancel`) - **0% test coverage** (writing this test would have caught Finding 2.1!).
- Waitlist creation and promotion workflows.
- Non-existent event registration status code verification (Finding 2.2).
- Email case-sensitivity (Finding 2.4).
- Idempotency key handling.

---

## 3. Summary of Status Codes & Error Formatting Audit

| Endpoint | Expected Success Status | Expected Error Status | Actual Code Behavior / Bug Notes |
|---|---|---|---|
| GET `/api/v1/health` | 200 OK | N/A | Correct |
| GET `/api/v1/events` | 200 OK | 400 (Bad Cursor / Limit) | 500 on invalid limit type; Scan Limit bug |
| POST `/api/v1/events` | 201 Created | 400 Bad Request | 500 on invalid JSON; missing venue validation |
| GET `/api/v1/events/{id}` | 200 OK | 404 Not Found | Correct |
| PUT `/api/v1/events/{id}` | 200 OK | 400 / 404 | Missing capacity lower bound check vs sold seats |
| DELETE `/api/v1/events/{id}` | 204 No Content | 404 Not Found | Returns 204 even if event does not exist; leaves orphaned registrations |
| GET `/api/v1/events/{id}/registrations` | 200 OK | 404 Not Found | **Unreachable route (404/Event JSON returned)** |
| GET `/api/v1/analytics` | 200 OK | 500 Error | Scans un-paginated DB |
| POST `/api/v1/events/{id}/register` | 201 Created | 400 / 409 / 404 | **Returns 409 instead of 404 for non-existent event ID** |
| GET `/api/v1/registrations/{ticketId}` | 200 OK | 404 Not Found | Correct |
| POST `/api/v1/registrations/{ticketId}/cancel` | 200 OK | 404 Not Found | **Increments seatsRemaining for waitlisted tickets** |

---

## 4. Remediation Plan & Recommendations

1. **Fix Routing Logic**:
   - Reorder route patterns in `services/events/app.py` so `/api/v1/events/{eventId}/registrations` is checked before `/api/v1/events/{eventId}`.
2. **Fix Cancellation Logic**:
   - In `services/registrations/app.py`, inspect `reg_item['status']` in `cancel_registration()`. Only decrement/increment `seatsRemaining` if `status == 'registered'`.
3. **Fix Non-Existent Event Registration Status Code**:
   - In `register()`, query event metadata first or check if event exists before attempting transaction, returning `404 NOT_FOUND` if metadata is missing.
4. **Normalize Emails & Support Idempotency**:
   - Convert emails to lowercase (`email.strip().lower()`).
   - Store and check `idempotencyKey` to ensure idempotent request handling.
5. **Upgrade DynamoDB Querying**:
   - Replace table scans with GSI queries for event metadata and registrations. Add pagination loops (`LastEvaluatedKey`) to all scan operations.
6. **Expand Unit Test Coverage**:
   - Add tests for `update_event`, `list_event_registrations`, `cancel_registration`, waitlist promotion, email case-sensitivity, invalid JSON, and non-existent event registration.
   - Add test suites for `services/feedback` and `services/reminders`.
