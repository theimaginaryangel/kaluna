# Original User Request

## 2026-08-05T16:24:56Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Audit the backend infrastructure (Terraform) and API Services (Python/Go) for the Kaluna serverless ticketing platform, fixing any remaining errors or edge cases.

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

## Follow-up — 2026-08-05T18:07:00Z

# Teamwork Project Prompt — Draft

> Status: Step 9 — Ready for launch — awaiting user approval.
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Fix the Kaluna CI/CD pipeline deployment job which is failing due to missing AWS credentials during the Terraform execution.

Working directory: d:\New folder (6)\kaluna\kaluna
Integrity mode: development

## Requirements

### R1. Configure AWS Credentials
Update `.github/workflows/deploy.yml` to use the official `aws-actions/configure-aws-credentials@v2` action in the `deploy` job. This step should be inserted right before the `Terraform Init` step to ensure the AWS Terraform provider receives the necessary credentials rather than falling back to IMDS.

### R2. Use Existing Secrets
Configure the action using the repository's existing secrets: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, and set the region to `us-east-1`.

### R3. Commit with Human-like Messages
Commit the fixes to the `develop` branch. Ensure the commit message is formatted like a real human developer (e.g., `fix(ci): configure aws credentials for terraform deploy`).

## Acceptance Criteria

### CI/CD Configuration
- [ ] `.github/workflows/deploy.yml` contains the `aws-actions/configure-aws-credentials@v2` step in the deploy job before `Terraform Init`.
- [ ] The step correctly references `secrets.AWS_ACCESS_KEY_ID` and `secrets.AWS_SECRET_ACCESS_KEY`.

## 2026-08-06T20:37:21Z

Audit the Kaluna project's Terraform state to identify and clean up orphaned AWS API Gateway instances (`kaluna-dev-api`), while ensuring the production API is protected and the underlying infrastructure-as-code issue causing the duplication is resolved.

Working directory: `d:\New folder (6)\kaluna\kaluna\terraform`

## Requirements

### R1. Audit & Drift Identification
Analyze the Terraform state and the live AWS environment to identify why multiple `kaluna-dev-api` API Gateway HTTP APIs exist. Determine if this is caused by a CI/CD issue, unstable resource naming, or manual drift. Explain the root cause clearly before proceeding.

### R2. Orphaned Resource Listing
List all orphaned API Gateways (not tracked in current state or actively used) with their IDs, creation dates, and attached routes/integrations. Present this list to the user for explicit confirmation before any deletion occurs.

### R3. Safe Deletion & Cleanup
Once the user confirms the list, delete the orphaned dev APIs directly via the AWS CLI (not Terraform destroy). Clean up any associated dangling resources (IAM policies, CloudWatch log groups, Lambda permissions). Do NOT delete or modify `kaluna-prod-api` (`o275c5g9h5`).

### R4. Terraform Configuration Fix
Modify the Terraform configuration so that future `terraform apply` runs reuse the existing dev API deterministically instead of spawning new instances.
