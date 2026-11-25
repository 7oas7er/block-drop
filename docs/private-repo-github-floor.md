# Private-repo GitHub security floor (template)

Use this when the new or migrated app must stay **private** (copyright, map assets, non-public source). Prefer this path over flipping visibility solely to unlock Free rulesets.

**Reference implementation:** [`7oas7er/long-way-home`](https://github.com/7oas7er/long-way-home) — merged PR [#12](https://github.com/7oas7er/long-way-home/pull/12) on `staging` (gitleaks + Semgrep CE inside Required CI). Copy that repo’s Required CI scanner jobs when cloning for a private app; do **not** add them to **this** public Block Drop repo.

Public-app floor (this repo): [`github-branch-protection.md`](github-branch-protection.md).

## Visibility fork (scanners)

| Visibility | Secrets | SAST | Ruleset-required context |
|------------|---------|------|--------------------------|
| **Public** | GitHub secret scanning + push protection | In-repo CodeQL advanced setup; default setup **off** | `Required CI` only (pin check; **no** gitleaks/Semgrep jobs) |
| **Private** (no GHAS) | **gitleaks** in Required CI | **Semgrep CE** in Required CI; no CodeQL SARIF upload | Same single context: `Required CI` (aggregate fails on scanner findings) |

Do **not** buy GitHub Advanced Security solely for native private secret scanning / CodeQL upload unless Frank decides otherwise.

## Plan entitlement (private repos)

| Entitlement | What works on a **private** repo |
|-------------|----------------------------------|
| **GitHub Free** | Rulesets **unavailable** (`403 Upgrade to GitHub Pro or make this repository public`). Classic branch protection API exists but still needs an **admin** credential. Native secret scanning / push protection typically unavailable (`security_and_analysis: null` or enable fails). |
| **GitHub Pro** (account-wide) | **Preferred unlock for private rulesets** (Block Drop–style `default` on `main`+`staging`). Classic protection remains a valid fallback. |
| **GHAS** | Unlocks native secret scanning + CodeQL SARIF upload on private repos. |

### Pro ≠ secret scanning / CodeQL

**Pro alone does not unlock** private secret scanning, push protection, or CodeQL result upload. Those need **GHAS** (or public visibility). Do **not** document “Pro usually gets secret scanning.” Verified on long-way-home: Pro private without GHAS → enable secret scanning **422** (`Secret scanning is not available` / Advanced Security not purchased).

Until GHAS: embed **gitleaks** + **Semgrep CE** in Required CI (below). Keep GitHub **default** code scanning setup **off**.

## Preferred path (Pro): ruleset `default`

Same shape as public Block Drop. One active ruleset covering `refs/heads/main` and `refs/heads/staging`:

| Rule | Value |
|------|--------|
| Restrict deletions | On (`deletion`) |
| Block force pushes | On (`non_fast_forward`) |
| Require a pull request before merging | On — **0** approvals while solo |
| Require status checks to pass | On — context **`Required CI`** only (`strict` optional / default off) |
| Require signed commits | On (`required_signatures`) |

Do **not** add path-filtered check names (`Game tests`, Checkov, CodeQL, `gitleaks`, `Semgrep`, …) as separate required contexts — missing or duplicate contexts block merges. Fold private scanners into the aggregate `Required CI` job.

## Classic protection fallback

Use when rulesets POST fails, or before Pro. Apply on **`main`** and **`staging`**:

| Setting | Value |
|---------|--------|
| Require a pull request before merging | On (0 approvals while solo) |
| Require status checks to pass | On — context **`Required CI`** only |
| Require branches to be up to date | Optional (`strict`); default off until Required CI has run |
| Allow force pushes | Off |
| Allow deletions | Off |
| Require signed commits | Classic `…/protection/required_signatures` if API accepts |
| Include administrators | Prefer On (`enforce_admins`) |

## Compensating CI (no GHAS)

Reference workflow: long-way-home [`.github/workflows/required-ci.yml`](https://github.com/7oas7er/long-way-home/blob/staging/.github/workflows/required-ci.yml) (PR #12).

| Control | Compensates | Pattern |
|---------|-------------|---------|
| **gitleaks** | Secret scanning + push protection | Parallel job; full history checkout; findings fail aggregate `Required CI` |
| **Semgrep CE** | CodeQL / code scanning | Image pin (e.g. `semgrep/semgrep:1.185.0`); configs `p/default` + `p/github-actions` + `p/terraform`; `semgrep scan --error`; no App token / no SARIF; aggregate fails on findings |

Ruleset still requires only the **`Required CI`** context. Do **not** add `gitleaks` / `Semgrep` as separate ruleset-required check names.

**Block Drop (this public repo):** keep GitHub-native secret scanning + in-repo CodeQL. Do **not** ship gitleaks/Semgrep jobs here.

## Apply via `gh` (needs **repo admin** / owner `gh auth` as `7oas7er`)

Cloud Agent / GitHub App installation tokens often have `contents:write` but **not** `administration`. Expect `403 Resource not accessible by integration` on rulesets POST, classic protection, vulnerability-alerts, and Actions permissions until an **admin** credential runs these.

```bash
REPO=OWNER/REPO   # e.g. 7oas7er/long-way-home

# 0) Prefer ruleset (Pro / public). Skip if you intentionally use classic only.
gh api -X POST "repos/$REPO/rulesets" --input - <<'EOF'
{
  "name": "default",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": ["refs/heads/main", "refs/heads/staging"]
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "require_extra_approval_for_unattributed_changes": true,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [{ "context": "Required CI" }]
      }
    },
    { "type": "required_signatures" }
  ],
  "bypass_actors": []
}
EOF
# If a ruleset named default already exists, GET …/rulesets for id, then PUT …/rulesets/{id}.

# 1) Classic fallback (optional if ruleset landed).
for BR in main staging; do
  gh api -X PUT "repos/$REPO/branches/$BR/protection" --input - <<EOF
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["Required CI"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": false
}
EOF
  gh api -X POST "repos/$REPO/branches/$BR/protection/required_signatures" || true
done

# 2) Dependabot alerts
gh api -X PUT "repos/$REPO/vulnerability-alerts"

# 3) Secret scanning + push protection — expect 422 on private without GHAS.
#    Do not mark enabled from checklist text. Use gitleaks in Required CI instead.
gh api -X PATCH "repos/$REPO" --input - <<'EOF'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
EOF

# 4) Actions GITHUB_TOKEN read-only
gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false

# 5) Hygiene
gh api -X PATCH "repos/$REPO" -F has_issues=false -F has_wiki=false -F has_projects=false
```

**Required CI name:** the check context must match the **job `name:`** in `.github/workflows/required-ci.yml` — `Required CI`. GitHub only offers a context after the workflow has run at least once on the branch.

## Verify

```bash
REPO=OWNER/REPO
gh api "repos/$REPO" --jq '{default_branch, private, security_and_analysis, has_issues, has_wiki, has_projects}'
gh api -i "repos/$REPO/vulnerability-alerts" | head -n 1   # expect 204 when alerts enabled
gh api "repos/$REPO/actions/permissions/workflow"
gh api "repos/$REPO/rulesets" --jq '.[] | {id,name,enforcement,include: .conditions.ref_name.include}'
# Detail one ruleset (replace ID):
# gh api "repos/$REPO/rulesets/ID" --jq '{name,enforcement,rules:[.rules[].type]}'
for BR in main staging; do
  gh api "repos/$REPO/branches/$BR/protection" --jq '{
    required_status_checks: .required_status_checks.contexts,
    allow_force_pushes: .allow_force_pushes.enabled,
    allow_deletions: .allow_deletions.enabled,
    enforce_admins: .enforce_admins.enabled,
    pr_reviews: .required_pull_request_reviews.required_approving_review_count
  }' 2>/dev/null || echo "$BR: no classic protection (OK if ruleset-only)"
  gh api "repos/$REPO/branches/$BR/protection/required_signatures" --jq .enabled 2>/dev/null || true
done
```

**Expect after Pro + admin apply:** ruleset `default` active on `main`+`staging` with `deletion`, `non_fast_forward`, `pull_request`, `required_status_checks` (`Required CI`), `required_signatures`; Dependabot alerts 204; workflow perms `read` / cannot approve; issues/wiki/projects false. Secret scanning may remain unavailable without GHAS — that is expected; Required CI must carry gitleaks + Semgrep.

## Signed commits

| Mechanism | Private Free | Private Pro |
|-----------|--------------|-------------|
| Ruleset `{ "type": "required_signatures" }` | **Unavailable** | **Preferred** |
| Classic `…/protection/required_signatures` | Try POST; else process-only | Optional fallback |
| Frank’s key | GPG `413A590799A3CF31AB2C9ECDE27E5FD506790203` / `frank@schlesinger.com` on the GitHub account | same |

Cloud Agent VMs often sign as **Cursor Agent** via SSH (`gpg.format=ssh`), not Frank’s GPG — those commits may show as verified under the agent identity, not Frank’s key. Prefer Frank re-sign or merge via UI when `required_signatures` is on.

## Learnings (private apps)

1. **Free private → no rulesets.** Classic protection is the Free fallback; **Pro is required** for private ruleset enforcement (preferred to match the public-app floor without going public).
2. **Pro ≠ GHAS.** Pro unlocks rulesets; it does **not** unlock secret scanning or CodeQL SARIF on private repos. Compensate with gitleaks + Semgrep CE in Required CI.
3. Admin Settings APIs need an **admin** token — installation tokens that can push may still 403 on rulesets / protection / vulnerability-alerts / Actions permissions (`administration=write`).
4. After Pro, confirm unlock with `GET …/rulesets` → **200** (even `[]`), not the Free upgrade error — then POST the Block Drop–style `default` ruleset.
5. Require only **`Required CI`**; keep path-filtered suites advisory until they run; fold private scanners into that aggregate job.
6. Prefer Access (Zero Trust Free ≤50 users) when live assets must stay non-world-readable.
7. Keep product files under a slug dir so CI path filters match the public-app template.
