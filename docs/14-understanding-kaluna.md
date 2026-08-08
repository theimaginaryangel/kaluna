# Kaluna — The Whole Story, in Plain English

This is the "grab a coffee" guide to Kaluna. By the end you should be able to explain — out loud, without a laptop in front of you — what the system does, how it's built, why it's built that way, and how a ticket goes from "empty event page" to "door scanner beep."

If you want the formal, jargon-heavy versions, the other docs in `docs/` have you covered. This one is the tour guide.

---

## 1. What Kaluna actually is

Kaluna is a **ticketing platform for events**. Organizers create events, people register for them, they get a ticket (with a QR code) in their email, and at the door a scanner checks them in.

It was built because the "before" world was: a Microsoft Form to sign up, a spreadsheet to track who's coming, and someone manually crossing names off a list. Kaluna replaces that whole chain with an API, a database, a website, and a scanner — and it does it **without running a single server you have to babysit**. Everything runs on AWS "serverless" pieces that AWS manages for you.

The whole thing is one Python + Go + Next.js codebase, defined as code (Terraform), deployed automatically (GitHub Actions).

---

## 2. The big picture

Here's the entire system on one page:

```
                        ┌────────────────────────────────────────────┐
                        │  GitHub (the source of truth for code)     │
                        └───────────────┬────────────────────────────┘
                                        │ git push
                                        ▼
                     ┌──────────────────────────────────────────────┐
                     │  GitHub Actions (CI/CD pipeline)              │
                     │  test → build → terraform apply → smoke test  │
                     └───────────────┬──────────────────────────────┘
                                     │ creates / updates AWS resources
                                     ▼
   ┌──────────────┐     ┌─────────────────────────────────────────┐
   │  Browsers    │────▶│  API Gateway  /api/v1  (the front door) │
   │  (the site)  │     └───────┬─────────────┬───────────┬───────┘
   └──────────────┘             │             │           │
                        events │      registrations │   check-in
                        lambda │        lambda      │   (Go) lambda
                        (Python)│        (Python)    │
                                ▼             ▼           ▼
                          ┌─────────────────────────────────────────┐
                          │      DynamoDB  (one big table)           │
                          │  events · registrations · tickets · audit│
                          └───────────┬─────────────────────────────┘
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
                     Amazon SES              CloudWatch / X-Ray
                  (emails, QR, .ics)     (logs, alarms, tracing)

   Frontend: static Next.js site on S3 + CloudFront (the part people see)
```

Three arrows out of API Gateway = the three serverless "services" (Lambdas) that handle different jobs. More on each below.

---

## 3. A ticket's journey (the fun part)

Follow one person, "Ama," through the system:

1. **Ama opens the website** — a static Next.js app served from S3 + CloudFront. Fast, cheap, nothing to scale. It's just files in a bucket.
2. **She sees events** — the site calls `GET /api/v1/events`. API Gateway routes that to the **events Lambda**, which reads the events out of DynamoDB and returns them as JSON.
3. **She clicks "Get Pass"** — the site calls `POST /api/v1/events/{id}/register`. This hits the **registrations Lambda**. It checks the event exists, validates her email, then does the slickest part: **in one single atomic database transaction** it (a) decrements `seatsRemaining`, (b) writes her registration, and (c) writes an audit log entry. If two people register for the last seat at the exact same millisecond, **one wins and the other is told "Event is full"** — no overbooking, no locks, no queues.
4. **She gets the email** — the registrations Lambda asks **SES** to send a confirmation with her ticket ID and a QR code. There's even an `.ics` calendar file attached so she can one-click add it to her phone calendar.
5. **On the day, she scans the QR at the door** — the scanner (also a website) calls `POST /api/v1/check-in`. This hits the **check-in Lambda, written in Go**. It looks her ticket up, checks it's still `registered`, flips it to `checked_in` (again atomically, so the same ticket can't be scanned twice), and logs it. The front gate shows "Valid ticket, checked in ✅".
6. **The organizer watches the dashboard** — a live feed of who's checked in, how full events are, CSV exports of attendees, all from `GET /api/v1/analytics` and friends.
7. **The next day** — the **reminders Lambda** (a cron job) emails everyone who has an event tomorrow. After the event, the **feedback Lambda** emails attendees asking how it went.

