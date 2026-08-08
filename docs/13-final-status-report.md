# Kaluna — Comprehensive Engineering Report & Architecture Guide

> **Document Purpose**: This is the complete technical walkthrough and presentation guide for **Kaluna**. It explains every architectural layer, database design decision, security boundary, and deployment pattern in plain, direct language so you can confidently explain and defend every detail of this project in a Q&A or live demo.

---

## A. Problem & Motivation

### What Kaluna Replaces
Kaluna replaces fragile manual event workflows (Google Forms + Google Sheets/Excel + manual email sending).

### Why Traditional Solutions Break Down at Scale
1. **Race Conditions & Overbooking**: When 50 people submit a Google Form at the exact same second for an event with 5 remaining tickets, a spreadsheet records all 50 entries. There is no concurrency control or atomic lock, leading to embarrassing overbooking.
2. **Slow Door Check-Ins**: Searching for names on a PDF or spreadsheet at the door creates huge queues. Venue doors require instant sub-second validation.
3. **No Centralized Authorization**: Spreadsheets lack row-level or event-level permissioning. Event creators can easily inspect or overwrite data from other organizers.
4. **Server Cost & Maintenance**: Running traditional server stacks (like Node/Express on EC2 or Docker containers) incurs 24/7 hosting fees even when no events are actively being registered for.

---

## B. Architecture & End-to-End Request Flows

```
[User Browser / Client]
        │
        ├── Static Assets ──▶ [CloudFront CDN / S3 Bucket] (Next.js Static Export)
        │
        └── API Requests ───▶ [Custom Domain: apikaluna.bennyduah.com]
                                       │
                                [API Gateway HTTP API] (/api/v1/...)
                                       │
                         ┌─────────────┼─────────────┐
                         ▼             ▼             ▼
                   [Events Lambda] [Reg Lambda] [Check-in Go Lambda]
                    (Python 3.11) (Python 3.11)    (Go 1.21)
                         │             │             │
                         └─────────────┼─────────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
                 [DynamoDB Table]             [Amazon SES]
                (Single-Table Design)    (ICS Email Invites)
```

### Walkthrough 1: User Event Registration
1. **Browser to Custom Domain**: User submits the registration form on Next.js (`/events/[id]`). A JSON `POST` request is sent to `https://apikaluna.bennyduah.com/api/v1/events/{eventId}/register`.
2. **API Gateway**: Receives the request on the `$default` stage, generates a unique `X-Request-ID` header, checks CORS permissions, and proxies the payload via `AWS_PROXY` to the `kaluna-prod-registrations` Lambda.
3. **Registrations Lambda (Python)**:
   - Validates input format (email regex, required fields).
   - Queries DynamoDB to ensure the event exists.
   - Executes an **Atomic TransactWriteItem** (see Section C) that decrements `seatsRemaining` IF AND ONLY IF `seatsRemaining > 0` AND the user is not already registered (`attribute_not_exists`).
4. **DynamoDB**: Atomically commits the registration item (`EVENT#{eventId}` / `REG#{email}`), audit record, and updates event metadata in a single ACID transaction.
5. **Amazon SES**: The Lambda constructs a MIME multipart raw email containing an HTML confirmation and an `.ics` calendar attachment (`generate_ics()`) and dispatches it via `ses.send_raw_email`.
6. **Response**: HTTP 201 Created with the `ticketId` and registration details is returned to the client.

### Walkthrough 2: Venue Check-In (Go Service)
1. **Scanner to API**: Door staff scans the attendee's QR code containing the `ticketId`. A `POST` request is sent to `/api/v1/check-in` with `{"ticketId": "..."}`.
2. **Check-In Go Lambda**: High-performance Go binary compiled for `provided.al2023`.
3. **Lookup & Verification**: Queries DynamoDB GSI1 (`TICKET#{ticketId}`) to retrieve the registration item. Checks if `status == "registered"`.
4. **Atomic TransactWriteItem**: Updates `status` to `"checked_in"` with a `ConditionExpression: status = "registered"`. If another door scanner scanned the exact same ticket 50ms earlier, the second transaction fails with a `ConditionalCheckFailedException`.
5. **Response**: Returns HTTP 200 OK for successful check-ins, or HTTP 409 Conflict with `INVALID_TICKET` error code if scanned twice.

### Walkthrough 3: Admin Auth & Event Management (Cognito)
1. **Login**: Admin logs in via `/admin/login`. Cognito User Pool authenticates credentials and returns a signed JWT Bearer Token containing claims (`sub`, `cognito:groups`).
2. **API Authorization**: When the admin creates or edits an event (`POST /api/v1/events`), the Authorization header `Bearer <JWT>` is validated directly at API Gateway using `aws_apigatewayv2_authorizer.jwt_auth`.
3. **Role Enforcement**: The Events Lambda parses `cognito:groups`. If the caller is in the `Creator` group, queries are scoped to `ownerId == caller_id`. If in `Admin` (Godmode), restrictions are bypassed.

