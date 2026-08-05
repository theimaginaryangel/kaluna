# Security

- **IAM**: one execution role per Lambda, scoped to only the DynamoDB actions/resources it needs. No shared "admin" role for functions.
- **Auth**: Cognito User Pool guards all `/events` write routes, `/registrations` export, `/analytics`. Public read/register/check-in routes stay open by design.
- **Input validation**: every Lambda validates and sanitizes input before touching DynamoDB — reject malformed email, missing fields, out-of-range capacity, before any write.
- **Secrets**: nothing committed to the repo. Terraform variables via `.tfvars` (gitignored) locally, GitHub Actions Secrets in CI.
- **Rate limiting**: API Gateway usage plans on public endpoints to blunt abuse of `/register` and `/check-in`.
- **Transport**: HTTPS only, enforced by API Gateway by default.
- **Data at rest**: DynamoDB encryption at rest (default AWS-managed key, sufficient at this scale).
