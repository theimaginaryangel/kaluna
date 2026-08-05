# Explorer 2 Handoff Report — Python Services Audit

## 1. Observation
- **Service Files Audited**:
  - `services/events/app.py` (413 lines), `services/events/utils.py` (38 lines), `services/events/tests/test_app.py` (188 lines)
  - `services/registrations/app.py` (399 lines), `services/registrations/utils.py` (38 lines), `services/registrations/tests/test_app.py` (174 lines)
  - `services/feedback/app.py` (76 lines)
  - `services/reminders/app.py` (82 lines)
  - `services/checkin/main.go` (245 lines) — **Observed `checkin` is written in Go, not Python.**
- **Key Code & Path Observations**:
  - `services/events/app.py`: Line 97 checks `elif path.startswith('/api/v1/events/') and event_id:`. Line 114 checks `elif path.startswith('/api/v1/events/') and path.endswith('/registrations') and event_id:`. Line 97 intercepts line 114.
  - `services/registrations/app.py`: Line 289 in `cancel_registration` unconditionally updates `seatsRemaining = seatsRemaining + 1` during cancellation without checking if the ticket status was `'registered'` or `'waitlisted'`.
  - `services/registrations/app.py`: Line 174 returns `409 EVENT_FULL` when a registration transaction fails on a non-existent event ID because `event_item` is `None` when checking waitlist status.
  - `services/registrations/app.py`: Line 83 creates `reg_sk = f"REG#{email}"` using un-normalized email strings.
  - `services/events/app.py`: Line 135 `table.scan(FilterExpression=Attr('SK').eq('METADATA'), Limit=limit)` applies `Limit` prior to filtering.
  - `services/events/tests/test_app.py`: Missing tests for `update_event`, `get_analytics`, and `list_event_registrations`.
  - `services/registrations/tests/test_app.py`: Missing tests for `cancel_registration`, waitlisting, non-existent event ID registration, and email case-sensitivity.
  - `services/feedback` & `services/reminders`: 0 test files exist.

## 2. Logic Chain
1. **Observation 1** (Line 97 vs Line 114 in `services/events/app.py`): Route evaluation is sequential. Any path starting with `/api/v1/events/` matches Line 97 first. Thus, `GET /api/v1/events/123/registrations` executes `get_event('123')`, rendering Line 114 (`list_event_registrations`) dead code.
2. **Observation 2** (Line 289 in `services/registrations/app.py`): When cancelling a waitlisted ticket, `seatsRemaining` is incremented. Because waitlisted users never decremented `seatsRemaining`, incrementing it leaks artificial seats and corrupts seat counts.
3. **Observation 3** (Lines 140-175 in `services/registrations/app.py`): When `eventId` does not exist in DynamoDB, Item 0 in `transact_write_items` fails. The exception handler queries the non-existent event, gets `None`, and falls through to line 174 returning `409 EVENT_FULL` instead of `404 NOT_FOUND`.
4. **Observation 4** (Line 83 in `services/registrations/app.py`): DynamoDB keys are case-sensitive. `REG#user@example.com` and `REG#User@example.com` do not collide, allowing duplicate registrations by changing case.
5. **Observation 5** (Line 135 in `services/events/app.py`): DynamoDB `Scan` limits items read before filtering. If the first `Limit` items do not match `SK == METADATA`, empty pages are returned to the client.
6. **Observation 6** (Test file review): The missing unit tests for `cancel_registration` and `list_event_registrations` explain why the ghost seat bug and unreachable route bug went undetected.

## 3. Caveats
- Direct CLI execution of `python -m pytest` timed out waiting for terminal prompt approval. All findings were established via line-by-line static analysis, control flow evaluation, and fixture inspection.
- External SES email sending was mocked/bypassed in tests. SES behavior in production depends on AWS SES sandbox verification status.

## 4. Conclusion
The Python Lambda services contain critical routing, status code, data integrity, and transaction handling bugs that will cause production failures (unreachable registration CSV exports, ghost seat leaks on waitlist cancellation, 409 instead of 404 errors, email case-sensitivity duplicates). Addressing these require path reordering, status-aware cancellation, email normalization, GSI querying, and test suite expansion.

## 5. Verification Method
1. **Unreachable Route**: Send `GET /api/v1/events/{eventId}/registrations`. Observe that it returns event metadata or 404 instead of registration array / CSV format.
2. **Ghost Seat Leak**: Register a waitlisted attendee (with `waitlistEnabled=True` and `seatsRemaining=0`). Cancel the waitlisted ticket (`POST /api/v1/registrations/{ticketId}/cancel`). Observe that `seatsRemaining` becomes `1`.
3. **Non-Existent Event Status Code**: Send `POST /api/v1/events/nonexistent-id/register`. Observe that response is `409 EVENT_FULL` instead of `404 NOT_FOUND`.
4. **Pytest Run**: Execute `pytest services/events/tests` and `pytest services/registrations/tests` once terminal permission is granted, and add new unit tests targeting the missing endpoints.