---

## C. Database Design & Atomic Operations

### Single-Table Design Schema
Kaluna uses a single DynamoDB table (`kaluna-prod-table`) to satisfy all access patterns without SQL joins or multi-table overhead.

| PK (Partition Key) | SK (Sort Key) | GSI1PK (Secondary Index) | GSI1SK | Attributes | Description |
|---|---|---|---|---|---|
| `EVENT#{eventId}` | `METADATA` | `STATUS#{status}` | `DATE#{date}` | `name`, `date`, `venue`, `capacity`, `seatsRemaining`, `ownerId` | Event record |
| `EVENT#{eventId}` | `REG#{email}` | `TICKET#{ticketId}` | `METADATA` | `ticketId`, `name`, `email`, `status`, `registeredAt` | Registration record |
| `EVENT#{eventId}` | `AUDIT#{iso}` | — | — | `action`, `actor`, `details` | Append-only audit log |

### Primary Access Patterns & Queries
1. **Get Event Detail**: `GetItem(PK = "EVENT#123", SK = "METADATA")`. Fast $O(1)$ key lookup.
2. **Get Ticket by Code**: Query `GSI1` where `GSI1PK = "TICKET#abc-123"`. Returns registration item instantly without scanning events.
3. **Get All Registrations for Event**: Query `PK = "EVENT#123" AND begins_with(SK, "REG#")`. Retrieves only that event's registered attendees.

### Atomic Seat Decrement & Overbooking Prevention
To prevent overbooking when 100 concurrent requests arrive simultaneously for 1 remaining seat:

```python
dynamodb.meta.client.transact_write_items(
    TransactItems=[
        {
            'Update': {
                'TableName': table_name,
                'Key': {'PK': f"EVENT#{event_id}", 'SK': "METADATA"},
                'UpdateExpression': "SET seatsRemaining = seatsRemaining - :one",
                'ConditionExpression': "seatsRemaining > :zero",
                'ExpressionAttributeValues': {':one': 1, ':zero': 0}
            }
        },
        {
            'Put': {
                'TableName': table_name,
                'Item': reg_item,
                'ConditionExpression': "attribute_not_exists(SK)"
            }
        }
    ]
)
```
- **Why this works**: DynamoDB isolation guarantees only ONE transaction succeeds when `seatsRemaining == 1`. The remaining 99 transactions fail atomically, triggering fallback to waitlist or `EVENT_FULL` (HTTP 409).

---

## D. Feature Matrix: Technical Implementation & Status

| Feature | User Functionality | Technical Implementation | Verified Status |
|---|---|---|---|
| **Event CRUD** | Create, view, update, delete events | Python `events` Lambda with JSON validation, pagination cursors, and transactional audit logging. Delete button in admin dashboard calls `DELETE /api/v1/events/{id}` with JWT auth and confirmation dialog. | **LIVE-TESTED** |
| **Registration** | Sign up for event, receive confirmation | Python `registrations` Lambda with email regex validation, idempotency checks, and DynamoDB transactions. | **LIVE-TESTED** |
| **Capacity Locking** | Prevents overselling event seats | Conditional expressions (`seatsRemaining > 0`) inside DynamoDB TransactWriteItems. | **LIVE-TESTED** |
| **QR Check-in** | Scan tickets at the door | Go Lambda service using SDK v2, querying GSI1 and executing atomic status transitions (`registered` → `checked_in`). Fixed `PayloadFormatVersion` from `1.0` → `2.0` on all three API Gateway integrations. | **LIVE-TESTED** |
| **Live Check-In Feed** | Real-time attendee stream in admin dashboard | Dashboard fetches `GET /api/v1/events/{eventId}/check-ins` for all events in parallel via `Promise.allSettled`, filters `checked_in` status, sorts by time. | **LIVE-TESTED** |
| **Per-Role Analytics** | Different stats for Creator vs Admin tabs | Creator tab computes stats scoped to `displayedEvents` (registrations = `capacity - seatsRemaining`, check-ins filtered by eventId). Admin tab shows platform-wide API totals. | **LIVE-TESTED** |
| **Automated Waitlists** | Overflow queue when full; join from the registration form | Registrations Lambda catches `ConditionalCheckFailedException`, writes user to `status: "waitlisted"`. On cancellation, auto-promotes earliest waitlisted user. Full frontend UX: "Join Waitlist" button on sold-out events, waitlist confirmation page (`/success?waitlist=1`), per-event waitlist toggle in the event form, waitlist-attendees panel in the dashboard. | **LIVE-TESTED** |
| **Self-Service Cancellation** | Cancel a registration from the confirmation email | `POST /api/v1/registrations/{ticketId}/cancel` releases the seat and auto-promotes the next waitlisted attendee. Confirmation email now carries a "Cancel your registration" link to the `/cancel` page. Ticket ID is the bearer credential. | **LIVE-TESTED** |
| **Calendar Invites** | 1-click Google/Apple calendar add | Python MIME multipart email generator (`generate_ics()`) attaching standard RFC 5545 `event.ics` files via SES. | **ROUTE-EXISTS / CODE-COMPLETE** |
| **Attendance Count** | Honest "N going" social proof | `AvatarStack` component shows the real `capacity - seatsRemaining` count per event with a users icon; returns `null` when 0 registered. (Fabricated DiceBear avatar images removed.) | **LIVE-TESTED** |
| **RBAC / Godmode** | Creator vs Admin access split | Cognito User Groups (`Admin`, `Creator`) checked at API Gateway JWT authorizer & Lambda layer (`cognito:groups` claim filtering `ownerId`). | **ROUTE-EXISTS / CODE-COMPLETE** |
| **Admin Dashboard** | Live stats & event management | Next.js App Router client dashboard with capacity progress bars, real-time check-in stream, **per-event CSV export**, live "checked-in / registered" badges, expandable waitlist lists per event, delete with confirmation, and client session guard. | **LIVE-TESTED** |
| **Public Capacity Bars** | See fill level on event cards | Each card renders "N registered • X% full" with a pink/amber/rose fill bar (rose = full). | **LIVE-TESTED** |

