# Handoff Report — Explorer 1 (Infrastructure & Deployment Audit)

**Working Directory**: `d:\New folder (6)\kaluna\kaluna\.agents\teamwork_preview_explorer_infra`  
**Target Milestone**: Infrastructure & Deployment Audit  
**Date**: August 5, 2026

---

## 1. Observation

Direct observations from examining the codebase, Terraform files, Lambda source code, and GitHub Actions workflows:

1. **Environment Defect — Missing Lambdas & Schedule Rules**:
   - In `terraform/environments/dev/main.tf` (lines 313–407), `aws_lambda_function.reminders`, `aws_cloudwatch_event_rule.reminders_schedule`, `aws_lambda_function.feedback`, and `aws_cloudwatch_event_rule.feedback_schedule` are defined.
   - In `terraform/environments/staging/main.tf` (310 lines) and `terraform/environments/prod/main.tf` (310 lines), lines 313–407 are missing. Staging and prod only define `events`, `registrations`, and `checkin`.

2. **Code Routing Bug — Route Shadowing**:
   - `services/events/app.py` lines 97–101:
     ```python
     elif path.startswith('/api/v1/events/') and event_id:
         if http_method == 'GET':
             response = get_event(event_id)
     ```
   - `services/events/app.py` lines 114–118:
     ```python
     elif path.startswith('/api/v1/events/') and path.endswith('/registrations') and event_id:
         if http_method == 'GET':
             response = list_event_registrations(event_id, event)
     ```
   - A request to `GET /api/v1/events/123/registrations` matches line 97 first because `"/api/v1/events/123/registrations".startswith("/api/v1/events/")` is `True`. Line 114 is unreachable.

3. **Go Build & Packaging Issue**:
   - `terraform/environments/dev/main.tf` lines 233–239:
     ```hcl
     provisioner "local-exec" {
       command = "cd ../../../services/checkin && go build -o bootstrap main.go"
       environment = {
         GOOS   = "linux"
         GOARCH = "amd64"
       }
     }
     ```
   - `&&` fails in standard PowerShell 5.1; missing `CGO_ENABLED=0`; `archive_file` zipping on Windows does not set file permissions to `0755` executable.

4. **CI/CD Pipeline Exclusion**:
   - `.github/workflows/deploy.yml` lines 76–80:
     ```bash
     if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
       echo "environment=prod" >> $GITHUB_OUTPUT
     else
       echo "environment=dev" >> $GITHUB_OUTPUT
     fi
     ```
   - The workflow targets only `prod` or `dev`. `staging` environment is never referenced or deployed.

5. **Tracked State & Artifact Files in Git**:
   - `terraform/environments/dev/terraform.tfstate` and `terraform.tfstate.backup` exist on disk and are tracked in Git.
   - Pre-built `.zip` files (`events.zip`, `registrations.zip`, `checkin.zip`, `feedback.zip`, `reminders.zip`) exist in `dev/`, `staging/`, `prod/`.

6. **Documentation Drift**:
   - `PROJECT.md` lines 9–11 state: `checkin` is Python Lambda, `feedback` is Go Lambda, `reminders` is Go Lambda. In reality, `checkin` contains `main.go`, `feedback` contains `app.py`, `reminders` contains `app.py`.
   - `docs/09-testing.md` line 6 claims integration tests run against `dynamodb-local`. No Docker or `dynamodb-local` configuration exists.

---

## 2. Logic Chain

1. **Observation 1 -> Conclusion A**: Since `reminders` and `feedback` resources exist only in `dev/main.tf` and are absent from `staging/main.tf` and `prod/main.tf`, applying Terraform to staging or prod will fail to deploy reminder and feedback background services.
2. **Observation 2 -> Conclusion B**: In Python `if/elif` evaluation, expressions are evaluated sequentially. Because `/api/v1/events/{eventId}/registrations` starts with `/api/v1/events/`, line 97 triggers first for all GET requests to event subpaths. Line 114 is inside a subsequent `elif` block, making `GET /api/v1/events/{eventId}/registrations` permanently return event detail instead of registration records.
3. **Observation 3 -> Conclusion C**: Executing Terraform on Windows hosts will invoke PowerShell or CMD for `local-exec`. `&&` is unsupported in PowerShell 5.1. Furthermore, Windows zip creation does not set Linux execute bits (`+x` / `0755`), causing AWS Lambda custom runtime `provided.al2023` to throw `Permission denied` (HTTP 502).
4. **Observation 4 -> Conclusion D**: The CI/CD pipeline binary branch decision (`main` -> `prod`, else -> `dev`) prevents automated testing or deployment of `terraform/environments/staging`.
5. **Observation 5 -> Conclusion E**: Terraform state files tracked in Git risk exposing outputs/secrets and causing concurrent state corruption across developer machines.

---

## 3. Caveats

- **Live AWS Deployments**: Investigation was strictly read-only and static code audit. No `terraform apply` or live AWS deployment was performed against actual AWS accounts.
- **Go Unit Tests Coverage**: Go unit tests in `services/checkin/main_test.go` were inspected but not executed locally due to read-only constraints.
- No source code or infrastructure files outside `.agents/teamwork_preview_explorer_infra` were modified.

---

## 4. Conclusion

The Kaluna serverless ticketing platform infrastructure is well-architected at a modular level, but requires key fixes before proceeding to production deployment:
1. Replicate `reminders` and `feedback` modules, rules, and permissions across `staging` and `prod` Terraform configurations.
2. Fix route evaluation order in `services/events/app.py` so `/registrations` is evaluated before generic `/{eventId}` GET requests.
3. Add `CGO_ENABLED=0` and a cross-platform build script/configuration for the Go check-in Lambda binary.
4. Add `*.tfstate`, `*.tfstate.*`, and `*.zip` to `.gitignore` and untrack them from Git.
5. Add explicit `timeout` (e.g. 10s) and `memory_size` (e.g. 256MB) settings to all Lambda definitions in Terraform.
6. Align `PROJECT.md`, `docs/09-testing.md`, and CI workflow (`deploy.yml`) with actual codebase setup.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Environment Defect**:
   - Inspect `terraform/environments/dev/main.tf` lines 313–407 and compare against `terraform/environments/staging/main.tf` and `prod/main.tf`.
   - Command: `git diff --no-index terraform/environments/dev/main.tf terraform/environments/staging/main.tf`

2. **Verify Event Registration Route Bug**:
   - Inspect `services/events/app.py` lines 97–118.
   - Run unit test for `GET /api/v1/events/{eventId}/registrations` or inspect `events/tests/test_app.py` (which currently lacks a test for `list_event_registrations`).

3. **Verify Tracked State Files**:
   - Inspect git tracked status: `git ls-files terraform/environments/dev/terraform.tfstate`

4. **Verify CI Workflow**:
   - Inspect `.github/workflows/deploy.yml` lines 73–80.

---
