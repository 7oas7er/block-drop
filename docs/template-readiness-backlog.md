# Block Drop → personal app template — readiness backlog

Goal: keep Block Drop healthy, then extract a reusable **solo + AI** template for future apps without abandoning intentional simplicity (static frontend where it fits, Terraform SoT, Grafana-first, local `terraform apply`).

Work top-down. Prefer small PRs to `staging`. Check items off as you go (`[x]`).

**Legend**

| Priority | Meaning |
|----------|---------|
| P0 | Do first — unblocks “template” clarity or closes real security gaps |
| P1 | High leverage for AI consistency / maintainability |
| P2 | Strong template polish; do after P0–P1 |
| P3 | Nice later / optional; only if pain appears |

---

## P0 — Foundation (template front door + security floor)

### P0.1 — Root architecture README

- [x] Add a repo-root `README.md` (or expand if one appears) that covers:
  - What the product is (one paragraph)
  - Layout: `block-drop/`, `tests/`, `infra/terraform/{aws,cloudflare,grafana}/`, `infra/lambda/`
  - Env model: `staging` → AWS stg; `main` → AWS prod; promote via PR
  - CI: tests + deploy; Terraform **fmt/validate/plan only** (apply stays local)
  - Secrets: never commit `terraform.tfvars` / state; profiles `7oas7er`; OIDC in Actions
  - Observability: Grafana only; Cloudflare = DNS/edge (+ analytics pulled into Grafana)
  - Pointer to this backlog and to `.cursor/rules/`
- [x] Link existing runbooks (`infra/terraform/docs/*`) from that README

**Why:** Today knowledge is split across rules and nested docs; a template needs one front door for humans and agents.

### P0.2 — Agent definition of done (`AGENTS.md`)

- [x] Add `AGENTS.md` with short, enforceable norms, e.g.:
  - Prefer small diffs; match existing patterns
  - No new SaaS / no CDK / no game bundler unless explicitly asked
  - PRs target `staging`; never invent prod-only shortcuts
  - Terraform: plan in CI, apply only when Frank asks / local
  - Secrets only in gitignored tfvars or CI Environments
  - After substantive changes: relevant tests / note what to plan-apply
- [x] Cross-link `.cursor/rules/block-drop-core.mdc` (or future generic rules)

**Why:** Highest leverage against AI architecture drift.

### P0.3 — IaC policy scan in CI

- [ ] Add a GitHub Actions job (new workflow or step in `terraform-plan.yml`) running **Checkov** or **Trivy config** on `infra/terraform/**`
- [ ] Fail PRs on high/critical findings (tune allowlist sparingly)
- [ ] Document how to suppress a finding with justification

**Why:** AI-authored Terraform is the main regression surface; Dependabot does not cover this.

### P0.4 — Dependency audit in CI

- [ ] On PRs that touch `tests/` or `infra/lambda/`, run `npm audit` (or OSV-Scanner) with a clear fail threshold (e.g. high+)
- [ ] Keep Dependabot weekly updates targeting `staging` (already present)
- [ ] Treat open **high/critical** Dependabot alerts on default branches as merge blockers (process + optional GitHub ruleset)

**Why:** You already saw a high alert on the default branch; audits make that a gate, not a surprise.

### P0.5 — Branch protection / required checks (documented + enabled)

- [ ] Document required checks for `staging` and `main` (tests; terraform plan when infra paths change)
- [ ] Enable GitHub branch protection / rulesets accordingly
- [ ] Confirm secret scanning + push protection are on for the repo

**Why:** Solo now; templates need this written and enforced before a second human (or busier AI loop) arrives.

---

## P1 — AI maintainability and extractable pattern

### P1.1 — Lightweight decision log (ADRs)

- [ ] Add `docs/adr/` (or a single `docs/decisions.md`) with short entries for:
  - Static game delivery (no framework/bundler)
  - Terraform not CDK
  - Local `terraform apply` (not CI apply)
  - Grafana-first observability; Cloudflare not a second APM
  - Cloudflare-only origin traffic
  - GitHub env separation (`staging` / `production`)
- [ ] Rule of thumb: new irreversible choice → ½-page ADR

**Why:** Agents re-litigate decisions unless “why” is durable.

### P1.2 — Generalize Cursor rules for templating

- [ ] Split product-specific vs platform rules (e.g. `app-core`, `app-aws-regions`, `app-observability` vs `block-drop-frontend`)
- [ ] Keep Block Drop specifics thin; point platform rules at “public web app in one AWS account”
- [ ] Update `alwaysApply` / globs so clones don’t fight `block-drop-*` naming forever

**Why:** Required before “File → New project from this pattern.”

### P1.3 — Cursor Skill or personal-store “new app from template”

