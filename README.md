# Kaluna

A serverless event registration and ticketing platform on AWS — built to replace Microsoft Forms + Excel with a real API, QR-based check-in, and an admin dashboard with live capacity and attendance tracking.

Built as an Azubi Africa capstone, engineered like a small production system rather than a coursework assignment.

## Stack

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

Design phase complete. Build in progress — see [`12-future-roadmap.md`](docs/12-future-roadmap.md) for what's intentionally not built yet.
