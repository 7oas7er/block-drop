# Block Drop

Private falling-block puzzle game, plus the AWS / Cloudflare / Grafana stack that hosts and observes it. This repo is also the working reference for a **solo + AI** app template (see [docs/template-readiness-backlog.md](docs/template-readiness-backlog.md)).

The game itself is a static site: HTML, CSS, and plain JavaScript under [`block-drop/`](block-drop/). How to play and how scripts are wired: [`block-drop/README.md`](block-drop/README.md).

## Layout

| Path | Role |
|------|------|
| [`block-drop/`](block-drop/) | Static game (no framework, bundler, or package manager) |
| [`tests/`](tests/) | Node unit tests + Playwright e2e; gates deploy |
| [`infra/terraform/aws/`](infra/terraform/aws/) | Site module + `envs/stg` / `envs/prod` + bootstrap |
| [`infra/terraform/cloudflare/`](infra/terraform/cloudflare/) | DNS, cache, rate limit, origin-verify headers, redirects |
| [`infra/terraform/grafana/`](infra/terraform/grafana/) | Synthetics, CloudWatch scrape, dashboards, data sources |
| [`infra/lambda/`](infra/lambda/) | High-scores Lambda source (zipped by AWS Terraform) |
| [`.cursor/rules/`](.cursor/rules/) | Platform (`app-*`) + product (`block-drop-*`) Cursor rules — see [`.cursor/rules/README.md`](.cursor/rules/README.md) |
| [`.cursor/skills/`](.cursor/skills/) | Project skills (e.g. new app from template) |
| [`AGENTS.md`](AGENTS.md) | Definition of done for AI-assisted changes |
| [`docs/`](docs/) | Template backlog, ADRs, cross-cutting docs |
| [`SECURITY.md`](SECURITY.md) | Reporting + secret leak / rotation pointers |

## Environments and promotion

- Feature work → PR into **`staging`** → deploys **AWS stg** only.
- Promote to production by merging **`staging` → `main`** → deploys **AWS prod**.
- GitHub Environments `staging` / `production` hold distinct deploy roles, buckets, and distributions. Do not point both at the same resources.

## CI / CD

| Workflow | What it does |
|----------|----------------|
| [`.github/workflows/deploy-block-drop.yml`](.github/workflows/deploy-block-drop.yml) | Unit + Playwright; on push to `staging`/`main`, syncs `block-drop/` to S3, invalidates CloudFront, purges Cloudflare (when site paths change) |
| [`.github/workflows/terraform-plan.yml`](.github/workflows/terraform-plan.yml) | `fmt` / **Checkov** / `validate` / **plan** for changed Terraform roots (OIDC read-only plan role). **Never applies.** |
| [`.github/workflows/dependency-audit.yml`](.github/workflows/dependency-audit.yml) | `npm audit --audit-level=high` for `tests/` and `infra/lambda/` when those lockfiles change |
| [`.github/workflows/required-ci.yml`](.github/workflows/required-ci.yml) | Always-on PR check (`Required CI`) for branch rulesets |

Deploy auth is GitHub OIDC → env-specific IAM roles (no long-lived AWS keys in GitHub). Dependabot opens weekly PRs to `staging` for Actions, Playwright, and the Lambda AWS SDK. Branch rules and required check names: [`docs/github-branch-protection.md`](docs/github-branch-protection.md). Checkov suppressions: [`docs/iac-policy.md`](docs/iac-policy.md).

## Terraform (local apply)

Apply stays on your machine. Typical profile:

```bash
export AWS_PROFILE=7oas7er
```

Roots (separate state keys under the shared state bucket):

- `infra/terraform/aws/bootstrap`
- `infra/terraform/aws/envs/stg` and `envs/prod`
- `infra/terraform/cloudflare`
- `infra/terraform/grafana`

Never commit `.tfstate`, `terraform.tfvars`, API tokens, or AWS keys. Setup notes:

- [Terraform plan CI](infra/terraform/docs/terraform-plan-ci.md)
- [Origin-verify secret rotation](infra/terraform/docs/origin-verify-secret-rotation.md)
- [AWS README](infra/terraform/aws/README.md)
- [Grafana README](infra/terraform/grafana/README.md)

## Observability

**Grafana Cloud Free** only: synthetics, CloudWatch scrape, Cloudflare edge analytics (via GraphQL into Grafana), GitHub Actions panels. Do not add a second monitoring SaaS. Cloudflare remains DNS/edge (plus analytics pulled into Grafana)—not an APM product.

## Security principles

- Public traffic must arrive via **Cloudflare**; direct CloudFront (or other origin) URLs are rejected (origin-verify header gate).
- Secrets live in gitignored tfvars, GitHub Environment secrets, or env vars—not in git.
- Reporting and leak response: [`SECURITY.md`](SECURITY.md). Durable “why” for stack choices: [`docs/adr/`](docs/adr/).

## Local development

**Game:** open `block-drop/index.html` in a browser (see [`block-drop/README.md`](block-drop/README.md)).

**Tests:**

```bash
cd tests
npm ci
npx playwright install chromium
npm test
```

Details: [`tests/README.md`](tests/README.md).

## Working with Cursor / agents

Follow [`AGENTS.md`](AGENTS.md) and rules under [`.cursor/rules/`](.cursor/rules/) (`app-*` platform + `block-drop-*` product). New app from this pattern: skill [`.cursor/skills/new-app-from-template/`](.cursor/skills/new-app-from-template/). Decisions: [`docs/adr/`](docs/adr/). Backlog: [`docs/template-readiness-backlog.md`](docs/template-readiness-backlog.md).
