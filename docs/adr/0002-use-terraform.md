# 0002 — Use Terraform over CloudFormation/SAM

**Status**: Accepted

**Context**: The assignment brief allows any IaC tool. AWS SAM is purpose-built for serverless and has tighter local-testing integration; CloudFormation is AWS-native; Terraform is cloud-agnostic.

**Decision**: Terraform.

**Consequences**: Slightly more setup than SAM for a pure-serverless stack, but demonstrates an industry-standard, multi-cloud-transferable IaC skill rather than an AWS-only one — relevant given the longer-term goal of cloud security architecture work, which spans providers. Modular structure (`terraform/modules/`) keeps each AWS service isolated and reusable across environments.
