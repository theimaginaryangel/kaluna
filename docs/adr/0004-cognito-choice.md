# 0004 — Cognito for admin auth

**Status**: Accepted

**Context**: Admin routes (event CRUD, registrations export, analytics) need authentication. Options were a custom JWT implementation, API keys, or Amazon Cognito.

**Decision**: Amazon Cognito User Pool, admin routes only. Public routes (browse, register, check-in) stay unauthenticated by design.

**Consequences**: Free tier (50,000 MAUs) comfortably covers portfolio-demo usage at $0. Avoids reinventing token issuance/refresh/rotation. Adds one more AWS service to configure and document, which is itself worth showing — IAM/Cognito configuration is a real skill gap most portfolio projects skip.
