# Architecture — Block Drop in the solo+AI platform

## Fundamental split

**Each app is an isolated repository.** Shared multi-tenant edge and Grafana Free objects live in [`7oas7er/platform`](https://github.com/7oas7er/platform). This app depends on platform; it must **not** be a dependency of Netrunner (or any sibling).

```text
7oas7er/platform  (shared-edge, shared-obs)
        ▲
        │  app → platform only
        │
   block-drop (this repo)     netrunner / future apps
```

Full platform write-up: [platform docs/architecture.md](https://github.com/7oas7er/platform/blob/main/docs/architecture.md). Decision: [ADR 0007](adr/0007-shared-edge-and-obs-platform.md) (mirrors platform ADR 0001).

## What this repo owns

| Path | Role |
|------|------|
| `block-drop/` | Static game |
| `infra/terraform/aws/` | S3, CloudFront, Lambda high-scores, OIDC deploy/plan |
| `infra/terraform/cloudflare/` | **DNS only** for Block Drop hosts |
| `infra/terraform/grafana/` | Folder, **prod+stg** dashboards, synthetics, CloudWatch scrape, GitHub DS `github-block-drop` (layout: [`grafana-dashboard-template.md`](grafana-dashboard-template.md)) |
| `.github/workflows/` | Tests, deploy, terraform plan (never apply) |

## What platform owns (do not recreate here)

- Zone rulesets: origin-verify, cache, www/apex redirects, `/api/scores` rate limit, SSL
- Shared Infinity DS `infinity-cloudflare` and GitHub catalog **plugin**

## Traffic path

Browser → Cloudflare (custom domain) → inject `X-Origin-Verify` → CloudFront → S3 (and `/api/scores` → Lambda). Direct CloudFront URLs return 403.

## New apps

Use [`.cursor/skills/new-app-from-template/`](../.cursor/skills/new-app-from-template/) — always wire DNS-only Cloudflare + platform `shared-edge` / `shared-obs`; never put zone rulesets or Infinity into the new app’s first PR as “owned by Block Drop.”
