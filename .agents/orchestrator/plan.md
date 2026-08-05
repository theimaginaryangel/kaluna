# Plan — Kaluna CI/CD Pipeline Deployment Fix & System Hardening

## Objective
Audit and fix the Kaluna CI/CD pipeline deployment job in `.github/workflows/deploy.yml` which fails due to missing AWS credentials during Terraform execution. Ensure credentials step `aws-actions/configure-aws-credentials@v2` is configured with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and region `us-east-1` right before `Terraform Init`. Commit the fix to the `develop` branch with human-like commit messages.

## Phased Approach

### Phase 1: Exploration & Audit of CI/CD Workflow
- Dispatch `teamwork_preview_explorer` (`teamwork_preview_explorer_cicd`) to inspect `.github/workflows/deploy.yml`, verify current step ordering, secret references, branch status, and git state.

### Phase 2: Implementation & Commit
- Dispatch `teamwork_preview_worker` (`teamwork_preview_worker_cicd`) to update `.github/workflows/deploy.yml` inserting `aws-actions/configure-aws-credentials@v2` before `Terraform Init`, configure secrets, and commit changes to `develop` branch with human-like commit message.

### Phase 3: Review & Verification
- Dispatch `teamwork_preview_reviewer` to check YAML syntax, action versions, step order, and git commit history on `develop`.
- Dispatch `teamwork_preview_challenger` to validate workflow formatting, secret keys matching GitHub repository secrets convention, and branch targets.
- Dispatch `teamwork_preview_auditor` to conduct forensic integrity audit confirming no hardcoding or dummy credentials.

### Phase 4: Final Synthesis & Reporting
- Update `PROJECT.md`, `BRIEFING.md`, `progress.md`, and `handoff.md`.
- Report completion to parent user liaison.
