# Plan — Kaluna Backend Audit & Bug Fixes

## Objective
Audit backend infrastructure (Terraform) and API services (Python/Go) for Kaluna serverless ticketing platform, fix all remaining errors or edge cases, and write & execute automated E2E tests against live API endpoints.

## Phased Approach

### Phase 1: Comprehensive System Exploration & Audit
- Dispatch 3 parallel Explorer agents:
  1. `teamwork_preview_explorer_infra`: Audit Terraform infrastructure (`terraform/`), API Gateway configuration, route integration, environment variables, IAM permissions, and LocalStack/live deployment setup.
  2. `teamwork_preview_explorer_python`: Audit Python services (`services/events`, `services/registrations`, `services/checkin`), unit tests (`pytest`), handler signatures, DynamoDB schema/queries, and error responses.
  3. `teamwork_preview_explorer_go`: Audit Go services (`services/feedback`, `services/reminders`), `go test` suites, OpenAPI specification (`openapi.yaml`), and cross-service contracts.

### Phase 2: Synthesis & Milestone Decomposition
- Aggregate audit findings into `PROJECT.md`.
- Group issues into distinct, decoupled milestones:
  - Milestone 1: Terraform Infrastructure & Route Mappings
  - Milestone 2: Python Backend Services (Events, Registrations, Checkin)
  - Milestone 3: Go Backend Services (Feedback, Reminders) & API Contracts

### Phase 3: Implementation & Verification Loop
- For each milestone:
  1. Worker (`teamwork_preview_worker`) implements fixes and runs existing unit/integration test suites.
  2. Reviewers (`teamwork_preview_reviewer`) verify code quality, correctness, and interface compliance.
  3. Challenger (`teamwork_preview_challenger`) stress-tests edge cases and failure modes.
  4. Forensic Auditor (`teamwork_preview_auditor`) performs non-negotiable integrity verification.

### Phase 4: Dual-Track E2E Testing & Final Hardening
- E2E Test Suite Orchestrator / Worker creates automated E2E test runner (Python/Go) testing all endpoints (health check, create event, list events, register for event, checkin, feedback).
- Execute E2E tests against live API Gateway endpoints, ensuring exit code 0 and zero 500 status codes.
- Final forensic audit and project completion report.
