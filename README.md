# Kaluna

A serverless event registration and ticketing platform on AWS — built to replace Microsoft Forms + Excel with a real API, QR-based check-in, and an admin dashboard with live capacity and attendance tracking.

Built as an Azubi Africa capstone, engineered like a small production system rather than a coursework assignment.

## Stack

- **Architecture**: API Gateway -> Lambda -> DynamoDB
- **Compute**: AWS Lambda — Python (events, registrations), Go (check-in)
- **API**: Amazon API Gateway, `/api/v1`
- **Data**: DynamoDB, single-table design
- **Auth**: Amazon Cognito (admin routes only)
- **Email**: Amazon SES
- **Infrastructure**: Terraform, modular, dev/staging/prod
- **CI/CD**: GitHub Actions
- **Observability**: CloudWatch + X-Ray

## Documentation

Start here: [`docs/00-engineering-spec.md`](docs/00-engineering-spec.md)

| Doc | Covers |
|---|---|
| [01-problem.md](docs/01-problem.md) | Why this exists |
| [02-requirements.md](docs/02-requirements.md) | Functional & non-functional requirements |
| [03-architecture.md](docs/03-architecture.md) | System design |
| [04-api.md](docs/04-api.md) | Endpoint reference (see also [`openapi.yaml`](openapi.yaml)) |
| [05-database.md](docs/05-database.md) | DynamoDB schema & access patterns |
| [06-security.md](docs/06-security.md) | IAM, auth, validation |
| [07-deployment.md](docs/07-deployment.md) | CI/CD pipeline |
| [08-monitoring.md](docs/08-monitoring.md) | Logging, alarms, tracing |
| [09-testing.md](docs/09-testing.md) | Test strategy |
| [10-cost-analysis.md](docs/10-cost-analysis.md) | AWS cost breakdown |
| [11-decisions.md](docs/11-decisions.md) | ADR index |
| [12-future-roadmap.md](docs/12-future-roadmap.md) | What's deliberately out of v1 |

## Repository structure

```
terraform/       Infrastructure as code (modules + dev/staging/prod)
services/         Lambda source — events, registrations (Python), checkin (Go)
frontend/         Antigravity-built static frontend
docs/             Engineering spec, architecture, ADRs
openapi.yaml      API contract
.github/workflows CI/CD pipeline
```

## Status

Backend build (Phases 1-6) is fully complete. The system is ready to be deployed. The frontend implementation is currently pending.

## Quick Start (Deployment)

1. **Authenticate with AWS**: Ensure your AWS CLI is configured with an IAM user that has administrative privileges.
   ```bash
   aws configure
   ```
2. **Deploy via Terraform**:
   ```bash
   cd terraform/environments/dev
   terraform init
   terraform apply
   ```
3. **Verify Email**: AWS will send a verification link to your designated sender email (e.g., `contact@bennyduah.com`). Click it to allow Amazon SES to send ticket confirmations.
4. **Create Admin User**: Cognito public sign-ups are disabled. Create your admin account via CLI:
   ```bash
   aws cognito-idp admin-create-user --user-pool-id <YOUR_POOL_ID> --username contact@bennyduah.com
   ```
5. **Test**: Hit the `/health` endpoint on your newly generated API Gateway URL to verify the system is live!
