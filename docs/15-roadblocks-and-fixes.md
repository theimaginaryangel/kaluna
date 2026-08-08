# Kaluna — Roadblocks: What Broke, Why, and How We Fixed It

A plain-English account of every significant roadblock this project hit, what caused it, and the commit that fixed it. Read this after `docs/14-understanding-kaluna.md` — together they tell the whole story: what the system is, and how it got scars.

Every entry lists the symptom, the root cause, the fix, and the commit(s) involved. Line numbers in code change as the code evolves; the lesson is the permanent part.

---

## Phase A — Infrastructure & Bootstrap (the first days)

### A1. The API had no health route
- **Symptom:** The CI pipeline's smoke test had nothing to hit. `/api/v1/health` simply didn't exist.
- **Cause:** The health check was defined in the Lambda code early, but the API Gateway **route** for `GET /api/v1/health` was missing from the Terraform.
- **Fix:** Added the `health_get` route to the API Gateway in all three environments (dev/staging/prod).
- **Commit:** `733c0d6`

### A2. Python syntax error in the registrations service
- **Symptom:** The registrations Lambda failed to import at deploy / test time.
- **Cause:** A syntax error slipped into `services/registrations`.
- **Fix:** Corrected the syntax.
- **Commit:** `23ec90d`

### A3. Unused Go variable and import in the check-in service
- **Symptom:** `go build` failed.
- **Cause:** Go refuses to compile with an unused variable or unused import — a leftover variable from an edit.
- **Fix:** Removed the unused variable and import.
- **Commit:** `b1d1c72`

### A4. Terraform `count` error on DynamoDB access
- **Symptom:** `terraform apply` failed with a `count` error in the IAM module.
- **Cause:** The DynamoDB policy used `count = var.dynamodb_table_arn != "" ? 1 : 0`, which breaks when the value isn't set as expected across modules.
- **Fix:** Replaced the string-comparison `count` with an explicit boolean variable `enable_dynamodb_access` (default `true`) — much clearer and less fragile.
- **Commit:** `e998f65`

### A5. The whole infrastructure was in the wrong region
- **Symptom:** SES email sending and other service behaviors weren't right from the original region.
- **Cause:** The project was initially scaffolded outside `us-east-1`, where SES is in limited mode by default.
- **Fix:** Migrated all infrastructure to `us-east-1` (one-line `providers.tf` change per environment plus rebuilt Lambda zips).
- **Commit:** `b6bd4f7`

### A6. "Object of type Decimal is not JSON serializable"
- **Symptom:** Every API response that contained a number from DynamoDB crashed with a 500 and a Python `TypeError`.
- **Cause:** boto3 returns DynamoDB numbers as `decimal.Decimal`, and the Lambdas were calling `json.dumps(body)` with no handler for `Decimal`.
- **Fix:** Added a `_decimal_to_native()` helper (integral `Decimal` → `int`, else → `float`) and wired it into `json.dumps(body, default=...)` in the shared `utils.py` of both the `events` and `registrations` services.
- **Commit:** `6023531`

### A7. Route precedence: `/events/{eventId}/registrations` was being swallowed
- **Symptom:** Listing an event's registrations/attendees returned "get one event with a weird ID" — the sub-resource route never matched.
- **Cause:** API Gateway V2 matches routes by path pattern, and a generic `/events/{eventId}` route declared *before* `/events/{eventId}/registrations` grabs the request first.
- **Fix:** Declared the more specific route **before** the generic one, and verified route order in both the Terraform and the OpenAPI spec.
- **Commit:** verified/fixed as part of the multi-agent audit (`b916067`), documented in `docs/04-api.md`

---

## Phase B — CI/CD & Testing (the pipeline was a sieve)

### B1. Moto upgraded, tests broke
- **Symptom:** Python service tests failed on `mock_dynamodb2` / `mock_*` decorators.
- **Cause:** Moto v5 replaced the old per-service mock decorators with a single `mock_aws`. The test suites still used the old names.
- **Fix:** Migrated tests to `mock_aws`, first as a quick swap (`bccfdc4`), then by wrapping the **entire test lifecycle** in the `mock_aws` context so table setup happens inside the mock (`0befa45`).
- **Commit:** `bccfdc4`, `0befa45`

