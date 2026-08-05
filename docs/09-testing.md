# Testing

Four layers, all run in CI before anything reaches dev:

1. **Unit tests** — pytest + `moto` (mocked AWS) for Python Lambdas; `go test` for the check-in service. Cover the success path and at least one failure path (event full, duplicate registration, invalid ticket) per handler.
2. **Integration tests** — invoke Lambda handlers against a local DynamoDB (`dynamodb-local`) to catch issues unit mocks miss.
3. **API tests** — a Postman/Newman collection generated from `openapi.yaml`, run against the deployed dev environment after each deploy.
4. **Smoke tests** — post-deploy `/health` check; deploy is marked failed and can auto-rollback if it doesn't return healthy.

No PR merges with failing CI.
