# Changes Report — Milestone 1: Infrastructure & API Gateway Routing

## Summary of Changes

### 1. Fix Route Precedence in `services/events/app.py`
- **File modified**: `services/events/app.py`
- **Rationale**: Previously, any request to `/api/v1/events/{eventId}/registrations` matched `elif path.startswith('/api/v1/events/') and event_id:` first, causing `GET /events/{eventId}` (`get_event`) to be executed instead of `list_event_registrations`.
- **Changes Made**:
  - Reordered the `elif` route checks so that `path.startswith('/api/v1/events/') and path.endswith('/registrations') and event_id:` is evaluated BEFORE the generic `/api/v1/events/` check for `GET /events/{eventId}`.
  - Added fallback `event_id` parsing from path `parts` (`parts[3]`) when `pathParameters` is absent or incomplete.
  - Verified that `GET /api/v1/events/{eventId}/registrations` reaches `list_event_registrations(event_id, event)` correctly for both JSON and CSV export (`format=csv`).
  - Added unit test coverage for route precedence and CSV export in `services/events/tests/test_app.py`.

### 2. OpenAPI Spec Alignment in `openapi.yaml`
- **File modified**: `openapi.yaml`
- **Changes Made**:
  - Updated `GET /api/v1/events` 200 OK response schema from a top-level array to an object matching `{ "events": [...], "nextCursor": "..." }` returned by `list_events` in `services/events/app.py`.
  - Added query parameter `format` (enum: `json`, `csv`, default: `json`) to `GET /api/v1/events/{eventId}/registrations`.
  - Added `text/csv` media type specification under responses for `GET /api/v1/events/{eventId}/registrations`.

### 3. Terraform Environment Parity across Dev, Staging, and Prod
- **Files modified**:
  - `terraform/environments/staging/main.tf`
  - `terraform/environments/prod/main.tf`
- **Changes Made**:
  - Added missing `reminders` Lambda function definition (`aws_lambda_function.reminders`), IAM role module (`module.reminders_iam`), EventBridge schedule rule (`cron(0 10 * * ? *)`), event target, and Lambda permission.
  - Added missing `feedback` Lambda function definition (`aws_lambda_function.feedback`), IAM role module (`module.feedback_iam`), EventBridge schedule rule (`cron(0 14 * * ? *)`), event target, and Lambda permission.
  - Updated `module.monitoring` in both `staging/main.tf` and `prod/main.tf` to include `reminders` and `feedback` functions in the `lambda_functions` map.

### 4. Cross-Platform Build Checkin Script Compatibility
- **Files modified**:
  - `terraform/environments/dev/main.tf`
  - `terraform/environments/staging/main.tf`
  - `terraform/environments/prod/main.tf`
- **Changes Made**:
  - Updated `null_resource.build_checkin` provisioner in all three environments to set `working_dir = "${path.module}/../../../services/checkin"` instead of shell-dependent `cd` commands.
  - Added `CGO_ENABLED = "0"` to the `environment` block alongside `GOOS = "linux"` and `GOARCH = "amd64"`.

### 5. Update `.gitignore`
- **File modified**: `.gitignore`
- **Changes Made**:
  - Explicitly added `.terraform/`, `terraform.tfstate`, `terraform.tfstate.backup`, and confirmed existing `*.zip` build file patterns under the `# Terraform` section.

### 6. Unit Testing & Verification
- **Go Checkin Service**:
  - Executed `go test -v ./...` in `services/checkin`. All tests passed successfully:
    - `TestBuildResponse`: PASS
    - `TestBuildErrorResponse`: PASS
    - `TestCheckinRequestParsing`: PASS
    - `TestCheckinRequestEmpty`: PASS
- **Python Events Service**:
  - Added test cases `test_list_event_registrations_route_precedence` and `test_list_event_registrations_csv_format` to `services/events/tests/test_app.py`.
  - Executed `cd services/events && python -m pytest tests` (with `PYTHONPATH=.`). All 10 tests passed successfully (10/10 passed).