That's the whole loop. Now let's look at each part in depth and — more importantly — **why it's built this way.**

---

## 4. The services, and why each one exists

### 4.1 `events` (Python Lambda) — the shopkeeper

**Job:** events themselves. Create, read, update, delete, list, plus analytics and the CSV export of registrations.

**Why Python?** Business logic like "is this event sold out?" is easy to write and read, and the AWS SDK (boto3) is first-class. Python is fast to develop, and event CRUD isn't latency-critical — nobody's standing in the cold refreshing the event list.

**Notable logic:**
- `compute_status()` — works out `available` / `limited` / `sold_out` from how many seats are left (≤20% left = "limited"). The site shows a colored bar and "N spots left" based on this.
- Every event write also writes an **audit log entry in the same transaction** — "who changed what, when" is never optional.
- This is the only service that talks to the **creator routes** (`/api/v1/creator/*`) and the **password-less creator identity** (more in §7).

### 4.2 `registrations` (Python Lambda) — the bouncer + the ticket printer

**Job:** the heart of the system. Register people, generate tickets, cancel registrations, and run the waitlist.

**Why Python again?** Same reasoning — plus this is where the tricky business rules live, and they're far easier to get right in Python.

**The coolest trick in the whole codebase** is in `register()`. Booking a seat isn't "check if full, then decrement" as two separate steps (a race). It's one `transact_write_items` call where the seat decrement has a *condition*: `seatsRemaining > 0`. If the condition fails, the **entire transaction rolls back atomically** — nobody gets a half-registration. This is how we never oversell a venue with zero explicit locks.

Other highlights:
- **Duplicate protection** — the registration's primary key is `REG#{email}`, written with `attribute_not_exists(SK)`. Register twice with the same email and the second write fails with `409 DUPLICATE_REGISTRATION`.
- **Email normalization** — emails are trimmed and lowercased before anything happens, so `  USER.CASING@EXAMPLE.COM ` and `user.casing@example.com` are the same person. (This fixed a real bug where the same person could "duplicate" register by changing case.)
- **Waitlist** — if the seat condition fails *and* the event has the waitlist enabled, the person is written as `waitlisted` instead of getting a refusal. When a registered ticket is cancelled, the **earliest waitlisted person is auto-promoted** — seat re-decremented atomically, status flipped to `registered`, and a "You're off the waitlist!" email with a real ticket is sent.
- **Self-service cancel** — `POST /registrations/{ticketId}/cancel`. The ticket ID (from the email) is the password, effectively. Cancelling releases the seat (if it was actually holding one) and fires the waitlist promotion.

### 4.3 `checkin` (Go Lambda) — the door scanner

**Job:** take a scanned ticket, validate it, mark it checked in, and answer "who's checked in so far?"

**Why Go? This is the one place where it truly matters.** Check-in happens live at the door, in front of a queue of people. Go starts up cold **much** faster than Python (milliseconds vs ~a second), and that latency difference is felt by real humans. The Go binary is compiled to a self-contained Linux executable (`bootstrap`) and runs on the `provided.al2023` runtime — no runtime to install, super fast cold start. This is a deliberate split: Python where development speed matters, Go where latency matters.

**Why is it worth having its own service at all?** Because it's the one path where the "slow" language could ruin the moment. Everything else can tolerate a second of cold start. The door scanner cannot.

Logic notes:
- Looks up the ticket via a **reverse index** (GSI1 — more in §6).
- Checks status is exactly `registered`, then flips to `checked_in` with a **conditional update**. Scan twice and the second scan gets `409 INVALID_TICKET` — no double-entry, enforced by the database, not by the app remembering things.
- **RBAC here too** — reading the check-in feed requires being the event's owner or an Admin (`isAdminOrOwner`). The Go service re-checks authorization rather than trusting the gateway to have done it.

