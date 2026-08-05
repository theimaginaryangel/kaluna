# Kaluna Serverless Ticketing Platform — Infrastructure & Deployment Audit Report

**Target**: Kaluna Infrastructure & Deployment Configuration  
**Auditor**: Explorer 1 — Infrastructure & Deployment Audit Agent  
**Date**: August 5, 2026  
**Working Directory**: `d:\New folder (6)\kaluna\kaluna\.agents\teamwork_preview_explorer_infra`

---

## 1. Executive Summary

A comprehensive infrastructure and deployment audit of the Kaluna serverless ticketing platform was conducted across all Terraform configurations (`terraform/modules/`, `terraform/environments/`), API specifications (`openapi.yaml`), Lambda service implementations (`services/`), database definitions, CI/CD workflows (`.github/workflows/`), and documentation (`docs/`, `PROJECT.md`, `README.md`).

While the core serverless architecture (API Gateway HTTP API -> AWS Lambda -> DynamoDB single-table design) is cleanly structured, several **critical infrastructure omissions, severity-high application routing bugs, platform deployment incompatibilities, and documentation mismatches** were uncovered.

### Key Audit Findings Overview
- **Missing Infrastructure in Staging & Production**: `reminders` and `feedback` Lambda services along with their EventBridge schedule rules are completely missing from `terraform/environments/staging/main.tf` and `prod/main.tf`.
- **Critical API Routing Shadowing Bug**: In `services/events/app.py`, generic path matching shadows `GET /api/v1/events/{eventId}/registrations`, causing attendee registration listing requests to return event metadata instead of attendee lists.
- **Cross-Platform Build & Execution Failure**: The Go check-in build provisioner in Terraform (`null_resource.build_checkin`) uses Linux shell syntax (`&&`) that breaks on Windows PowerShell, omits `CGO_ENABLED=0`, and fails to preserve executable permissions (`0755`) inside the zip archive, resulting in Lambda runtime execution failure (`Permission denied` / HTTP 502).
- **Missing Lambda Timeout & Memory Tuning**: All Lambda functions rely on default AWS settings (3-second timeout, 128 MB RAM), posing timeout risks during transactional DynamoDB operations and SES email deliveries under load.
- **Git Security & Artifact Hygiene Violations**: Terraform state files (`terraform.tfstate`) and pre-built deployment zip archives are tracked in Git.
- **Absent Local Testing Infrastructure**: No LocalStack, SAM, docker-compose, or local DynamoDB integration test setups exist, despite being specified in engineering documentation (`docs/09-testing.md`).

---

## 2. Terraform Infrastructure & Environment Audit

### 2.1 Directory Structure & Modular Design
The infrastructure is organized into reusable modules in `terraform/modules/` and environment-specific instantiations in `terraform/environments/`:
- **Modules**: `api_gateway`, `cognito`, `dynamodb`, `iam`, `monitoring`, `ses`.
- **Environments**: `dev`, `staging`, `prod`.

### 2.2 Environment Parity Analysis

| Resource / Module | Dev Environment (`dev/main.tf`) | Staging Environment (`staging/main.tf`) | Production Environment (`prod/main.tf`) | Status / Defect |
|---|---|---|---|---|
| DynamoDB Table | `kaluna-dev-table` | `kaluna-staging-table` | `kaluna-prod-table` | Parity OK |
| API Gateway HTTP API | `kaluna-dev-api` | `kaluna-staging-api` | `kaluna-prod-api` | Parity OK |
| Cognito User Pool | `kaluna-dev-pool` | `kaluna-staging-pool` | `kaluna-prod-pool` | Parity OK |
| SES Email Identity | `contact@bennyduah.com` | `contact@bennyduah.com` | `contact@bennyduah.com` | Hardcoded email across all envs |
| Events Lambda | Deployed | Deployed | Deployed | Parity OK |
| Registrations Lambda | Deployed | Deployed | Deployed | Parity OK |
| Check-in Lambda (Go) | Deployed | Deployed | Deployed | Parity OK |
| **Reminders Lambda** | **Deployed** (Cron: `0 10 * * ? *`) | **MISSING** | **MISSING** | **CRITICAL DEFECT** |
| **Feedback Lambda** | **Deployed** (Cron: `0 14 * * ? *`) | **MISSING** | **MISSING** | **CRITICAL DEFECT** |
| **CloudWatch Alarms (Reminders/Feedback)** | **Included in monitoring** | **Omitted from monitoring** | **Omitted from monitoring** | **DEFECT** |
| **AWS Budgets** | **Configured ($1 limit)** | **MISSING** | **MISSING** | **DEFECT** |

