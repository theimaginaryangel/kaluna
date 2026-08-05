# Monitoring & Observability

- **Structured logs**: every Lambda logs JSON with `requestId`, `eventId`, `action`, `latencyMs`, `status` — see `00-engineering-spec.md` for the exact shape.
- **CloudWatch Alarms**: Lambda error rate, Lambda throttles, API Gateway 4xx/5xx rate, DynamoDB throttled requests.
- **X-Ray**: tracing enabled across API Gateway → Lambda → DynamoDB, so a slow request can be traced to the exact hop that's slow.
- **Health endpoint**: `GET /health` checks DynamoDB connectivity and reports service version — used both by the deploy pipeline's smoke test and by an optional CloudWatch Synthetics canary.
- **AWS Budgets**: alert threshold set below Free Tier limits so a runaway loop or bug gets caught before it costs money.
