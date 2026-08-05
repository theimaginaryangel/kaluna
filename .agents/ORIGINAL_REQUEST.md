# Original User Request

## 2026-08-05T16:24:56Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Audit the backend infrastructure (Terraform) and API services (Python/Go) for the Kaluna serverless ticketing platform, fixing any remaining errors or edge cases.

Working directory: d:\New folder (6)\kaluna\kaluna
Integrity mode: development

## Requirements

### R1. Backend Audit & Bug Fixes
Review the existing API Gateway and Lambda functions (events, registrations, checkin). Identify and resolve any remaining bugs, unhandled edge cases, or configuration mismatches.

### R2. End-to-End Test Script
Write and execute an automated Python or Go end-to-end (E2E) testing script that hits the live AWS API Gateway endpoints. The script must verify all core user flows: creating events, listing events, registering for events, and health checks.

## Acceptance Criteria

### Verification
- [ ] An automated E2E script successfully executes against the live API and exits with code 0.
- [ ] No `500 Internal Server Error` responses are encountered during the E2E run.
- [ ] All unit tests in the CI/CD pipeline (`pytest` and `go test`) pass successfully after your changes.