---

## 3. API Gateway Routes & Lambda Integrations Audit

### 3.1 Route Verification against `openapi.yaml`

API Gateway is configured as an HTTP API (API Gateway v2) using `$default` auto-deployed stage. Route definitions in Terraform were audited against the OpenAPI 3.0 specification (`openapi.yaml`):

| OpenAPI Path & Method | Required Auth | Terraform Route Key | Target Lambda Integration | Status |
|---|---|---|---|---|
| `GET /health` | Public | `GET /api/v1/health` | `events_integration` | Configured OK |
| `GET /events` | Public | `GET /api/v1/events` | `events_integration` | Configured OK |
| `POST /events` | JWT (Cognito) | `POST /api/v1/events` | `events_integration` | Configured OK |
| `GET /events/{eventId}` | Public | `GET /api/v1/events/{eventId}` | `events_integration` | Configured OK |
| `PUT /events/{eventId}` | JWT (Cognito) | `PUT /api/v1/events/{eventId}` | `events_integration` | Configured OK |
| `DELETE /events/{eventId}` | JWT (Cognito) | `DELETE /api/v1/events/{eventId}` | `events_integration` | Configured OK |
| `GET /events/{eventId}/registrations` | JWT (Cognito) | `GET /api/v1/events/{eventId}/registrations` | `events_integration` | Configured in TF, **Broken in Code** |
| `GET /analytics` | JWT (Cognito) | `GET /api/v1/analytics` | `events_integration` | Configured OK |
| `POST /events/{eventId}/register` | Public | `POST /api/v1/events/{eventId}/register` | `registrations_integration` | Configured OK |
| `GET /registrations/{ticketId}` | Public | `GET /api/v1/registrations/{ticketId}` | `registrations_integration` | Configured OK |
| `POST /registrations/{ticketId}/cancel` | Public | `POST /api/v1/registrations/{ticketId}/cancel` | `registrations_integration` | Configured OK |
| `POST /check-in` | Public | `POST /api/v1/check-in` | `checkin_integration` | Configured OK |
| `GET /events/{eventId}/check-ins` | JWT (Cognito) | `GET /api/v1/events/{eventId}/check-ins` | `checkin_integration` | Configured OK |

### 3.2 Critical Backend Routing Bug in `services/events/app.py`
In `services/events/app.py`, the `lambda_handler` route selection contains a logic flaw:

```python
# Lines 97-101:
elif path.startswith('/api/v1/events/') and event_id:
    if http_method == 'GET':
        response = get_event(event_id)
        log_event(request_id, event_id, "get_event", start_time, "success")
        return response

# Lines 114-118:
elif path.startswith('/api/v1/events/') and path.endswith('/registrations') and event_id:
    if http_method == 'GET':
        response = list_event_registrations(event_id, event)
        log_event(request_id, event_id, "list_registrations", start_time, "success")
        return response
```

- **Analysis**: When a request to `GET /api/v1/events/{eventId}/registrations` is received, `path` is `"/api/v1/events/123/registrations"`.
- `path.startswith('/api/v1/events/')` evaluates to `True`, and `event_id` is `"123"`.
- Line 97 matches **first**, causing `get_event("123")` to be invoked and returned.
- Line 114 is placed in a subsequent `elif` block and is **completely unreachable**.
- **Impact**: Any attempt to list attendee registrations via `GET /api/v1/events/{eventId}/registrations` returns event metadata instead of attendee list data.

---

## 4. Lambda Function Resource Definitions Audit

### 4.1 Function Settings Matrix

