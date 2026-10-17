# Block Drop AWS Terraform

One AWS account, two environments:

| Env | Root | Hostname |
|-----|------|----------|
| Staging | [`envs/stg`](envs/stg) | `blockdrop-stg.7oas7er.com` |
| Production | [`envs/prod`](envs/prod) | `blockdrop.7oas7er.com` |

Shared module: [`modules/site`](modules/site). The GitHub OIDC provider lives in **stg** only; prod looks it up with a data source.

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

Renaming named resources (buckets, roles, functions, OACs) forces Terraform to replace them. Copy site and high-score objects to the new buckets before destroying the old ones, and update GitHub Actions `AWS_*` variables after the prod deploy role / bucket names change. The high-scores bucket has `prevent_destroy`; remove that lifecycle guard temporarily if you intentionally replace it.

## Apply order

1. Create/validate an ACM certificate in `us-east-1` for `blockdrop-stg.7oas7er.com` and set `site_certificate_arn` in `envs/stg/terraform.tfvars`.
2. Apply **stg**.
3. Apply Cloudflare with `stg_cloudfront_domain_name` set to the stg `distribution_domain_name` output.
4. Apply **prod**.
5. Point Cloudflare `prod_cloudfront_domain_name` at the prod distribution; set GitHub Actions `AWS_*` variables to prod outputs.

## Local commands

```bash
cd envs/stg   # or envs/prod
cp terraform.tfvars.example terraform.tfvars   # first time
terraform init
terraform plan
terraform apply
```
