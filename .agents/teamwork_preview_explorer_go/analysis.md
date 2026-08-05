# Go Services & API Specification Audit Report

## 1. Executive Summary & Architecture Overview

This report provides an in-depth audit of the Go Lambda service (`services/checkin`), an inspection of `openapi.yaml`, a comparison of all API endpoints across Python and Go Lambda implementations, and an assessment of requirements for the R2 End-to-End (E2E) API Gateway test suite.

### Service Language & Trigger Architecture Clarification

| Service Directory | Language / Runtime | Primary Purpose | Trigger Source | OpenAPI Exposed Path(s) |
|---|---|---|---|---|
| `services/checkin` | **Go 1.26** (`provided.al2023`) | Scanned ticket validation & live check-in listing | API Gateway HTTP API (Proxy) | `POST /api/v1/check-in`<br>`GET /api/v1/events/{eventId}/check-ins` |
| `services/events` | **Python 3.11** | Event CRUD, health check, analytics, registrations export | API Gateway HTTP API (Proxy) | `GET /api/v1/health`<br>`GET /api/v1/events`<br>`POST /api/v1/events`<br>`GET/PUT/DELETE /api/v1/events/{eventId}`<br>`GET /api/v1/events/{eventId}/registrations`<br>`GET /api/v1/analytics` |
| `services/registrations` | **Python 3.11** | Event registration, ticket lookup, registration cancellation | API Gateway HTTP API (Proxy) | `POST /api/v1/events/{eventId}/register`<br>`GET /api/v1/registrations/{ticketId}`<br>`POST /api/v1/registrations/{ticketId}/cancel` |
| `services/feedback` | **Python 3.11** | Post-event attendee feedback email dispatcher | CloudWatch / EventBridge Schedule (`cron(0 14 * * ? *)`) | *None* (Background Event Worker) |
| `services/reminders` | **Python 3.11** | Pre-event attendee QR reminder email dispatcher | CloudWatch / EventBridge Schedule (`cron(0 10 * * ? *)`) | *None* (Background Event Worker) |

> **Architectural Note**: While prompt instructions grouped `services/feedback` and `services/reminders` under Go Lambda services, codebase analysis confirms that `services/checkin` is the **only** Go service in the repository. `feedback` and `reminders` are Python Lambda functions triggered by daily EventBridge cron schedules and do not expose API Gateway endpoints.

---

## 2. Go Lambda Service Audit (`services/checkin`)

### Codebase & Dependency Structure
- **Location**: `services/checkin/` (`main.go`, `main_test.go`, `go.mod`, `go.sum`, `bootstrap`)
- **Module Name**: `checkin`
- **Go Version**: `1.26.2`
- **Dependencies**:
  - `github.com/aws/aws-lambda-go v1.54.0` (Lambda handler & HTTP API V2 event structs)
  - `github.com/aws/aws-sdk-go-v2 v1.43.3`
  - `github.com/aws/aws-sdk-go-v2/config v1.32.16`
  - `github.com/aws/aws-sdk-go-v2/service/dynamodb v1.63.0`
  - `github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue v1.20.58`

### Handler Logic & Router Design
- **Entry point**: `main.go:242` (`lambda.Start(handler)`)
- **Router Pattern**: Manual string matching on `request.RequestContext.HTTP.Method` and `request.RequestContext.HTTP.Path`:
  ```go
  // main.go:86-97
  if method == "POST" && strings.HasSuffix(path, "/api/v1/check-in") {
      resp := handleCheckin(ctx, request)
      ...
  }
  if method == "GET" && strings.Contains(path, "/check-ins") {
      eventID := request.PathParameters["eventId"]
      resp := handleGetCheckins(ctx, eventID)
      ...
  }
  ```

### AWS SDK v2 & DynamoDB Usage
1. **Ticket Check-In (`handleCheckin`)**:
   - Step 1: Query GSI1 index using `GSI1PK = TICKET#<ticketId>`.
   - Step 2: Unmarshal item into `map[string]interface{}` via `attributevalue.UnmarshalMap`.
   - Step 3: Validate `status == "registered"`.
   - Step 4: Perform `TransactWriteItems`:
     - Update registration status from `registered` -> `checked_in` with `ConditionExpression: "#st = :registered"`.
     - Put audit record item (`PK: EVENT#<id>`, `SK: AUDIT#<iso_timestamp>`, `action: TICKET_CHECKED_IN`, `actor: email`).
2. **List Event Check-Ins (`handleGetCheckins`)**:
   - Query main table using `PK = EVENT#<eventId> AND begins_with(SK, REG#)`.
   - Iterate items, unmarshal, strip internal DB keys (`PK`, `SK`, `GSI1PK`, `GSI1SK`), count status `checked_in`, return total, count, and array of attendee maps.