| Lambda Function | Source Dir / Handler | Runtime | Memory | Timeout | Tracing | Status / Defect |
|---|---|---|---|---|---|---|
| `events` | `services/events` -> `app.lambda_handler` | `python3.11` | Default (128 MB) | Default (3s) | Active | Memory & Timeout not tuned |
| `registrations` | `services/registrations` -> `app.lambda_handler` | `python3.11` | Default (128 MB) | Default (3s) | Active | Memory & Timeout not tuned |
| `checkin` | `services/checkin` -> `bootstrap` | `provided.al2023` | Default (128 MB) | Default (3s) | Active | Build command issue on Windows |
| `reminders` | `services/reminders` -> `app.lambda_handler` | `python3.11` | Default (128 MB) | Default (3s) | Active | Missing in Staging & Prod |
| `feedback` | `services/feedback` -> `app.lambda_handler` | `python3.11` | Default (128 MB) | Default (3s) | Active | Missing in Staging & Prod |

### 4.2 IAM Roles and Policy Analysis
IAM roles are created per-function using `terraform/modules/iam`:
- Basic Execution Role (`AWSLambdaBasicExecutionRole`) is attached to all functions.
- X-Ray Write-Only Access (`AWSXrayWriteOnlyAccess`) is attached to all functions.
- DynamoDB access policy provides permissions on table ARN and `index/*` for `PutItem`, `GetItem`, `Scan`, `Query`, `UpdateItem`, `DeleteItem`. (Required for transactional updates).
- SES Send policy (`ses:SendEmail`, `ses:SendRawEmail`) is attached to `registrations`, `reminders`, and `feedback`.

---

## 5. DynamoDB Table & Schema Audit

### 5.1 Single-Table Design Verification

| Entity / Access Pattern | Primary Key (`PK`) | Sort Key (`SK`) | GSI1 (`GSI1PK` / `GSI1SK`) | Schema Validation |
|---|---|---|---|---|
| Event Metadata | `EVENT#{eventId}` | `METADATA` | N/A | Valid |
| Registration | `EVENT#{eventId}` | `REG#{email}` | `TICKET#{ticketId}` / `METADATA` | Valid |
| Ticket Lookup | N/A | N/A | `TICKET#{ticketId}` / `METADATA` | Validated by GSI1 query |
| Audit Trail | `EVENT#{eventId}` | `AUDIT#{timestamp}` | N/A | Valid |

### 5.2 DynamoDB Module Configuration (`terraform/modules/dynamodb/main.tf`)
- Table Name: Passed via `var.table_name` (`kaluna-${env}-table`). Match verified against Lambda environment variable `TABLE_NAME`.
- Billing Mode: `PAY_PER_REQUEST` (On-Demand).
- Attributes Defined: `PK` (S), `SK` (S), `GSI1PK` (S), `GSI1SK` (S).
- **Security & Backup Defect**:
  - `point_in_time_recovery` is NOT enabled.
  - `server_side_encryption` is NOT explicitly configured.
  - `deletion_protection_enabled` is NOT enabled.

---

## 6. Local Execution, Testing & Deployment Pipeline Audit

### 6.1 Local Execution & Test Environment
- **LocalStack / SAM / Docker**: 0 local environment templates or configuration files exist in the repository.
- **Documentation Drift**: `docs/09-testing.md` claims layer 2 integration tests run against `dynamodb-local`. No Docker compose file or setup script exists to run `dynamodb-local`.
- **Unit Testing Suite**:
  - Python tests (`services/events/tests/test_app.py` & `services/registrations/tests/test_app.py`) use `pytest` + `moto` (`mock_aws`).
  - Go tests (`services/checkin/main_test.go`) only test helper utility functions. No DynamoDB mocking or handler unit tests exist for Go check-in logic.

### 6.2 CI/CD Pipeline Audit (`.github/workflows/deploy.yml`)
- Workflow runs unit tests (`pytest` and `go test`) on PRs and pushes to `develop` and `main`.
- Deployment trigger step:
  ```bash
  if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
    echo "environment=prod" >> $GITHUB_OUTPUT
  else
    echo "environment=dev" >> $GITHUB_OUTPUT
  fi
  ```