### 4.4 `reminders` (Python Lambda) — the nudge

A scheduled worker (cron). Every day it finds events happening *tomorrow*, grabs all their registered attendees, and emails each one a reminder with their QR code.

### 4.5 `feedback` (Python Lambda) — the follow-up

A scheduled worker. After an event, it emails attendees asking how it went. Same shape as reminders, different message.

**Why are reminders/feedback separate Lambdas?** Because they're *background chores*, not things people request. Keeping them separate means (a) they can be triggered by a schedule instead of by HTTP, (b) their failures never take down a request path, and (c) each stays small and boring.

---

## 5. The front door: API Gateway

API Gateway is a single URL that receives every API call and routes it to the right Lambda. Base path: `/api/v1`.

| Method | Path | Who can call | What it does |
|---|---|---|---|
| GET | `/health` | anyone | "Is the API alive?" (used by the CI smoke test) |
| GET | `/events` | anyone | List events (filter by status, paginated) |
| GET | `/events/{eventId}` | anyone | One event's details |
| POST | `/events` | Cognito admin/creator | Create an event |
| PUT | `/events/{eventId}` | Cognito admin/creator | Edit an event |
| DELETE | `/events/{eventId}` | Cognito admin/creator | Delete an event |
| POST | `/events/{eventId}/register` | anyone | Register (or join waitlist) |
| GET | `/events/{eventId}/registrations` | admin/owner | List + CSV export attendees |
| GET | `/events/{eventId}/check-ins` | admin/owner | Live check-in feed |
| GET | `/registrations/{ticketId}` | anyone | Look up a ticket by code |
| POST | `/registrations/{ticketId}/cancel` | anyone* | Cancel a registration |
| POST | `/check-in` | anyone* | Check in a scanned ticket |
| GET | `/analytics` | Cognito admin/creator | Platform/creator stats |
| GET | `/creator/events`, `/creator/analytics`, `/creator/events/{id}/registrations` | creator (email header) | Same as above but scoped to one creator's email |

\* Cancel and check-in are "public" *on purpose* — the ticket ID itself is the credential. For cancel, it's emailed to the owner and scoped to exactly that one ticket. For check-in, the scanner device can't do a full login dance, and every scan is written to the audit log anyway.

**A routing gotcha that mattered:** `/events/{eventId}/registrations` must be matched *before* the generic `/events/{eventId}` route, or the list-of-attendees request gets swallowed as "get one event with a weird ID." Route precedence was a real, fixed bug.

The full machine-readable contract lives in `openapi.yaml` — you can import it into Postman or Swagger UI and get a clickable, documented API for free.

---

## 6. The database: one table to rule them all

Kaluna uses **a single DynamoDB table** (`KalunaTable`). That sounds like a mistake, but it's a well-known serverless design pattern. Here's the shape:

| What | Primary key (PK) | Sort key (SK) |
|---|---|---|
| An event | `EVENT#{eventId}` | `METADATA` |
| A registration | `EVENT#{eventId}` | `REG#{email}` |
| A ticket (lookup by QR) | `TICKET#{ticketId}` | `METADATA` (stored in a secondary index, GSI1) |
| An audit log entry | `EVENT#{eventId}` | `AUDIT#{timestamp}` |

**Why one table?** Because everything for one event already shares a key — you can grab an event, all its registrations, and all its audit entries with three simple queries on the same partition. One table, one set of access patterns, fewer round-trips, and the whole system is one thing to reason about instead of five tables to join in your head.

**Why DynamoDB at all (vs a database like RDS/PostgreSQL)?** Because it's *serverless-native*: it scales to zero when nothing's happening (costing you almost nothing), scales up automatically when a popular event drops, and a Lambda doesn't have to manage connection pools — it just makes a request. For this project's scale, DynamoDB is the right amount of machinery.

