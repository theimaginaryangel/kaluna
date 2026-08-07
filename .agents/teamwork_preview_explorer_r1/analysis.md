# Technical Analysis Report: API Gateway Infrastructure & Drift Audit (R1 & R2)

**Author:** Infrastructure & API Gateway Auditor  
**Date:** 2026-08-06  
**Project Root:** `d:\New folder (6)\kaluna\kaluna`  
**Terraform Directory:** `d:\New folder (6)\kaluna\kaluna\terraform`  
**Target Environments:** `dev` & `prod`  

---

## 1. Executive Summary

This audit was conducted in 100% read-only mode to address Requirements **R1 (Audit & Drift Identification)** and **R2 (Orphaned Resource Listing)** for the Kaluna project.

### Key Audit Findings:
1. **Total API Gateways in AWS us-east-1:** 6 HTTP API Gateways.
2. **Protected Production API (`R2`):** `o275c5g9h5` (`kaluna-prod-api`). Active, healthy, tracked in `prod/terraform.tfstate`. **STRICTLY PROTECTED.**
3. **Active Development API (`R2`):** `gzwmi3wu12` (`kaluna-dev-api`). Active, healthy, tracked in `dev/terraform.tfstate`.
4. **Orphaned Development APIs (`R2`):** 4 dangling instances of `kaluna-dev-api`:
   - `teyud9cohl` (Created: 2026-08-05 18:18:53 UTC)
   - `fvbwfweun7` (Created: 2026-08-05 18:45:22 UTC)
   - `d8altyy954` (Created: 2026-08-05 18:46:25 UTC)
   - `pcpooeplr8` (Created: 2026-08-05 18:46:49 UTC)
5. **Root Cause (`R1`):** In AWS API Gateway HTTP APIs (v2), resource names (`name = "kaluna-dev-api"`) are not unique constraints. On August 5, 2026, during multiple rapid CI/CD runs (commits `0ae376c`, `ae837e2`, `b916067`), early CI workflow runs failed or were aborted after creating the initial `aws_apigatewayv2_api` resource but before attaching routes/integrations or completing state persistence. Subsequent CI runs created new API Gateway instances, resulting in 4 orphaned skeleton APIs with 0 routes and 0 integrations.

---

## 2. R1: Audit & Drift Identification

### 2.1 Terraform State Inspection
Running `terraform state list` against the active `dev` environment (`terraform/environments/dev`) reveals that Terraform tracks exactly one API Gateway resource:
```
module.api_gateway.aws_apigatewayv2_api.http_api
module.api_gateway.aws_apigatewayv2_stage.api_stage
```
Inspection via `terraform state show module.api_gateway.aws_apigatewayv2_api.http_api` confirms:
- **State API ID:** `gzwmi3wu12`
- **State API Endpoint:** `https://gzwmi3wu12.execute-api.us-east-1.amazonaws.com`
- **State Name:** `kaluna-dev-api`

Running state inspection against `prod` (`terraform/environments/prod`) confirms:
- **State API ID:** `o275c5g9h5`
- **State API Endpoint:** `https://o275c5g9h5.execute-api.us-east-1.amazonaws.com`
- **State Name:** `kaluna-prod-api`

### 2.2 Root Cause Mechanism
Why were multiple `kaluna-dev-api` HTTP APIs created in AWS?

1. **Non-Unique Resource Naming in AWS v2 API Gateway:**
   Unlike S3 buckets or IAM roles, AWS API Gateway HTTP API names are non-unique display strings. Multiple API Gateways with the exact same name (`kaluna-dev-api`) can coexist in the same AWS account and region.

2. **CI/CD Pipeline Execution Timeline (Aug 5, 2026):**
   - **13:18:45 UTC**: API `gzwmi3wu12` created. (Tracked in Terraform remote state in `s3://kaluna-terraform-state-496795891920/dev/terraform.tfstate`).
   - **18:13:47 UTC**: Git commit `0ae376c` pushed: *"fix(ci): configure aws credentials for terraform deploy"*.
   - **18:18:53 UTC**: API `teyud9cohl` created during CI run.
   - **18:45:22 UTC**: API `fvbwfweun7` created during CI run.
   - **18:46:25 UTC**: API `d8altyy954` created during CI run.
   - **18:46:49 UTC**: API `pcpooeplr8` created during CI run.