- **Defect**: The `staging` environment is completely isolated from CI/CD automation. Pushing to any branch other than `main` triggers deployment to `dev`. There is no mechanism to deploy to `staging`.

---

## 7. Categorized Catalog of Bugs, Misconfigurations & Mismatches

### Category A: Critical Infrastructure Omissions (Severity: High)
1. **Missing Reminders & Feedback Services in Staging & Production**
   - **Location**: `terraform/environments/staging/main.tf`, `terraform/environments/prod/main.tf`
   - **Details**: `reminders` Lambda function, `feedback` Lambda function, CloudWatch Event Rules, CloudWatch Event Targets, and Lambda permissions are defined in `dev/main.tf` but omitted from `staging` and `prod`.
   - **Remediation**: Add `reminders` and `feedback` Lambda definitions, EventBridge schedules, permissions, and monitoring metric entries to `staging/main.tf` and `prod/main.tf`.

2. **Staging Environment Omitted from CI/CD Pipeline**
   - **Location**: `.github/workflows/deploy.yml` (lines 73-80)
   - **Details**: Environment selection logic maps `main` to `prod` and all other branches to `dev`. `staging` environment is unreferenced.
   - **Remediation**: Update workflow to deploy `release/*` or `staging` branch to `staging`.

### Category B: Code & API Gateway Routing Bugs (Severity: High)
3. **Route Shadowing Bug in Event Registrations List Endpoint**
   - **Location**: `services/events/app.py` (lines 97-118)
   - **Details**: Line 97 `elif path.startswith('/api/v1/events/') and event_id:` precedes line 114 `elif path.startswith('/api/v1/events/') and path.endswith('/registrations') and event_id:`.
   - **Remediation**: Move the `/registrations` check above the generic `/events/{eventId}` check, or use explicit path equality.

4. **Cross-Platform Go Build Failure & Permission Defect**
   - **Location**: `terraform/environments/dev/main.tf` (lines 229-240), `staging/main.tf` (lines 222-233), `prod/main.tf` (lines 222-233)
   - **Details**: `null_resource.build_checkin` uses `&&` in `command` string (incompatible with Windows PowerShell 5.1), omits `CGO_ENABLED=0`, and zips binary without Linux executable file mode (`0755`), causing Lambda runtime error `Permission denied` / HTTP 502 on `provided.al2023`.
   - **Remediation**: Add `CGO_ENABLED=0` to environment block, use cross-platform build script or build flags, and set file permissions.

### Category C: Operational & Configuration Defects (Severity: Medium)
5. **Committed State Files & Compiled Archives in Git**
   - **Location**: `terraform/environments/dev/terraform.tfstate`, `terraform/environments/dev/terraform.tfstate.backup`, `terraform/environments/*/*.zip`
   - **Details**: Terraform state files and build zip files are tracked in version control.
   - **Remediation**: Add `*.tfstate`, `*.tfstate.*`, `*.zip` to `.gitignore` and remove state files from Git repository.

6. **Unconfigured Lambda Timeout & Memory Settings**
   - **Location**: All `aws_lambda_function` definitions across `terraform/environments/*/main.tf`
   - **Details**: `timeout` and `memory_size` attributes are omitted, leaving functions at 3s / 128MB defaults.
   - **Remediation**: Set explicit `timeout = 10` (or 15) and `memory_size = 256` (or 512) for all functions.

7. **Missing Production Data Protection Attributes**
   - **Location**: `terraform/modules/dynamodb/main.tf`
   - **Details**: `point_in_time_recovery` and `deletion_protection_enabled` are not configured on DynamoDB table.
   - **Remediation**: Enable `point_in_time_recovery { enabled = true }` and `deletion_protection_enabled = true` for production.

8. **Documentation Inconsistencies**
   - **Location**: `PROJECT.md` (lines 9-11), `docs/09-testing.md` (line 6)
   - **Details**: `PROJECT.md` mislabels service languages (`checkin` as Python, `feedback` & `reminders` as Go). `docs/09-testing.md` references non-existent `dynamodb-local` integration test setup.
   - **Remediation**: Update `PROJECT.md` and `docs/09-testing.md` to reflect actual codebase structure.

---
