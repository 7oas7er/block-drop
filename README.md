# Block Drop

Private falling-block puzzle game, plus the **app-owned** AWS / DNS / Grafana stack that hosts and observes it. This repo is the working reference for a **solo + AI** app template (see [docs/template-readiness-backlog.md](docs/template-readiness-backlog.md)).

**Fundamental design:** each app is an **isolated repository**. Shared Cloudflare zone rulesets and shared Grafana Free objects (Infinity DS, GitHub plugin) live in [`7oas7er/platform`](https://github.com/7oas7er/platform). Apps depend on platform — **never on each other**. Architecture: [`docs/architecture.md`](docs/architecture.md).

The game itself is a static site: HTML, CSS, and plain JavaScript under [`block-drop/`](block-drop/). How to play and how scripts are wired: [`block-drop/README.md`](block-drop/README.md).

## Layout

| Path | Role |
|------|------|
| [`block-drop/`](block-drop/) | Static game (no framework, bundler, or package manager) |
| [`tests/`](tests/) | Node unit tests + Playwright e2e; gates deploy |
| [`infra/terraform/aws/`](infra/terraform/aws/) | Site module + `envs/stg` / `envs/prod` + bootstrap |
| [`infra/terraform/cloudflare/`](infra/terraform/cloudflare/) | **DNS only** for Block Drop hosts (zone rulesets → platform `shared-edge`) |
| [`infra/terraform/grafana/`](infra/terraform/grafana/) | App synthetics, CloudWatch, **prod+stg** dashboards, GitHub DS (Infinity + plugin → platform `shared-obs`; layout [`docs/grafana-dashboard-template.md`](docs/grafana-dashboard-template.md)) |
| [`infra/lambda/`](infra/lambda/) | High-scores Lambda source (zipped by AWS Terraform) |
| [`.cursor/rules/`](.cursor/rules/) | Platform (`app-*`) + product (`block-drop-*`) Cursor rules — see [`.cursor/rules/README.md`](.cursor/rules/README.md) |
| [`.cursor/skills/`](.cursor/skills/) | Project skills (`new-app-from-template`, `gap-against-app-template`) |
| [`AGENTS.md`](AGENTS.md) | Definition of done for AI-assisted changes |
| [`docs/architecture.md`](docs/architecture.md) | App vs shared-platform ownership |
| [`docs/`](docs/) | Template backlog, ADRs, cross-cutting docs |
| [`docs/maintenance.md`](docs/maintenance.md) | Ongoing patch / Dependabot cadence |
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
| [`.github/workflows/codeql.yml`](.github/workflows/codeql.yml) | CodeQL SAST for `block-drop/`, `infra/lambda/`, and Actions workflows |

Deploy auth is GitHub OIDC → env-specific IAM roles (no long-lived AWS keys in GitHub). Dependabot opens weekly PRs to `staging` for Actions, Playwright, the Lambda AWS SDK, and **Terraform providers** (per root). Ongoing cadence: [`docs/maintenance.md`](docs/maintenance.md). Branch rules: [`docs/github-branch-protection.md`](docs/github-branch-protection.md). Action SHA pins: [`docs/github-actions-pinning.md`](docs/github-actions-pinning.md). Checkov: [`docs/iac-policy.md`](docs/iac-policy.md). CodeQL: [`docs/codeql.md`](docs/codeql.md). Security headers: [`docs/security-headers.md`](docs/security-headers.md).

## Terraform (local apply)

Apply stays on your machine. Typical profile:

```bash
export AWS_PROFILE=7oas7er
```

Roots (separate state keys under the shared state bucket):

- `infra/terraform/aws/bootstrap`
- `infra/terraform/aws/envs/stg` and `envs/prod`
- `infra/terraform/cloudflare` (DNS)
- `infra/terraform/grafana` (app dashboards / synthetics / CW / GitHub DS)

Plus platform roots (separate repo / state): `shared-edge`, `shared-obs` — see [`7oas7er/platform`](https://github.com/7oas7er/platform).

Never commit `.tfstate`, `terraform.tfvars`, API tokens, or AWS keys. Setup notes:

- [Architecture](docs/architecture.md)
- [Terraform plan CI](infra/terraform/docs/terraform-plan-ci.md)
- [Origin-verify secret rotation](infra/terraform/docs/origin-verify-secret-rotation.md)
- [AWS README](infra/terraform/aws/README.md)
- [Cloudflare README](infra/terraform/cloudflare/README.md)
- [Grafana README](infra/terraform/grafana/README.md)

## Observability

**Grafana Cloud Free** only: synthetics, CloudWatch scrape, Cloudflare edge analytics (via GraphQL into Grafana), GitHub Actions panels. Do not add a second monitoring SaaS. Shared Infinity + GitHub plugin: platform `shared-obs`. Cloudflare remains DNS/edge (plus analytics pulled into Grafana)—not an APM product.

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

**Pre-commit** (optional but recommended — catches `terraform fmt` and unit-test regressions before CI):

```bash
pipx install pre-commit   # or: brew install pre-commit
pre-commit install
pre-commit run --all-files
```

Config: [`.pre-commit-config.yaml`](.pre-commit-config.yaml). Hooks run `terraform fmt` under `infra/terraform/` and `npm run test:unit` when `tests/` or `block-drop/js/` change. Full `terraform validate` stays in CI (needs init/backends).

## Working with Cursor / agents

Follow [`AGENTS.md`](AGENTS.md) and rules under [`.cursor/rules/`](.cursor/rules/) (`app-*` platform + `block-drop-*` product). New app from this pattern: [`.cursor/skills/new-app-from-template/`](.cursor/skills/new-app-from-template/). Gap-analyze / migrate an existing repo: [`.cursor/skills/gap-against-app-template/`](.cursor/skills/gap-against-app-template/). Decisions: [`docs/adr/`](docs/adr/). Backlog: [`docs/template-readiness-backlog.md`](docs/template-readiness-backlog.md).
