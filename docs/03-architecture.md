# Architecture

## Overview

```
GitHub ──push──▶ GitHub Actions (CI/CD)
                        │
                  test → build → terraform plan/apply
                        │
                 ┌──────┴──────┐
           dev/staging       prod (main branch only)
                        │
        ┌───────────────┴────────────────┐
        │                                │
  API Gateway (/api/v1)            IAM (least privilege,
        │                          one role per Lambda)
   ┌────┴─────┬──────────────┐
   │           │              │
Public API  Admin API   Check-in API
   │           │  (Cognito)   │  (Go)
   │           │              │
   └─────┬─────┴──────────────┘
         │
  Lambda Functions (Python: events, registrations)
         │
   DynamoDB (single table: events, registrations, tickets, audit log)
         │
  ┌──────┴──────┐
Amazon SES   CloudWatch Logs/Alarms + X-Ray
(confirmation    │
 emails)     AWS Budgets (Free Tier cost tracking)
```

## Component roles

| Component | Role |
|---|---|
| API Gateway | Single entry point, `/api/v1` versioned, routes to Lambda by resource |
| Lambda (Python) — Events service | Event CRUD, capacity math |
| Lambda (Python) — Registrations service | Register/cancel, idempotency check, seat decrement, triggers SES email |
| Lambda (Go) — Check-in service | QR validation, duplicate-scan prevention, attendance logging — isolated because check-in is latency-sensitive (happening live at the door) and benefits from Go's faster cold start |
| DynamoDB | Single table for events, registrations, ticket lookups, and audit log — one system, one access pattern to reason about |
| Cognito | Admin authentication only; public endpoints stay open |
| SES | Transactional email — confirmation, ticket, QR |
| CloudWatch + X-Ray | Structured logs, alarms on error rate/throttling, distributed tracing across the API Gateway → Lambda → DynamoDB path |
| Terraform | All infrastructure as code, modular, three environments |
| GitHub Actions | Test → build → deploy pipeline, gated on green CI |

## Why these choices (short version — full reasoning in `docs/adr/`)

- **DynamoDB over RDS**: serverless-native, scales to zero, no connection pool management inside Lambda
- **Single-table over multi-table**: one set of access patterns, fewer round trips, standard practice at this scale
- **Terraform over CloudFormation/SAM**: industry-standard IaC beyond AWS-only tooling, transferable skill
- **Python + Go split**: Python for business logic (fast to write, first-class AWS SDK support), Go for the check-in path specifically, where cold-start latency matters most
- **Cognito over custom auth**: managed, free tier covers this project's usage, avoids reinventing session/token handling

## Environments

`dev` → `staging` → `prod`, each a separate Terraform state, same modules with environment-scoped variables (`eventflow-dev-*`, `eventflow-staging-*`, `eventflow-prod-*`). `develop` branch auto-deploys to dev; `main` deploys to prod on merge.

## v2 (post-MVP)

Once v1 is deployed and stable: CloudFront in front of the static frontend, EventBridge for scheduled reminders. Not built until the core system is proven.
