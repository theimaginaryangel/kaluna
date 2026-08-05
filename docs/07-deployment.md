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

No manual `terraform apply` from a local machine against prod — everything goes through the pipeline, so the deployment history in GitHub Actions is the audit trail for infrastructure changes.