---

## E. Security Model

1. **Two-Layer Protection Architecture**:
   - **Layer 1 (Real Security Boundary)**: AWS API Gateway JWT Authorizer + Lambda Claims Parser. Every write/admin endpoint (`POST /events`, `PUT /events/{id}`, `DELETE /events/{id}`, `GET /analytics`) requires a valid Cognito JWT. Requests without a valid Bearer token are rejected at the edge with **HTTP 401 Unauthorized**.
   - **Layer 2 (Frontend UX Guard)**: Next.js client-side check (`localStorage.getItem('kaluna_jwt_token')`). Redirects unauthenticated users to `/admin/login`. This is purely for user experience—the true security gate is the API.

2. **IAM Least-Privilege Design**:
   - Each Lambda function has its own dedicated IAM role (e.g. `kaluna-prod-events-role`, `kaluna-prod-checkin-role`).
   - The Check-in service has read/write access ONLY to DynamoDB; it cannot send SES emails.
   - The Registrations service has SES send permissions but cannot alter event pricing or metadata.

---

## F. Infrastructure & CI/CD Deployment

### Terraform Module Architecture
- `terraform/modules/api_gateway`: Provisions HTTP API Gateway, CORS policies, `$default` auto-deploy stage, throttling limits.
- `terraform/modules/dynamodb`: Provisions single table, GSI1, OwnerIndex, billing mode (`PAY_PER_REQUEST`).
- `terraform/modules/cognito`: Provisions User Pool, App Client, and `Admin` / `Creator` User Groups.
- `terraform/modules/ses`: Verifies email identities and domain configurations.
- `terraform/modules/iam`: Creates scoped, least-privilege IAM roles per Lambda.
- `terraform/modules/monitoring`: CloudWatch dashboard, metric alarms (throttles, errors), X-Ray tracing.

### GitHub Actions CI/CD Pipeline (`.github/workflows/deploy.yml`)
- **Triggers**: Pushes to `develop` deploy to `dev`; pushes to `main` deploy to `prod`.
- **Pipeline Stages**:
  1. **Test Job**: Runs Python `pytest` (with `moto` mocks) and Go `go test` unit suites.
  2. **Build Job**: Compiles Go binary (`GOOS=linux GOARCH=amd64`) and zips Python Lambda services.
  3. **Credentials**: Configures AWS credentials via `aws-actions/configure-aws-credentials@v2` using repository secrets.
  4. **Terraform Apply**: Runs `terraform init`, `terraform plan`, and `terraform apply -auto-approve`.
  5. **Smoke Test**: Executes automated curl test against `https://apikaluna.bennyduah.com/api/v1/health`.

---

## G. Challenges Faced & Solutions

1. **Local STS Network Block**:
   - *Problem*: Local machine environment suffered DNS lookup failures (`dial tcp: lookup sts.us-east-1.amazonaws.com: no such host`) when attempting local `terraform apply`.
   - *Solution*: Leveraged the GitHub Actions automated CI/CD pipeline. Pushing code to `main` allows GitHub's cloud runners to authenticate cleanly and execute Terraform apply remotely.