3. **Incomplete / Aborted Apply Runs:**
   In `.github/workflows/deploy.yml`, Terraform runs in an ephemeral GitHub Actions container (`ubuntu-latest`). When step failures occurred (e.g. AWS credential initialization, binary compilation order, or smoke test failures), the `aws_apigatewayv2_api` resource was instantiated first by AWS provider call, but subsequent steps failed. If the state file was not updated or if a fresh apply ran in an unlinked state context, Terraform created a new API instance rather than updating an existing one.

4. **Evidence of Partial Creation:**
   Every single orphaned API (`teyud9cohl`, `fvbwfweun7`, `d8altyy954`, `pcpooeplr8`) exhibits the exact same signature:
   - **Routes Count:** `0`
   - **Integrations Count:** `0`
   - **Authorizers Count:** `1` (`cognito-authorizer`)
   - **Stage Status:** `"Deployment attempt failed: Unable to deploy API because no valid routes exist in this API"`

---

## 3. R2: Complete API Gateway Inventory & Resource Matrix

| API ID | Name | Environment | Created Date (UTC) | State Status | Routes | Integrations | Stage Status | Classification |
|---|---|---|---|---|---|---|---|---|
| `o275c5g9h5` | `kaluna-prod-api` | `prod` | 2026-08-05 22:15:16 | Managed in Prod State | 13 | 3 | Deployed (`5uxxtj`) | **PROTECTED PROD** |
| `gzwmi3wu12` | `kaluna-dev-api` | `dev` | 2026-08-05 13:18:45 | Managed in Dev State | 13 | 3 | Deployed (`89a3mt`) | **ACTIVE DEV** |
| `teyud9cohl` | `kaluna-dev-api` | `dev` | 2026-08-05 18:18:53 | **Unmanaged** | 0 | 0 | Failed (No routes) | **ORPHANED** |
| `fvbwfweun7` | `kaluna-dev-api` | `dev` | 2026-08-05 18:45:22 | **Unmanaged** | 0 | 0 | Failed (No routes) | **ORPHANED** |
| `d8altyy954` | `kaluna-dev-api` | `dev` | 2026-08-05 18:46:25 | **Unmanaged** | 0 | 0 | Failed (No routes) | **ORPHANED** |
| `pcpooeplr8` | `kaluna-dev-api` | `dev` | 2026-08-05 18:46:49 | **Unmanaged** | 0 | 0 | Failed (No routes) | **ORPHANED** |

---

## 4. Deep Dive into Orphaned APIs & Dangling Dependencies

### 4.1 Detailed Orphan Breakdown

