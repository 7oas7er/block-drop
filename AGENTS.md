# Agent definition of done — Block Drop

Instructions for Cursor (and similar) agents working in this repo. Platform rules: [`app-core.mdc`](.cursor/rules/app-core.mdc) (see [`.cursor/rules/README.md`](.cursor/rules/README.md)). Product overlay: [`block-drop-core.mdc`](.cursor/rules/block-drop-core.mdc). Architecture: [`README.md`](README.md). Decisions: [`docs/adr/`](docs/adr/). Secrets: [`SECURITY.md`](SECURITY.md). Cloning a new app: [`.cursor/skills/new-app-from-template/`](.cursor/skills/new-app-from-template/).

## Defaults

- Prefer **small diffs** that match existing patterns. No drive-by refactors outside the task.
- Keep the game under `block-drop/` as **static HTML/CSS/plain JS** — no framework, bundler, package manager, or build step for the game.
- **Terraform** is the source of truth for AWS / Cloudflare / Grafana. Do not reintroduce CDK or manage app resources with CloudFormation.
- **Observability**: Grafana Cloud only. Do not add Checkly, Datadog, New Relic, or similar unless Frank explicitly asks to replace Grafana.
- **Cloudflare** stays DNS/edge (analytics may be pulled *into* Grafana). Do not turn Cloudflare into a second monitoring product or default Workers platform for this app.
- Public apps must **only accept Cloudflare-fronted traffic**; reject direct origin access.

## GitHub workflow

- Feature work: branch → PR → **`staging`** (deploys AWS stg when site paths change).
- Production: PR **`staging` → `main`** only when asked to promote.
- Do **not** push or merge unless Frank asks. Do **not** force-push protected branches.
- Create commits only when asked; follow the repo’s commit / PR conventions.

## Terraform

- CI runs **fmt / validate / plan** only (see `.github/workflows/terraform-plan.yml`). **Never** add or run `terraform apply` in GitHub Actions unless Frank explicitly requests that change and an ADR supersedes [`docs/adr/0003-local-terraform-apply.md`](docs/adr/0003-local-terraform-apply.md).
- New irreversible platform choice → add a short ADR under [`docs/adr/`](docs/adr/) (see that folder’s README).
- Apply locally with `AWS_PROFILE=7oas7er` when Frank asks.
- Never commit `.tfstate`, `terraform.tfvars`, API tokens, or AWS keys.

## Secrets

- Cloudflare: `CLOUDFLARE_API_TOKEN` / analytics tokens via env or gitignored tfvars.
- Grafana: `GRAFANA_*` or gitignored `infra/terraform/grafana/terraform.tfvars`.
- GitHub deploy/plan: Environment secrets and vars; OIDC for AWS — no long-lived access keys in GitHub.

## Definition of done (checklist)

Before considering a task finished:

1. [ ] Change matches the request; no unrelated refactors.
2. [ ] Follows `.cursor/rules` for the area touched (`app-*` platform + `block-drop-*` product overlays).
3. [ ] No secrets or state files staged.
4. [ ] If `block-drop/` or `tests/` changed: note or run relevant tests (`cd tests && npm test` when practical).
5. [ ] If Terraform changed: roots identified; remind Frank to `terraform plan` / `apply` locally; CI plan + Checkov will run on the PR when paths match. New Checkov skips need a one-line justification (`docs/iac-policy.md`). Security header / CSP changes need stg apply first (`docs/security-headers.md`).
6. [ ] If `tests/` or `infra/lambda/` lockfiles changed: `npm audit --audit-level=high` must stay clean (CI workflow `dependency-audit.yml`).
7. [ ] If `block-drop/` or `infra/lambda/` JS changed: expect CodeQL on the PR (`docs/codeql.md`); fix real findings, don’t blanket-suppress.
8. [ ] If asked for a PR: target **`staging`** unless Frank asked for a promote-to-`main` PR.
9. [ ] Docs updated when behavior or operator steps change (README, runbooks under `infra/terraform/docs/`, or this file). Optional: `pre-commit install` locally (`.pre-commit-config.yaml`).

## Explicit non-goals (unless Frank overrides in writing)

- SPA framework / bundler for the game
- Second monitoring SaaS
- CI `terraform apply` by default
- Committing credentials “temporarily”
