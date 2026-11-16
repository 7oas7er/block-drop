# 0006 — GitHub Environment separation (`staging` / `production`)

- **Status:** accepted
- **Date:** 2026-10-20
- **Amended:** 2026-11-16 — note Environment `terraform` for plan-only OIDC

## Context

One AWS account, two app environments (`stg` / `prod`). Collapsing GitHub Environments onto the same role, bucket, or distribution makes “promote” a silent prod write.

## Decision

- Feature work merges to **`staging`** → deploys **AWS stg** only.
- Promote by merging **`staging` → `main`** → deploys **AWS prod**.
- GitHub Environments `staging` and `production` hold **distinct** deploy roles, buckets, and distributions. Do not point both at the same resources.

A third GitHub Environment, **`terraform`**, exists for **plan-only** OIDC (CI `terraform plan`). It is not a deploy path and does not share the staging/production deploy credentials; see [`infra/terraform/docs/terraform-plan-ci.md`](../../infra/terraform/docs/terraform-plan-ci.md) and [`SECURITY.md`](../../SECURITY.md).

## Consequences

- PRs target `staging` unless Frank asks for a promote-to-`main` PR.
- Agents must not invent prod-only shortcuts or shared deploy credentials across envs.
- Plan CI uses Environment `terraform`; deploy workflows stay on `staging` / `production` only.