2. **Terraform Lock Drift**:
   - *Problem*: Interrupted local terraform operations left a stale lock ID in the `kaluna-terraform-locks` DynamoDB table.
   - *Solution*: Identified drift using `aws apigatewayv2 get-apis`, verified no duplicate infrastructure existed, updated `providers.tf` mock credentials to release the lock cleanly.

3. **Font Rendering & Offline Next.js Fallbacks**:
   - *Problem*: Next.js build failed to fetch Google Fonts (`Inter`) during offline build steps.
   - *Solution*: Updated `layout.tsx` to use `Montserrat` and `Open_Sans` with `display: 'swap'` and native CSS font-family stack fallbacks in `globals.css`.

---

## H. Design System

- **Core Aesthetic**: Clean, high-contrast white base with bold editorial typography (Montserrat headings + Open Sans body).
- **Hot Pink Accent Rule (`#FF2D87`)**: Reserved **strictly for motion and interaction** (hover glows, focus rings, active underlines, ripple effects, animated progress fills). Never used for static background blocks or decorative fills.
- **Motion Curves**:
  - Apple Spring Easing: `cubic-bezier(0.25, 0.1, 0.25, 1)` for smooth page transitions and drawer reveals.
  - Material Bouncy Easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` for direct button presses and card hover elevation.

---

## I. Live Status Summary

- **Live Public Custom API**: `https://apikaluna.bennyduah.com/api/v1` (Healthy, HTTP 200 OK)
- **Git State**: Clean, all changes committed and pushed to `main`.
- **Frontend Export**: Static Next.js export (`output: 'export'`) compiled successfully (public pages, admin console, check-in scanner, ticket lookup, success, and self-service `/cancel`).
- **Prod DynamoDB**: 7 events seeded (6 demo + 1 real test event). All registrations and check-ins live.
- **Recent fixes committed**: Check-in 404 (PayloadFormatVersion), live check-in feed, per-role analytics, event delete, ticket-lookup field mapping (`ticketCode` → `ticketId`), per-event CSV export, waitlist UX, self-service cancellation, capacity bars.

---

## J. Cost & Observability

- **Monthly Hosting Cost**: **$0.00 / Month (Fits 100% within AWS Free Tier)**:
  - Lambda: 1 Million free requests/month.
  - DynamoDB: 25 GB storage + 25 WCU / 25 RCU free tier.
  - API Gateway: 1 Million HTTP requests free/month.
  - SES: 62,000 free outbound emails/month when sent from Lambda.
- **Cost Guardrail**: AWS Budget configured via Terraform to send an instant email alert if total monthly spend exceeds **$1.00 USD**.
- **Observability**: CloudWatch Dashboard (`Kaluna-Prod-Dashboard`), metric alarms on 5XX errors and Lambda throttling, AWS X-Ray active tracing on API Gateway → Lambda.

---

## K. Key Architectural Decisions (ADR Summary)

1. **DynamoDB Single-Table over Multi-Table**: Eliminates relational joins and connection pool limits inside serverless Lambdas.
2. **Python + Go Split**: Python for main business logic (speed of development), Go for check-in Lambda (sub-50ms cold starts at event doors).
3. **HTTP API over REST API**: API Gateway v2 HTTP APIs are 70% cheaper and offer lower latency than v1 REST APIs.
4. **Cognito JWT over Custom Auth**: Standardized OAuth2/OIDC JWT tokens validated natively at API Gateway edge without executing custom Lambda authorizer code on every request.

---

## L. Live URLs & Suggested Demo Script

### Live URLs
- **API Endpoint**: `https://apikaluna.bennyduah.com/api/v1/health`
- **GitHub Repository**: `https://github.com/theimaginaryangel/kaluna`

### Suggested Live Q&A / Demo Flow
1. **Show Landing Page (`/`)**: Point out the editorial typography, category filtering, and the live "N going" attendance count on each event card.
2. **Demonstrate Motion System**: Hover over event cards and buttons to show the `#FF2D87` hot pink bouncy elevation and click ripples.
3. **Register for Event (`/events/[id]`)**: Submit a registration. Show instant validation, capacity decrement, and QR ticket generation on `/success`.
4. **Security Proof (Terminal)**: Open terminal and run:
   ```bash
   curl.exe -i -X POST https://apikaluna.bennyduah.com/api/v1/events
   ```
   Show the evaluator the **HTTP 401 Unauthorized** response, proving the API Gateway JWT security layer is active.
5. **Admin Console (`/admin`)**: Log in, show the "My Events" vs "All Events" RBAC toggle tabs, capacity fill progress bars, per-event CSV export, checked-in badges, and the live check-in stream.
6. **Waitlist + Cancellation (`/events/[id]` + email)**: On a sold-out waitlist-enabled event, submit a registration and land on the waitlist confirmation page. From the confirmation email, hit the "Cancel your registration" link → `/cancel` → watch the seat release and the next waitlisted attendee get auto-promoted.