- [ ] Capture a skill/runbook: copy layout, rename project, new S3 state keys, new Grafana folder labels, new GitHub Environments, checklist for first apply
- [ ] Include “first PR” and “first promote to main” steps

**Why:** Turns this repo from a one-off into a repeatable education tool.

### P1.4 — Local pre-commit (or Lefthook)

- [ ] Hooks: `terraform fmt -check`, optional `terraform validate` on changed roots, `npm test` (unit) under `tests/` when JS/tests change
- [ ] Document install in root README

**Why:** Catches AI drive-by formatting/logic before CI.

### P1.5 — SECURITY.md + secret/incident pointers

- [ ] Add `SECURITY.md`: how to report issues; what to do if `CLOUDFLARE_*` / Grafana / origin-verify / GitHub PAT leaks
- [ ] Link `infra/terraform/docs/origin-verify-secret-rotation.md`
- [ ] One paragraph on rotating Grafana / Cloudflare analytics tokens used by Terraform

**Why:** Template-grade hygiene; cheap insurance.

---

## P2 — Security and supply-chain polish

### P2.1 — SAST intentionality (CodeQL / Semgrep)

- [ ] Confirm CodeQL (or Semgrep) covers `block-drop/**` and `infra/lambda/**` on PRs to `staging`/`main`
- [ ] Document expected alerts vs ignore noise
- [ ] Fix or explicitly waive findings

**Why:** You already have CodeQL appearing in Actions history; make it a deliberate gate.

### P2.2 — Browser hardening pass (public site)

- [ ] CSP appropriate for static game + high-scores API
- [ ] `Permissions-Policy` (and related headers) via CloudFront/Cloudflare as fits the stack
- [ ] Document header ownership (CloudFront response headers vs Cloudflare)

**Why:** Worth doing for any public template site; secondary to IaC/deps.

### P2.3 — Supply-chain attestations (optional but modern)

- [ ] Pin Actions by SHA where not already (or document Dependabot grouping as enough)
- [ ] Consider artifact attestation for deploy tarball / Lambda zip if packaging grows
- [ ] Skip npm provenance until you publish packages

**Why:** 2024–2026 supply-chain baseline without overbuilding a static game.

### P2.4 — Terraform CI apply (explicitly deferred)

- [ ] **Do not** add CI `terraform apply` until there is multi-operator pain or repeated “forgot to apply”
- [ ] If revisited: Environment approvals, path filters, separate apply role, never on PRs

**Why:** Captured as a conscious non-goal so agents don’t “helpfully” add it.

---

## P3 — Nice later / only if needed

- [ ] OpenTelemetry full stack — skip for static + Lambda URL unless complexity explodes
- [ ] Cloudflare Workers / R2 as default edge compute — only when a future app needs it; keep DNS/edge rule
- [ ] Second observability SaaS — never without explicit decision + ADR
- [ ] Formal pen test / bug bounty — when the template hosts something higher stakes than a private puzzle game
- [ ] Multi-account AWS Organizations landing zone as code — only if account sprawl becomes real
- [ ] Renovate instead of Dependabot — preference only; Dependabot is fine
- [ ] OpenTofu migration — only with a clear reason

---

## Suggested implementation order (sprints)

| Sprint | Items | Outcome |
|--------|-------|---------|
| **1** | P0.1, P0.2 | Humans + agents share one front door and DoD — **done** |
| **2** | P0.3, P0.4, P0.5 | PRs fail on bad IaC / bad deps; branches protected |
| **3** | P1.1, P1.5 | Decisions and security contact path written down |
| **4** | P1.2, P1.3 | Extractable template pattern (rules + skill) |
| **5** | P1.4, P2.1, P2.2 | Local gates + SAST + headers |
| **Later** | P2.3, P3 | As appetite / risk demands |

---

## Explicitly out of scope for “great template”

- Rewriting the game into a SPA framework
- Replacing Terraform with CDK/Pulumi
- Moving `terraform apply` into Actions “by default”
- Adding Datadog/New Relic/Checkly alongside Grafana
- Turning Cloudflare into an application platform for Block Drop

---

## Progress tracking

| ID | Status | PR / notes |
|----|--------|------------|
| P0.1 | done | Root `README.md` |
| P0.2 | done | `AGENTS.md` |
| P0.3 | | |
| P0.4 | | |
| P0.5 | | |
| P1.1 | | |
| P1.2 | | |
| P1.3 | | |
| P1.4 | | |
| P1.5 | | |
| P2.1 | | |
| P2.2 | | |
| P2.3 | | |
| P2.4 | deferred | Local apply remains default |

When an item ships, tick the checkbox and add the PR link in the table.
