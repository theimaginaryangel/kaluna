# Summary of Code Modifications (Milestone 2)

## 1. `services/registrations/app.py`
- **Ghost Seat Leak Fix**: In `cancel_registration`, inspected the ticket's current status (`reg_item.get('status')`). Only appended the `METADATA` update to increment `seatsRemaining` by 1 if `current_status == 'registered'`. If the status is `'waitlisted'`, `seatsRemaining` is NOT incremented. Furthermore, waitlist promotion logic is executed only when a registered ticket is cancelled.
- **Non-Existent Event 404**: In `register`, added an explicit DynamoDB lookup for `EVENT#{event_id}` `METADATA`. If the event item does not exist, returns `404 NOT_FOUND` with error code `EVENT_NOT_FOUND`. Added similar handling in `TransactionCanceledException` when conditional check fails due to missing event metadata.
- **Email Case Sensitivity**: Standardized email strings across registration creation, lookup, cancellation, and DynamoDB key generation using `email.strip().lower()`.

## 2. `services/events/app.py`
- **DynamoDB Limit Scan Bug Fix**: Rewrote `list_events` pagination scanning logic to execute a loop over `table.scan()` calls using `ExclusiveStartKey` until `limit` items matching `SK == 'METADATA'` are gathered or the table scan completes. This prevents returning empty pages when matching event items exist later in the scan evaluation.

## 3. `services/checkin/main.go`
- **Safe Type Assertions**: Replaced direct unsafe type assertions (e.g. `regItem["email"].(string)`) in `handleCheckin` and `handleGetCheckins` with safe type assertion checks (`val, ok := ...`) and structured error handling, preventing Go runtime panics on malformed data. Introduced `DynamoDBClient` interface for clean dependency injection.
- **Path Parameters Nil Guard**: Added check `if request.PathParameters != nil` prior to retrieving `"eventId"` in `handler`.
- **Non-Existent Ticket 404**: Updated `handleCheckin` so querying 0 items returns a `404 NOT_FOUND` response with error code `"NOT_FOUND"`, while already checked-in tickets return `409 INVALID_TICKET`.

## 4. Test Suite Enhancements & Creations
- **`services/events/tests/test_app.py`**: Added unit tests covering `update_event` (success, 404 not found, 400 invalid capacity), `get_analytics` (aggregating total events, upcoming events, registrations, attendance rate), `list_event_registrations`, and `list_events` limit pagination and cursor iteration. Added environment isolation fixtures (`sys.modules.pop('app', None)`).
- **`services/registrations/tests/test_app.py`**: Added unit tests covering `cancel_registration` for registered tickets (releasing seat), `cancel_registration` for waitlisted tickets (verifying seat is NOT released), waitlist promotion, non-existent event registration (verifying 404 status code and `EVENT_NOT_FOUND`), and email case/whitespace normalization.
- **`services/checkin/main_test.go`**: Expanded unit tests to include handler-level testing for `POST /api/v1/check-in`, `GET /api/v1/events/{eventId}/check-ins`, nil `PathParameters`, invalid JSON body, missing ticketId, non-existent ticket 404, duplicate check-in 409, and safe type assertion checks on invalid attribute types.
- **`services/feedback/tests/test_app.py`**: Created complete pytest unit test suite using `moto` for DynamoDB and SES, testing feedback email generation for events occurring yesterday.
- **`services/reminders/tests/test_app.py`**: Created complete pytest unit test suite using `moto` for DynamoDB and SES, testing reminder email generation for events occurring tomorrow.
