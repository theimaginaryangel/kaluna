# Original User Request

## Initial Request — 2026-08-06T20:36:46Z

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

## Verification Resources
The user will manually review the list of orphaned APIs before authorizing deletion.

## Acceptance Criteria

### Security & Safety
- [ ] The `kaluna-prod-api` (`o275c5g9h5`) is completely untouched and remains fully operational.
- [ ] No resources are deleted without explicit user confirmation of the detailed list.

### Cleanup
- [ ] All confirmed orphaned API Gateways and their dangling dependencies are removed from the AWS account.

### Infrastructure as Code
- [ ] The root cause of the duplication is explicitly identified and explained.
- [ ] Running `terraform plan` on the dev environment after the fix shows no infrastructure changes (stable state).
- [ ] Subsequent `terraform apply` runs do not create duplicate API Gateways.