### B2. Smoke test failed right after deploy
- **Symptom:** Deploy succeeded but the health smoke test 404'd/failed intermittently.
- **Cause:** API Gateway takes a few seconds to propagate after `terraform apply` returns; the single-shot curl fired too early.
- **Fix:** Replaced the one-shot curl with a **retry loop** (up to 6 attempts, 5s apart) until `/api/v1/health` returns 200 — fail loudly only if it never becomes ready.
- **Commit:** `3fa1140`

### B3. Terraform plan failed: the Go binary didn't exist yet
- **Symptom:** CI's `terraform plan` errored on the check-in Lambda's source archive.
- **Cause:** The Go `bootstrap` binary is a build artifact; the workflow ran Terraform before compiling it.
- **Fix:** Added a "Build Check-in binary" step (`CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bootstrap main.go`) **before** Terraform init/plan.
- **Commit:** `ae837e2`

### B4. "No credentials" in the deploy job
- **Symptom:** `terraform apply` failed immediately with missing AWS credentials.
- **Cause:** The workflow referenced secrets but never configured them into the runner environment.
- **Fix:** Added the standard `aws-actions/configure-aws-credentials` step before Terraform commands.
- **Commit:** `0ae376c`

### B5. Terraform state: local-only, then lock drift
- **Symptom:** Local runs hit `dial tcp: lookup sts.us-east-1.amazonaws.com: no such host` (network-blocked machine), and an interrupted local apply left a stale lock in the DynamoDB lock table.
- **Cause:** The project started with local Terraform state and local execution; the local environment couldn't reach AWS STS, and an interrupted run orphaned the state lock.
- **Fix:** Moved to an **S3 remote backend** with DynamoDB locking so state lives in the cloud and CI executes all applies; recovered the stale lock cleanly (verified no duplicate infra, updated mock credentials to release it).
- **Commit:** `9fe4cb6` (documented in `docs/13-final-status-report.md` §G)

### B6. Terraform 1.5.7 compatibility
- **Symptom:** `terraform plan` complained about a resource/config incompatibility.
- **Cause:** Config was written against a newer Terraform version than the pinned `1.5.7` in CI.
- **Fix:** Reworked the incompatible declaration (used `dynamodb_table` resource form compatible with 1.5.7) in the environment providers.
- **Commit:** `81abcc8`

### B7. Test fixtures didn't include the new JWT claims
- **Symptom:** Event service tests broke after auth was added.
- **Cause:** The handlers started reading `cognito:groups` from the request context, but the test fixtures mocked requests without those claims.
- **Fix:** Updated the event service test fixtures to include realistic JWT authorizer claims.
- **Commit:** `0856258`

---

## Phase C — The Multi-Agent Audit (the big bug harvest)

The project was deliberately handed to a team of independent reviewer/auditor/challenger agents (`b916067`). They found the real bugs — the ones a single author can't see in their own work:

### C1. The ghost seat leak
- **Symptom:** Cancel a registration and the seat didn't reliably come back; over time, events showed fewer seats than they should have.
- **Cause:** Seat release wasn't tied to whether the cancelled registration was actually holding a seat. Cancelling a **waitlisted** ticket could also double-manipulate `seatsRemaining`, and the seat decrement/increment logic was spread out.
- **Fix:** The cancel handler now increments `seatsRemaining` **only if** `current_status == 'registered'`, and waitlist promotion is also gated on a real registered seat being freed. The seat bookkeeping became a single consistent rule.
- **Commit:** `b916067`

### C2. Missing things returned 200 with empty bodies
- **Symptom:** `GET /events/{nonexistentId}` returned HTTP 200 with an empty/null payload instead of 404; same for tickets.
- **Cause:** Handlers didn't distinguish "no such item" from "empty result."
- **Fix:** Missing events/tickets now return proper HTTP **404** with structured error payloads (`NOT_FOUND` / `EVENT_NOT_FOUND`).
- **Commit:** `b916067`

### C3. The case-sensitivity duplicate
- **Symptom:** `User@X.com` and `user@x.com` could both register for the same event.
- **Cause:** The dedup key (DynamoDB `SK` / registration PK) used the raw email, but emails arrive with arbitrary casing and whitespace.
- **Fix:** Emails are now normalized with `.strip().lower()` **before** the key is computed, everywhere a registration or cancellation is written.
- **Commit:** `b916067`