**The seat-counting magic, once more, in DB terms:**

```python
UpdateExpression: "SET seatsRemaining = seatsRemaining - :one"
ConditionExpression: "seatsRemaining > :zero"
```

Wrapped inside a `transact_write_items` with the registration write. The database itself guarantees you can never decrement below zero. No application logic, no locks — the *database* enforces it. That's the cleanest kind of correctness.

**The audit log is a real trail, not just logs.** Every state-changing action writes an `AUDIT#` item in the same transaction as the change it describes: event created/edited/deleted, registration created/cancelled, ticket checked in, duplicate scan blocked. It never gets updated or deleted. This powers the "recent activity" on the dashboard and gives you forensic history if you ever need it.

---

## 7. Who's who: the auth model

There are **three** kinds of actors, deliberately, because the real world has three kinds:

1. **Platform Admins ("Godmode")** — sign in with **Cognito** (username + password). Cognito hands back a JWT. The JWT's `cognito:groups` claim says "this user is an Admin." These routes are protected by the API Gateway JWT authorizer **and** re-checked in the Lambdas. They can see every event, every organizer's registrations, everything.
2. **Creators** — people who just want to manage *their own* events. They get a **password-less login** (just an email). The frontend sends that email as an `X-Creator-Email` header, and the backend filters everything by it: a creator literally cannot see another creator's data because every query is scoped to their email. The database does the policing.
3. **Public (attendees)** — no account at all. Register, get a ticket, scan it, cancel it. The ticket ID is the credential for the ticket-related actions.

**Why this hybrid?** Admins need real security (accounts, passwords, sessions). Creators would abandon the product if they had to be provisioned accounts before trying it — so email-as-identity gets them in with zero friction. Attendees don't need accounts at all; that's the whole point.

**A real-world bug this taught us:** Cognito JWTs give you `cognito:groups` as an **array**, but the dashboard code once assumed it was a string and called `.replace()` on it — which crashed the whole admin page with `TypeError: ... .replace is not a function`. The fix was to handle both shapes (array or string) defensively. JWT claims are data from an external system: never trust their type.

---

## 8. Deployment: from `git push` to "it's live"

The `deploy.yml` GitHub Actions workflow is the entire release process, and it's gated on tests passing first:

1. **Test** — run the Pytest suites (`events`, `registrations`) and `go test` (`checkin`). Red tests = no deploy.
2. **Terraform plan + apply** — if the branch is `main`, that's **prod**; otherwise it's **dev**. Same Terraform modules, environment-scoped variables (`kaluna-dev-*` vs `kaluna-prod-*`), separate states. `develop` → dev, `main` → prod.
3. **Build the Go binary** for Linux (`CGO_ENABLED=0`) so the check-in Lambda has its fast native runtime.
4. **Smoke test** — curl the freshly deployed `/api/v1/health` until it returns 200 (with retries, because a cold-starting API might be a beat slow right after deploy). No 200 = the pipeline fails loudly.
5. **Frontend (prod only)** — `npm run build` the Next.js app, `aws s3 sync` the static output to S3, then **invalidate the CloudFront cache** so visitors get the new files, not stale cached ones.

Every environment is **infrastructure as code** — nothing is clicked into the AWS console that isn't in `terraform/`. If a laptop dies, the entire platform can be rebuilt from a `git clone`.

---

## 9. "Why did you pick that?" — the cheat sheet

