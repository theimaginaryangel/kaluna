# Orchestrator Execution Plan — Kaluna API Gateway Audit & Fix

## Mission
Audit Terraform state and live AWS environment to identify why multiple `kaluna-dev-api` API Gateways exist, produce detailed listing of orphaned instances for confirmation, safely delete orphaned dev APIs via AWS CLI while protecting `kaluna-prod-api` (`o275c5g9h5`), and fix Terraform configuration so future applies reuse the existing dev API deterministically (`terraform plan` shows no changes).

## Milestones & Phased Execution

### Phase 1: Audit & Drift Identification (R1 & R2)
- **Objective**: Inspect live AWS API Gateways (`aws apigatewayv2 get-apis`), inspect local/remote Terraform state, trace Terraform configuration (`terraform/main.tf`, `apigateway.tf`, etc.), determine why duplicates were created, and classify APIs into:
  - Active dev API (tracked in state/used by services)
  - Production API (`o275c5g9h5`, strictly protected)
  - Orphaned dev APIs (untracked/legacy)
- **Output**: Detailed audit report (`analysis.md` / report in explorer folder) with exact IDs, creation dates, attached routes/integrations, attached CloudWatch log groups/IAM policies, and root cause analysis.
- **Agent**: `teamwork_preview_explorer` (Folder: `.agents/teamwork_preview_explorer_infra`)

### Phase 2: Orphaned Resource Listing & Confirmation (R2)
- **Objective**: Compile findings from Phase 1 into a clear confirmation table for sentinel/user review.
- **Output**: Detailed listing report.

### Phase 3: Safe Deletion & Terraform Configuration Fix (R3 & R4)
- **Objective**:
  1. Safe CLI deletion: Delete confirmed orphaned dev APIs via AWS CLI (`aws apigatewayv2 delete-api --api-id ...`). Clean up dangling resources (IAM roles/policies, log groups, Lambda permissions). Ensure `o275c5g9h5` is untouched.
  2. Terraform fix: Update `terraform/` configuration so `kaluna-dev-api` is either deterministically named/imported or looked up via data source / managed static ID, preventing creation of duplicate API Gateways on subsequent `terraform apply`.
  3. Verification: Run `terraform plan` to confirm 0 changes to add/destroy.
- **Agent**: `teamwork_preview_worker` (Folder: `.agents/teamwork_preview_worker_m1`)

### Phase 4: Independent Review & Verification
- **Objective**: Verify safe deletion, zero touch of prod API, Terraform code correctness, clean `terraform plan`, and E2E system functionality.
- **Agents**:
  - `teamwork_preview_reviewer` (Folder: `.agents/teamwork_preview_reviewer_1`)
  - `teamwork_preview_challenger` (Folder: `.agents/teamwork_preview_challenger_1`)

### Phase 5: Forensic Integrity Audit
- **Objective**: Execute forensic integrity audit to verify authentic implementation without hardcoding or facades.
- **Agent**: `teamwork_preview_auditor` (Folder: `.agents/teamwork_preview_auditor_1`)

### Phase 6: Synthesis & Final Reporting
- **Objective**: Synthesize all verification results and hand off final report to parent/user.