### C4. Go panics waiting to happen
- **Symptom:** A malformed request or unexpected response shape could crash the check-in Lambda at runtime.
- **Cause:** The Go service used unsafe type assertions (`.(string)` without the `, ok` form) in several places, which panics if the type doesn't match.
- **Fix:** All interface type assertions now use the safe `value, ok := ...` idiom, plus nil-path-parameter guards. Added `TestSafeTypeAssertions` to lock it in.
- **Commit:** `b916067`

### C5. Environment drift
- **Symptom:** dev/staging/prod could fall out of sync as features were added to one environment's Terraform.
- **Cause:** No guarantee the three environments stayed identical.
- **Fix:** Audited and enforced **environment parity** — all environments now share identical module structures and resources, parameterized only by `local.environment`.
- **Commit:** `b916067`

### C6. The audit also built the E2E suite
- The audit team added `services/e2e/e2e_test.py` (67 assertions across 4 tiers: feature coverage, boundary/edge cases, cross-feature combinations, real-world lifecycle) that runs against the live API with moto mocks. This is why `TEST_READY.md` can claim verified behavior rather than hope.

---

## Phase D — Frontend Meets the Real API (mismatch after mismatch)

### D1. The frontend lived in a fantasy API contract
- **Symptom:** The site rendered fields that didn't exist, hid fields that did, and login behaved weirdly.
- **Cause:** The frontend was built against assumed field names (`eventId` vs `id`, `name`/`date`/`venue`/`capacity` shapes) and had a **fake login fallback** that redirected when real tokens weren't available. Editing an event 404'd, and the capacity filter displayed `NaN`.
- **Fix:** Aligned the frontend to the real API contract end-to-end: correct field mapping, removed the fake login fallback, fixed the edit-event 404, fixed the NaN capacity display. (Large commit — mostly contract alignment.)
- **Commit:** `c521fbd`

### D2. Modal portals centered against the wrong ancestor
- **Symptom:** Dialogs appeared off-center on wide screens.
- **Cause:** The modal portal computed position relative to a parent element rather than the viewport.
- **Fix:** Made modal positioning viewport-relative (portal to `document.body` and center against the window).
- **Commit:** `ce0a212`

### D3. The Ticket type didn't match what the API returned
- **Symptom:** The ticket success / lookup screens showed blank or wrong data.
- **Cause:** `getTicket` mapped the real API response onto a `Ticket` type with different field names/shapes.
- **Fix:** Mapped the real registration/ticket response to the `Ticket` type (and the lookup path) with correct fields.
- **Commit:** `7e0f477`, `7ec3d8e`

### D4. Reading the wrong ID off the register response
- **Symptom:** The QR code on the success screen could show the wrong/empty ticket.
- **Cause:** The register response returns `ticketId`, but the success page read `ticket.ticketCode` from the *lookup* object instead.
- **Fix:** Read the real `ticketId` from the register response and use it for the QR.
- **Commit:** `4a9b583`

### D5. Static routes 404'd on S3/CloudFront
- **Symptom:** Deep links like `/admin/dashboard` or `/events/xyz` returned 403/404 on the hosted site, while `/` worked.
- **Cause:** A static S3 bucket has no server-side routing; `/events/xyz` isn't a real file.
- **Fix:** Added a **CloudFront Function** that rewrites non-file paths to `/index.html` so the SPA handles routing.
- **Commit:** `c5b18e0`

### D6. Delete was a 204, and the UI treated it as an error
- **Symptom:** Deleting an event "failed" in the UI even though it worked.
- **Cause:** `DELETE` returns `204 No Content`, but the frontend client expected a JSON body and treated the empty response as an error.
- **Fix:** Handle `204` explicitly as success in the API client.
- **Commit:** `0e46894`

### D7. RBAC existed but demo fallbacks undermined it
- **Symptom:** Admin/creator-only actions were partly protected, but demo fallbacks in the frontend and permissive checks in the backend let things through.
- **Cause:** Scaffold-era "it's all open for demo" code paths were still around.
- **Fix:** Enforced RBAC on events and check-in (owner/Admin-only), removed the demo fallbacks, and moved the frontend to CloudFront.
- **Commit:** `bf7b0f1`

