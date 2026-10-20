# Cursor rules — platform vs product

Rules split so this repo can be cloned as a **solo + AI** template without fighting `block-drop-*` names forever.

| Kind | Prefix | Role |
|------|--------|------|
| **Platform** | `app-*` | Public web app in **one AWS account**, Cloudflare edge, Grafana-first, Terraform SoT |
| **Product** | `block-drop-*` | This puzzle game only (static `block-drop/`, names, domains, `/api/scores`) |

When cloning for a new app: keep `app-*`, replace or delete `block-drop-*`, and follow the skill `.cursor/skills/new-app-from-template/`.

When **gap-analyzing or migrating** an existing repo toward this pattern: `.cursor/skills/gap-against-app-template/` (also in personal Agent Store).

## Files

| Rule | Scope |
|------|--------|
| `app-core.mdc` | always — hosting, envs, secrets, Cloudflare-only, agents |
| `app-aws-regions.mdc` | always — `eu-north-1` default |
| `app-observability.mdc` | always — Grafana pattern |
| `app-terraform.mdc` | `infra/terraform/**` — roots, state, CI plan |
| `app-deploy.mdc` | `.github/workflows/**` — OIDC deploy / promote |
| `block-drop-core.mdc` | always — product + pointers to platform |
| `block-drop-frontend.mdc` | `block-drop/**` |
| `block-drop-terraform.mdc` | `infra/terraform/**` — naming, domains, high-scores |
| `block-drop-deploy.mdc` | `.github/workflows/**` — this app’s workflow |
| `block-drop-observability.mdc` | always — this app’s labels / dashboard path |