| Question | Answer in one line |
|---|---|
| Why serverless (Lambda/DynamoDB/SES)? | Zero servers to patch, scales to zero cost, AWS handles the boring ops. |
| Why DynamoDB over a traditional DB? | Serverless-native, no connection pools, one table fits the access patterns. |
| Why one table? | Everything for an event already shares a key; simpler and fewer round-trips. |
| Why Terraform over CloudFormation/SAM? | Industry-standard IaC, works across clouds, transferable skill. |
| Why Python for most services? | Fast to write, boto3 is excellent, these paths aren't latency-critical. |
| Why Go just for check-in? | Cold start ~milliseconds vs ~seconds — the one path where humans wait in line. |
| Why Cognito? | Managed, free within this usage, no hand-rolled session/token code. |
| Why a static Next.js frontend? | It's mostly a read-heavy brochure + forms; static files on S3/CloudFront are fast and nearly free. |
| Why a JWT authorizer *plus* in-Lambda checks? | Defense in depth, and the Lambdas need the group claim anyway for fine-grained decisions. |
| Why keep a public API contract (`openapi.yaml`)? | The code and the docs can't drift apart silently; Postman/Swagger get it for free. |

For the long, formal reasoning, see `docs/adr/`.

---

## 10. A map of the codebase

```
kaluna/
├── .github/workflows/
│   ├── deploy.yml          # the whole CI/CD pipeline
│   └── docs.yml
├── services/
│   ├── events/             # Python Lambda — event CRUD, analytics, CSV
│   │   ├── app.py
│   │   └── tests/
│   ├── registrations/      # Python Lambda — register, ticket, waitlist, cancel, email
│   │   ├── app.py
│   │   └── tests/
│   ├── checkin/            # Go Lambda — scan, check in, feed (+ RBAC)
│   │   ├── main.go
│   │   └── main_test.go
│   ├── reminders/          # Python cron — "your event is tomorrow" emails
│   ├── feedback/           # Python cron — post-event survey emails
│   └── e2e/                # end-to-end test runner against the live API
├── frontend/
│   └── src/
│       ├── app/            # Next.js pages: /, /events, /lookup, /checkin,
│       │                   #   /success, /cancel, /admin/dashboard, ...
│       ├── components/     # UI pieces (buttons, cards, forms, QR ticket)
│       └── lib/            # api.ts (the browser→API client), types, utils
├── terraform/
│   ├── modules/            # api_gateway, cognito, dynamodb, frontend,
│   │                       #   iam, monitoring, ses
│   └── environments/       # dev / staging / prod
├── scripts/seed-events.json # demo events for seeding the dev DB
├── openapi.yaml            # the API contract
└── docs/                   # the rest of this story, in detail
```

---

## 11. The little war stories (bugs that shaped the code)

The most educational part of any codebase is its scars:

- **The ghost seat.** A cancelled registration used to free a seat in one place but not another, so capacity drifted wrong over time. Fixed by making *every* seat change a single transactional unit.
- **The 404 that wasn't.** Some routes returned the wrong status codes (e.g. `404` being swallowed). Milestone 1 was partly about aligning routing and status codes so the API *means* what it says.
- **The case-sensitivity duplicate.** `User@X.com` and `user@x.com` could both register. Now every email is normalized before it touches the database.
- **The `cognito:groups` crash.** The admin dashboard assumed a JWT claim was a string and called `.replace()` on an array → whole page crashed. Defensive handling of external data types fixed it.
- **The per-event CSV that exported only the first event.** The export route looked up the wrong thing; now it's scoped per event and includes waitlisted attendees.
- **The Go panic guards.** The check-in service guards against nil clients and malformed input so a bad scan can't crash the whole Lambda.

Each of these is documented in its service's tests — the tests exist because the bugs existed.

---

## 12. Where it goes from here

The roadmap (`docs/12-future-roadmap.md`) is honest about what's done vs. what's cut: calendar invites (`.ics`) are code-complete, reminders and post-event feedback are shipped, RBAC is live. Future candidates include things that were deliberately cut from v1 to keep the build shippable — the ADRs and roadmap list them, along with why they were deferred.

The system was built to be *engineered like a production system*: automated tests, infrastructure as code, real observability (CloudWatch logs + X-Ray tracing), a public API contract, and audit logging you could actually hand to an auditor. That's the whole point — a capstone project that behaves like something you could trust with a real venue's door.
