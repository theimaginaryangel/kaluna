# Deployment

## Environments

`dev` → `staging` → `prod`, each with its own Terraform state and resource naming (`kaluna-{env}-*`).

## Pipeline (GitHub Actions)

```
push to feature/* → PR → CI: lint + unit tests
merge to develop   → deploy to dev
merge to main      → deploy to prod (staging gate optional as usage grows)
```

Steps per deploy:
1. Run Python + Go unit tests
2. Package Lambda functions (zip for Python, compiled binary for Go)
3. `terraform plan` — posted as a PR comment for review on production changes
4. `terraform apply` on merge
5. Post-deploy smoke test hits `/health` before marking the deploy successful
6. Frontend (prod): `npm ci && npm run build` with `NEXT_PUBLIC_*` inlined from secrets, then `aws s3 sync` to the frontend bucket
7. `aws cloudfront create-invalidation` against `/*` using `CLOUDFRONT_DISTRIBUTION_ID`

No manual `terraform apply` from a local machine against prod — everything goes through the pipeline, so the deployment history in GitHub Actions is the audit trail for infrastructure changes.

## Required secrets

Configured as repository secrets (Settings → Secrets and variables → Actions); no values are hardcoded in source.

| Secret | Used for |
|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS CLI auth (Terraform + frontend deploy) |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront cache invalidation after the frontend S3 sync |
| `NEXT_PUBLIC_API_URL` | Inlined into the frontend build (API base URL) |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Inlined into the frontend build (admin login) |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Inlined into the frontend build (admin login) |