#### 1. Orphan #1: `teyud9cohl`
- **ApiId:** `teyud9cohl`
- **Name:** `kaluna-dev-api`
- **CreatedDate:** `2026-08-05 18:18:53+00:00`
- **ProtocolType:** `HTTP`
- **ApiEndpoint:** `https://teyud9cohl.execute-api.us-east-1.amazonaws.com`
- **Routes:** None (0)
- **Integrations:** None (0)
- **Stages:** `$default` (AutoDeploy: `true`, Status Message: `Deployment attempt failed: Unable to deploy API because no valid routes exist in this API`)
- **Authorizer:** `3l0f39` (`cognito-authorizer`, Type: `JWT`, Issuer: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ryDIc2cSX`)
- **Dangling Dependencies:**
  - *CloudWatch Log Groups:* None
  - *IAM Roles / Policies:* None
  - *Lambda Permissions:* None (Verified via `aws lambda get-policy`)

#### 2. Orphan #2: `fvbwfweun7`
- **ApiId:** `fvbwfweun7`
- **Name:** `kaluna-dev-api`
- **CreatedDate:** `2026-08-05 18:45:22+00:00`
- **ProtocolType:** `HTTP`
- **ApiEndpoint:** `https://fvbwfweun7.execute-api.us-east-1.amazonaws.com`
- **Routes:** None (0)
- **Integrations:** None (0)
- **Stages:** `$default` (AutoDeploy: `true`, Status Message: `Deployment attempt failed: Unable to deploy API because no valid routes exist in this API`)
- **Authorizer:** `1g25o0` (`cognito-authorizer`, Type: `JWT`)
- **Dangling Dependencies:**
  - *CloudWatch Log Groups:* None
  - *IAM Roles / Policies:* None
  - *Lambda Permissions:* None

#### 3. Orphan #3: `d8altyy954`
- **ApiId:** `d8altyy954`
- **Name:** `kaluna-dev-api`
- **CreatedDate:** `2026-08-05 18:46:25+00:00`
- **ProtocolType:** `HTTP`
- **ApiEndpoint:** `https://d8altyy954.execute-api.us-east-1.amazonaws.com`
- **Routes:** None (0)
- **Integrations:** None (0)
- **Stages:** `$default` (AutoDeploy: `true`, Status Message: `Deployment attempt failed: Unable to deploy API because no valid routes exist in this API`)
- **Authorizer:** `4vxqai` (`cognito-authorizer`, Type: `JWT`)
- **Dangling Dependencies:**
  - *CloudWatch Log Groups:* None
  - *IAM Roles / Policies:* None
  - *Lambda Permissions:* None

#### 4. Orphan #4: `pcpooeplr8`
- **ApiId:** `pcpooeplr8`
- **Name:** `kaluna-dev-api`
- **CreatedDate:** `2026-08-05 18:46:49+00:00`
- **ProtocolType:** `HTTP`
- **ApiEndpoint:** `https://pcpooeplr8.execute-api.us-east-1.amazonaws.com`
- **Routes:** None (0)
- **Integrations:** None (0)
- **Stages:** `$default` (AutoDeploy: `true`, Status Message: `Deployment attempt failed: Unable to deploy API because no valid routes exist in this API`)
- **Authorizer:** `7wzq36` (`cognito-authorizer`, Type: `JWT`)
- **Dangling Dependencies:**
  - *CloudWatch Log Groups:* None
  - *IAM Roles / Policies:* None
  - *Lambda Permissions:* None

---

### 4.2 Lambda Permission & Policy Verification

Inspection of all Lambda function resource policies (`kaluna-dev-events`, `kaluna-dev-registrations`, `kaluna-dev-checkin`, `kaluna-dev-reminders`, `kaluna-dev-feedback`, and production equivalents) confirms:
- **Dev Events Lambda (`kaluna-dev-events`):** Source ARN condition is strictly tied to `arn:aws:execute-api:us-east-1:496795891920:gzwmi3wu12/*/*`.
- **Dev Registrations Lambda (`kaluna-dev-registrations`):** Source ARN condition is strictly tied to `arn:aws:execute-api:us-east-1:496795891920:gzwmi3wu12/*/*`.
- **Dev Check-in Lambda (`kaluna-dev-checkin`):** Source ARN condition is strictly tied to `arn:aws:execute-api:us-east-1:496795891920:gzwmi3wu12/*/*`.
- **Prod Lambdas:** Source ARN condition is strictly tied to `arn:aws:execute-api:us-east-1:496795891920:o275c5g9h5/*/*`.

**Conclusion:** The 4 orphaned API Gateways have **zero** Lambda permissions remaining on any AWS Lambda function. Deleting the orphaned API Gateways will not break or alter any Lambda policy statements.

---

## 5. Remediation Plan & Safety Guidelines for Worker

### 5.1 Safe Remediation Execution Steps (For Worker)
1. **Target API ID List for Deletion:**
   - `teyud9cohl`
   - `fvbwfweun7`
   - `d8altyy954`
   - `pcpooeplr8`

2. **Explicit Prohibition List (DO NOT TOUCH):**
   - `o275c5g9h5` (`kaluna-prod-api`) — Production API
   - `gzwmi3wu12` (`kaluna-dev-api`) — Active Dev API

3. **AWS CLI Cleanup Commands:**
   ```bash
   aws apigatewayv2 delete-api --api-id teyud9cohl
   aws apigatewayv2 delete-api --api-id fvbwfweun7
   aws apigatewayv2 delete-api --api-id d8altyy954
   aws apigatewayv2 delete-api --api-id pcpooeplr8
   ```

4. **Post-Cleanup Verification:**
   - Run `aws apigatewayv2 get-apis` to ensure exactly 2 APIs remain (`o275c5g9h5` and `gzwmi3wu12`).
   - Run `terraform plan` in `terraform/environments/dev` to verify zero plan changes.
