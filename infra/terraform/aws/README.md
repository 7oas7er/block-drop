# Block Drop AWS Terraform

One AWS account, two environments:

| Env | Root | Hostname |
|-----|------|----------|
| Staging | [`envs/stg`](envs/stg) | `blockdrop-stg.7oas7er.com` |
| Production | [`envs/prod`](envs/prod) | `blockdrop.7oas7er.com` |

Shared module: [`modules/site`](modules/site). The GitHub OIDC provider lives in **stg** only; prod looks it up with a data source.

Bootstrap root: [`bootstrap`](bootstrap) creates the shared S3 state bucket and DynamoDB lock table.

## Remote state

State is stored in S3 (not git):

| Root | State key |
|------|-----------|
| `bootstrap` | `bootstrap/terraform.tfstate` |
| `envs/stg` | `envs/stg/terraform.tfstate` |
| `envs/prod` | `envs/prod/terraform.tfstate` |
| `../cloudflare` | `cloudflare/terraform.tfstate` |

- Bucket: `shared-block-drop-terraform-state-bucket` (versioned, encrypted, private)
- Lock table: `shared-block-drop-terraform-lock-table`

After cloning the repo on a new machine, run `terraform init` in each root (with AWS profile `7oas7er`). No local state copy is required.

Local `*.tfstate` / `*.tfstate.*` files remain gitignored. Old local backups under each env can be deleted once you are satisfied the remote state is correct.

## Resource naming

AWS resource names follow:

`[environment]-block-drop-[purpose]-[resource-type]`

Examples for `stg`:

- `stg-block-drop-site-bucket`
- `stg-block-drop-high-scores-bucket`
- `stg-block-drop-high-scores-function`
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
6. Point Cloudflare `prod_cloudfront_domain_name` at the prod distribution; set GitHub Actions `AWS_*` variables to prod outputs.

## Cloudflare origin verify

CloudFront rejects requests that lack a matching `X-Origin-Verify` header. Cloudflare Transform Rules inject that header for the Block Drop hostnames, so only orange-cloud traffic is accepted. Direct `*.cloudfront.net` URLs return 403.

- Set the same value in `envs/stg` `origin_verify_secret` and Cloudflare `stg_origin_verify_secret`.
- Set the same value in `envs/prod` `origin_verify_secret` and Cloudflare `prod_origin_verify_secret`.
- Prefer distinct secrets per environment. Store them only in local `terraform.tfvars` (gitignored).
- Apply Cloudflare **before** enabling/updating the CloudFront Function gate so legitimate traffic is never locked out.
- GitHub Actions S3 sync and CloudFront invalidation do not use the viewer path and are unaffected.

## Local commands

```bash
cd bootstrap   # first time / changes to state backend resources
# or: cd envs/stg   # or envs/prod
cp terraform.tfvars.example terraform.tfvars   # first time, if needed
terraform init
terraform plan
terraform apply
```
