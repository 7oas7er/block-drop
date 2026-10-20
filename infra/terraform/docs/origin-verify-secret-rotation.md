# Origin-verify secret rotation

Block Drop only accepts traffic that arrives through Cloudflare. Cloudflare injects
`X-Origin-Verify`; a CloudFront Function rejects any other value (including direct
`*.cloudfront.net` hits).

The same secret is stored in **two places** (gitignored `terraform.tfvars` only):

| Side | Where | Variable(s) |
|------|------|-------------|
| Inject header | Platform repo `infra/terraform/shared-edge` | `blockdrop_stg_origin_verify_secret` / `blockdrop_prod_origin_verify_secret` (and Netrunner vars there) |
| Accept header | This repo `infra/terraform/aws/envs/{stg\|prod}` | `origin_verify_secret` (+ optional `origin_verify_secret_previous`) |

Block Drop’s Cloudflare root is **DNS-only** and does not manage the inject ruleset.

Prefer **distinct secrets per environment**. Never commit real values. The secret also
appears in Terraform state and in the published CloudFront Function source for anyone
with `cloudfront:DescribeFunction` / `GetFunction`.

## Why dual-accept

Updating only one side first causes **site-wide 403s**. The AWS Function can accept
**current and previous** secrets during cutover so rotation is zero-downtime.

## Rotate one environment (recommended)

Do **stg first**, then **prod**. Keep each env’s secret different.

### 0. Prep

```bash
# Strong random secret (example); store offline until both tfvars are updated.
openssl rand -base64 32
```

Have AWS profile `7oas7er` and `CLOUDFLARE_API_TOKEN` ready. Confirm Grafana/synthetic
checks for that env are green before and after.

### 1. Dual-accept on AWS (old + new)

In `infra/terraform/aws/envs/<env>/terraform.tfvars`:

```hcl
origin_verify_secret          = "<NEW_SECRET>"
origin_verify_secret_previous = "<OLD_SECRET>"
```

```bash
cd infra/terraform/aws/envs/<env>   # stg or prod
terraform apply
```

Confirm plan updates only `aws_cloudfront_function.origin_verify` (and the distribution
association if the function ARN/etag changes). Site must still work (Cloudflare still
sends the old secret).

### 2. Point Cloudflare at the new secret (platform shared-edge)

In the **platform** repo `infra/terraform/shared-edge/terraform.tfvars`, set the matching
Block Drop variable to `<NEW_SECRET>` (`blockdrop_stg_origin_verify_secret` or
`blockdrop_prod_origin_verify_secret`).

```bash
cd …/platform/infra/terraform/shared-edge
terraform apply
```

Confirm plan updates only the origin-verify ruleset header value for that env.

### 3. Verify

- Browser: `https://blockdrop-stg.7oas7er.com` or `https://blockdrop.7oas7er.com` loads.
- API: `GET /api/scores` returns 200 through Cloudflare.
- Direct CloudFront URL still returns 403.

### 4. Drop previous on AWS

In `infra/terraform/aws/envs/<env>/terraform.tfvars`:

```hcl
origin_verify_secret = "<NEW_SECRET>"
# origin_verify_secret_previous = null   # or delete the line
```

```bash
cd infra/terraform/aws/envs/<env>
terraform apply
```

## Rollback

1. On platform shared-edge, set the inject secret back to the old value → `terraform apply`.
2. On AWS, set `origin_verify_secret` to the old value and clear
   `origin_verify_secret_previous` → `terraform apply`.

## Notes

- Do not leave `origin_verify_secret_previous` set longer than needed (widens the
  accept window).
- Netrunner secrets on the same zone are rotated the same way in shared-edge + that
  app’s AWS roots — not in this Cloudflare root.