### D8. The password-less creator console
- **Symptom/Challenge:** Creators needed to manage *their own* events without being provisioned Cognito accounts.
- **Cause of the design:** Cognito accounts for every creator was too heavy for onboarding.
- **Fix:** Email-as-identity — the creator supplies an email, the frontend sends it as an `X-Creator-Email` header, and the backend scopes every query to that email. The database polices the boundary: a creator literally cannot read another creator's data.
- **Commit:** `9de1b86`

### D9. Event banner images
- **Symptom/Challenge:** Banner images were decorative and didn't persist.
- **Fix:** Persisted banner image URLs end-to-end (event create/edit → store → render) with a stock fallback when none is set.
- **Commit:** `ca76dca`

---

## Phase E — Polish & Production (what real users hit)

### E1. The per-event CSV exported only the first event
- **Symptom:** On the dashboard, "export" always produced the first event's attendees no matter which event you selected.
- **Cause:** The export route/button looked up the wrong thing — it wasn't scoped to the selected event.
- **Fix:** Scoped the CSV export per event (including waitlisted attendees).
- **Commit:** `5ca95c9`

### E2. The `cognito:groups` crash — the whole admin dashboard died
- **Symptom:** `kaluna.bennyduah.com/admin/dashboard/` showed the Next.js error fallback: *"Application error: a client-side exception has occurred."* Console: `TypeError: ((intermediate value)(...)).replace is not a function`.
- **Cause:** Cognito JWTs deliver `cognito:groups` as an **array** (`["Admin"]`), but the dashboard parsed it as a string and called `.replace()` on it. An array is truthy, so the `|| ""` fallback never saved it — the page crashed during render.
- **Fix:** Handle both shapes defensively — if the claim is an array, map it; if it's a string, clean it:
  ```ts
  const groups = Array.isArray(groupsClaim)
    ? groupsClaim.map(g => String(g).trim()).filter(Boolean)
    : String(groupsClaim || '').replace(/[\[\]]/g, '').split(',').map(g => g.trim()).filter(Boolean);
  ```
  **Lesson:** JWT claims are data from an external system. Never trust their type.
- **Commit:** `4f48040`

### E3. The fake avatars
- **Symptom/Challenge:** Event cards showed a stack of generated avatar faces for "N going" — fabricated social proof.
- **Fix:** Removed the fake DiceBear avatars, kept an honest `AvatarStack` that renders nothing when there are no real registrants (the count is still real: `capacity - seatsRemaining`).
- **Commit:** `4f48040`

### E4. AI-slop decorations
- **Symptom/Challenge:** The UI accumulated a pile of auto-generated garnish: a sparkle burst on hover, a butterfly burst, confetti, scroll reveals — each cute, collectively noise.
- **Fix:** Deleted `SparkleBurst`, `ButterflyBurst`, `ConfettiBurst`, scroll-reveal, and the sparkle wordmark; replaced decorative icons with functional ones. (Six butterfly-tuning commits — `07d8edb` → `2ffaec0` → `6c2c900` → `d95f055` → `4e3b62b` → `0c65298` — were the textbook "scope spiral on a purely decorative feature"; the `4f48040` cleanup removed them entirely.)
- **Commit:** `4f48040` (and the butterfly saga commits it cleaned up)

### E5. Committing the `.agents` workspace by accident
- **Symptom/Challenge:** The multi-agent work produced a large `.agents/` directory (briefings, reports, plans) that kept getting committed alongside real changes.
- **Fix:** Removed the `.agents` artifacts from the repo so the commit history reflects product work, not agent chatter.
- **Commit:** `70c9709`

---

## The patterns (if you remember nothing else)

1. **External systems have their own types and rules.** DynamoDB gives you `Decimal`; Cognito gives you arrays where you expect strings; Moto upgrades and renames its mocks; Terraform versions move; SES needs `us-east-1`. Nearly every "impossible" bug here was really *"we assumed the external system was shaped like our assumption."*
2. **The database can enforce correctness you'd never trust the app to enforce.** Seat counts, duplicate registrations, duplicate check-ins, audit logs — all wrapped in single `transact_write_items` with conditional expressions. No locks, no queues, no drift.
3. **Independent review finds what the author can't.** The ghost seat, the wrong 404s, the case-insensitive duplicates — all caught by external reviewers, then locked in with tests so they can't regress.
4. **Decorative polish is a scope spiral.** Six commits to position a butterfly taught us to ship the product, not the garnish.
