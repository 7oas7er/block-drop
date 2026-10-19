# Block Drop AWS Terraform

One AWS account, two environments:

| Env | Root | Hostname |
|-----|------|----------|
| Staging | [`envs/stg`](envs/stg) | `blockdrop-stg.7oas7er.com` |
| Production | [`envs/prod`](envs/prod) | `blockdrop.7oas7er.com` |

Shared module: [`modules/site`](modules/site). The GitHub OIDC provider lives in **stg** only; prod looks it up with a data source.

Bootstrap root: [`bootstrap`](bootstrap) creates the shared S3 state bucket.

## Remote state

State is stored in S3 (not git):

| Root | State key |
|------|-----------|
| `bootstrap` | `bootstrap/terraform.tfstate` |
| `envs/stg` | `envs/stg/terraform.tfstate` |
| `envs/prod` | `envs/prod/terraform.tfstate` |
| `../cloudflare` | `cloudflare/terraform.tfstate` |
| `../grafana` | `grafana/terraform.tfstate` |

- Bucket: `shared-block-drop-terraform-state-bucket` (versioned, encrypted, private)
- Locking: S3 native lock files (`use_lockfile = true`); requires Terraform **>= 1.10**
- After changing backend lock settings, run `terraform init -reconfigure` in that root

After cloning the repo on a new machine, run `terraform init` in each root (with AWS profile `7oas7er`). No local state copy is required.

Local `*.tfstate` / `*.tfstate.*` files remain gitignored. Old local backups under each env can be deleted once you are satisfied the remote state is correct.

## Resource naming

AWS resource names follow:

`[environment]-block-drop-[purpose]-[resource-type]`

Examples for `stg`:

- `stg-block-drop-site-bucket`
- `stg-block-drop-access-logs-bucket`
- `stg-block-drop-high-scores-bucket`
- `stg-block-drop-high-scores-function`
- `stg-block-drop-high-scores-errors-alarm` / `…-throttles-alarm` / `…-site-5xx-alarm`
- `stg-block-drop-high-scores-role`
- `stg-block-drop-github-deploy-role`
- `stg-block-drop-site-oac`
- `stg-block-drop-site-distribution` (CloudFront comment / `Name` tag)

Shared bootstrap resources use `shared` as the environment segment.

Renaming named resources (buckets, roles, functions, OACs) forces Terraform to replace them. Copy site and high-score objects to the new buckets before destroying the old ones, and update GitHub Actions `AWS_*` variables after the prod deploy role / bucket names change. The high-scores bucket has `prevent_destroy`; remove that lifecycle guard temporarily if you intentionally replace it.

## Apply order