### Error Handling & Data Marshaling
- `buildResponse` formats HTTP API V2 responses (`events.APIGatewayV2HTTPResponse`) with `Content-Type: application/json`.
- Standard JSON unmarshaling into Go structs:
  - `ErrorResponse` (`success: bool`, `message: string`, `errorCode: string`)
  - `CheckinRequest` (`ticketId: string`)
  - `CheckinResponse` (`checkedIn: int`, `total: int`, `attendees: []map[string]interface{}`)

### Code Quality & Defect Analysis
1. **Unsafe Type Assertion Risk (`main.go:140-143`)**:
   ```go
   pk := regItem["PK"].(string)
   sk := regItem["SK"].(string)
   email := regItem["email"].(string)
   ```
   *Issue*: If `email`, `PK`, or `SK` is missing, `nil`, or non-string, Go will panic (`interface {} is nil, not string`), producing an unhandled runtime error.
   *Fix Proposal*: Safe type extraction with fallbacks (`emailStr, ok := regItem["email"].(string)`).
2. **Nil Map Guard Missing (`main.go:93`)**:
   ```go
   eventID := request.PathParameters["eventId"]
   ```
   *Issue*: If `request.PathParameters` is `nil` (e.g. mock invocation or direct invoke), reading a map index on `nil` in Go returns empty string `""` without crashing, but causes `handleGetCheckins` to run `PK = EVENT#` query.

---

## 3. Go Test Suite Review (`services/checkin/main_test.go`)

### Current Test Coverage
`services/checkin/main_test.go` contains 4 unit tests:
1. `TestBuildResponse` (lines 8-22): Verifies HTTP status 200, Content-Type header, and JSON body serialization.
2. `TestBuildErrorResponse` (lines 24-43): Verifies 409 status code, `success: false`, and error code `INVALID_TICKET`.
3. `TestCheckinRequestParsing` (lines 45-55): Tests valid JSON deserialization of `{"ticketId": "abc-123"}`.
4. `TestCheckinRequestEmpty` (lines 57-64): Tests empty JSON `{}` deserialization.

### Identified Test Gaps
- **No Handler-Level Integration / Route Testing**: `handler()` is never invoked with mocked `events.APIGatewayV2HTTPRequest`.
- **No DynamoDB SDK Mocking**: Neither `handleCheckin` nor `handleGetCheckins` is unit-tested against a mocked DynamoDB client interface (e.g. AWS SDK v2 client interface / table mocks).
- **No Unmatched Route Test**: Unrecognized HTTP paths/methods (e.g., `POST /unknown`) are not tested to ensure they return 404.
- **No Panic / Edge-Case Tests**: Missing tickets, already checked-in tickets, and missing email attributes are not tested in Go.

---

## 4. OpenAPI Specification vs Implementation Audit Matrix

Comparing `openapi.yaml` against actual Lambda handlers (`services/events/app.py`, `services/registrations/app.py`, `services/checkin/main.go`) and Terraform infrastructure (`terraform/environments/dev/main.tf`):

