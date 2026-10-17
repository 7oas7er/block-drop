# Block Drop AWS Terraform

One AWS account, two environments:

| Env | Root | Hostname |
|-----|------|----------|
| Staging | [`envs/stg`](envs/stg) | `blockdrop-stg.7oas7er.com` |
| Production | [`envs/prod`](envs/prod) | `blockdrop.7oas7er.com` |

Shared module: [`modules/site`](modules/site). The GitHub OIDC provider lives in **stg** only; prod looks it up with a data source.

## Apply order

1. Create/validate an ACM certificate in `us-east-1` for `blockdrop-stg.7oas7er.com` and set `site_certificate_arn` in `envs/stg/terraform.tfvars`.
2. Apply **stg** (switches the existing distribution alias to the staging hostname).
3. Apply Cloudflare with `stg_cloudfront_domain_name` set to the stg `distribution_domain_name` output.
4. Apply **prod** (creates a new stack with `blockdrop.7oas7er.com`).
5. Point Cloudflare `prod_cloudfront_domain_name` at the prod distribution; set GitHub Actions `AWS_*` variables to prod outputs when you want main to publish production.

## Local commands

```bash
cd envs/stg   # or envs/prod
cp terraform.tfvars.example terraform.tfvars   # first time
terraform init
terraform plan
terraform apply
```

GitHub Actions still uses repository variables for a single deploy target. Keep them on staging until prod cutover, then switch them to the prod outputs.