1. Apply **bootstrap** once (already done if the state bucket exists).
2. Create/validate an ACM certificate in `us-east-1` for `blockdrop-stg.7oas7er.com` and set `site_certificate_arn` in `envs/stg/terraform.tfvars`.
3. Apply **stg**.
4. Apply Cloudflare with `stg_cloudfront_domain_name` set to the stg `distribution_domain_name` output.
5. Apply **prod**.
6. Point Cloudflare `prod_cloudfront_domain_name` at the prod distribution.
7. Put Terraform deploy outputs into GitHub Environments: `staging` ← stg outputs, `production` ← prod outputs (`AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `AWS_SITE_BUCKET`, `AWS_DISTRIBUTION_ID`). Also set `SITE_HOST` (`blockdrop-stg.7oas7er.com` / `blockdrop.7oas7er.com`), `CLOUDFLARE_ZONE_ID` (Cloudflare `zone_id` output), and secret `CLOUDFLARE_API_TOKEN` (Zone Cache Purge) so deploy can purge the Cloudflare edge.
8. Deploy path: merge to `staging` for stg; merge `staging` → `main` for prod. OIDC subjects match the GitHub Environments (`…:environment:staging` / `…:environment:production`); lock Environments to those branches in GitHub deployment rules.

## Access logging

Each env module creates a private `{env}-block-drop-access-logs-bucket` (SSE-S3, Block Public Access, 90-day lifecycle):

- **CloudFront** standard logging **v2** (CloudWatch Logs delivery → S3 prefix `cloudfront/`; delivery APIs in `us-east-1`, bucket in `eu-north-1`). Uses JSON output (not Parquet) to avoid conversion charges.
- **S3 site bucket** server access logs → prefix `s3-site/`.

## Lambda logs and CloudWatch alarms

- High-scores Lambda log group `/aws/lambda/{env}-block-drop-high-scores-function` is managed in Terraform with **14-day** retention (override via `lambda_log_retention_days`).
- Metric alarms (no SNS yet — visible in the CloudWatch console; Grafana remains the primary external monitor):
  - Lambda **Errors** and **Throttles** (eu-north-1)
  - CloudFront **5xxErrorRate** > 5% (us-east-1, Global dimension)
- Existing log groups are adopted via `import` blocks in `envs/stg/imports.tf` and `envs/prod/imports.tf`. After the first successful apply you can delete those blocks if you prefer; leaving them is harmless once the resource is in state.

## Cloudflare origin verify

CloudFront rejects requests that lack a matching `X-Origin-Verify` header. Cloudflare Transform Rules inject that header for the Block Drop hostnames, so only orange-cloud traffic is accepted. Direct `*.cloudfront.net` URLs return 403.

- Set the same value in `envs/stg` `origin_verify_secret` and Cloudflare `stg_origin_verify_secret`.
- Set the same value in `envs/prod` `origin_verify_secret` and Cloudflare `prod_origin_verify_secret`.
- Prefer distinct secrets per environment. Store them only in local `terraform.tfvars` (gitignored).
- Apply Cloudflare **before** enabling/updating the CloudFront Function gate so legitimate traffic is never locked out.
- **Rotation**: follow [origin-verify secret rotation](../docs/origin-verify-secret-rotation.md) (dual-accept via optional `origin_verify_secret_previous`, then switch Cloudflare, then drop the previous secret).
- GitHub Actions S3 sync, CloudFront invalidation, and Cloudflare cache purge do not use the viewer path and are unaffected.
- Cloudflare cache rules (`infra/terraform/cloudflare/cache.tf`) respect origin `Cache-Control` for Block Drop hosts and bypass `/api/*`.
- Cloudflare rate limiting (`infra/terraform/cloudflare/rate_limit.tf`) blocks IPs that exceed ~20 requests / 10s to `/api/scores` (Free-plan limits: one rule, path-only expression, 10s windows).
- Cloudflare redirect rule (`infra/terraform/cloudflare/redirects.tf`) sends www/apex to `https://blockdrop.7oas7er.com` (301, path + query preserved). Host-header override is Enterprise-only; redirects keep ACM + CloudFront aliases on the canonical hostname only.

## High-scores Lambda package

Node.js 22 does not ship the AWS SDK. Before `terraform plan` / `apply` in `envs/stg` or `envs/prod`:

```bash
cd infra/lambda
npm ci --omit=dev
```

Terraform zips `high-scores.js` + `node_modules` (see `modules/site/lambda.tf`). A `check` block fails the plan if `@aws-sdk/client-s3` is missing. Details: [`infra/lambda/README.md`](../../lambda/README.md).

## CI plan

GitHub Actions runs `terraform fmt` / `validate` / `plan` on infra changes (see [terraform-plan-ci.md](../docs/terraform-plan-ci.md)). Apply remains local. After creating the plan role, store `github_terraform_plan_role_arn` and related secrets on GitHub Environment **terraform**.

## Local commands

```bash
export AWS_PROFILE=7oas7er
# From repo root — once / after lambda lockfile changes:
#   cd infra/lambda && npm ci --omit=dev
cd bootstrap   # first time / changes to state backend resources
# or: cd envs/stg   # or envs/prod
cp terraform.tfvars.example terraform.tfvars   # first time, if needed
terraform init -reconfigure   # if you previously had profile= in the backend
terraform plan
terraform apply
```