| OpenAPI Path & Method | Target Service & File | OpenAPI Expected Request/Response | Implementation Actual Behavior | Discrepancy Status |
|---|---|---|---|---|
| `GET /api/v1/health` | `events`<br>`services/events/app.py:71` | Response 200:<br>`{ status, version, region, timestamp }` | Returns 200:<br>`{ status: "healthy", version: "1.0.0", region: "us-east-1", timestamp: "..." }` | ✅ **Match** |
| `GET /api/v1/events` | `events`<br>`services/events/app.py:81` | Response 200:<br>JSON Array `[ Event ]` | Returns 200:<br>JSON Object `{"events": [ Event ], "nextCursor": "..."}` | ❌ **SCHEMA MISMATCH** |
| `POST /api/v1/events` | `events`<br>`services/events/app.py:91` | Security: CognitoAuth<br>Request: `EventInput`<br>Response 201: `Event` | Auth: JWT Authorizer<br>Request: `name, date, venue, capacity`<br>Response 201: `Event` object | ✅ **Match** |
| `GET /api/v1/events/{eventId}` | `events`<br>`services/events/app.py:98` | Response 200: `Event`<br>Response 404: `Error` | Returns 200 with `Event` or 404 with `Error` | ✅ **Match** |
| `PUT /api/v1/events/{eventId}` | `events`<br>`services/events/app.py:103` | Security: CognitoAuth<br>Request: `EventInput`<br>Response 200: Description only | Auth: JWT Authorizer<br>Returns 200 with updated `Event` object | ⚠️ **Minor Difference** (Returns full updated object) |
| `DELETE /api/v1/events/{eventId}` | `events`<br>`services/events/app.py:109` | Security: CognitoAuth<br>Response 204: No Content | Auth: JWT Authorizer<br>Returns 204 with body `{}` | ⚠️ **Minor Payload Issue** (HTTP 204 shouldn't have body) |
| `POST /api/v1/events/{eventId}/register` | `registrations`<br>`services/registrations/app.py:37` | Request: `name, email, idempotencyKey`<br>Response 201: `Registration`<br>Response 409: `Error` | Request: `name, email, idempotencyKey`<br>Response 201: `Registration`<br>Response 409: `Error` | ✅ **Match** |
| `GET /api/v1/events/{eventId}/registrations` | `events`<br>`services/events/app.py:114` | Security: CognitoAuth<br>Response 200: `[ Registration ]`<br>*Spec notes CSV link* | Auth: JWT Authorizer<br>Returns 200: `[ Registration ]`<br>Supports `?format=csv` returning `text/csv` | ⚠️ **Missing Spec Parameter** (`?format=csv` unlisted in spec) |
| `GET /api/v1/events/{eventId}/check-ins` | `checkin` (Go)<br>`services/checkin/main.go:92` | Security: CognitoAuth<br>Response 200:<br>`{ checkedIn, total, attendees }` | Auth: JWT Authorizer<br>Returns 200:<br>`{ checkedIn, total, attendees }` | ✅ **Match** |
| `GET /api/v1/registrations/{ticketId}` | `registrations`<br>`services/registrations/app.py:45` | Response 200: `Registration` | Returns 200 with `Registration` or 404 Not Found | ✅ **Match** |
| `POST /api/v1/registrations/{ticketId}/cancel` | `registrations`<br>`services/registrations/app.py:52` | Response 200: Description | Returns 200 with `{"message": "Cancelled successfully, seat released"}` | ✅ **Match** |
| `POST /api/v1/check-in` | `checkin` (Go)<br>`services/checkin/main.go:86` | Request: `{ ticketId }`<br>Response 200: Description<br>Response 409: `Error` | Request: `{ ticketId }`<br>Response 200: `{"message": "Valid ticket, checked in"}`<br>Response 409: `ErrorResponse` | ✅ **Match** |
| `GET /api/v1/analytics` | `events`<br>`services/events/app.py:86` | Security: CognitoAuth<br>Response 200:<br>`{ totalEvents, totalRegistrations, attendanceRate, upcomingEvents }` | Auth: JWT Authorizer<br>Returns 200:<br>`{ totalEvents, upcomingEvents, totalRegistrations, attendanceRate }` | ✅ **Match** |

---

## 5. R2 E2E API Gateway Test Suite Analysis & Blueprint

Requirement R2 mandates an automated End-to-End test script (in Python or Go) that tests live or local API Gateway endpoints across the full event life-cycle.

### Required E2E Test Execution Sequence

```
[1. Health Check] -> GET /api/v1/health -> 200 OK
       │
[2. Create Event] -> POST /api/v1/events (Admin JWT) -> 201 Created (Extract eventId)
       │
[3. List Events]  -> GET /api/v1/events -> 200 OK (Verify eventId present in .events array)
       │
[4. Register]     -> POST /api/v1/events/{eventId}/register -> 201 Created (Extract ticketId)
       │
[5. Ticket Check] -> GET /api/v1/registrations/{ticketId} -> 200 OK (Status == "registered")
       │
[6. Check-in]     -> POST /api/v1/check-in (Go Service) -> 200 OK (Ticket checked in)
       │
[7. Verify Count] -> GET /api/v1/events/{eventId}/check-ins (Admin JWT) -> 200 OK (checkedIn == 1)
       │
[8. Analytics]    -> GET /api/v1/analytics (Admin JWT) -> 200 OK (attendanceRate updated)
```

### Proposed Changes for OpenAPI & Go Service Consistency
To support machine validation and seamless E2E testing:
1. **Update `openapi.yaml` GET `/events` Schema**: Update response schema from `type: array` to object schema `{ events: [Event], nextCursor: string }`.
2. **Add `format` parameter to GET `/events/{eventId}/registrations`**: Add query parameter `format: { type: string, enum: [csv] }` and `text/csv` media type to OpenAPI spec.
3. **Add Safety Guards to Go Check-in Handler**: Implement type assertion guards and nil-check on `request.PathParameters` in `services/checkin/main.go`.
