# Cloudflare

Terraform for the DNS name that publishes Block Drop. The CDK app in `infra/` still owns the bucket, the CloudFront distribution, and the ACM certificate. This directory manages the Cloudflare CNAME for `blockdrop.7oas7er.com`.

State stays on this machine. `terraform.tfvars` is ignored by git.

## Token

Create a Cloudflare API token that can read the `7oas7er.com` zone and edit its DNS. Export it before any Terraform command that talks to Cloudflare:

```sh
export CLOUDFLARE_API_TOKEN="..."
```

## First run

The CNAME already exists. Import it before the first apply, or Terraform will try to create a second record.

```sh
cp terraform.tfvars.example terraform.tfvars
```

Set `cloudfront_domain_name` in `terraform.tfvars` to the distribution domain (`dxxxx.cloudfront.net`). The zone ID and the DNS record ID are on the zone overview and the DNS record page in the Cloudflare dashboard.

```sh
terraform init
terraform import cloudflare_dns_record.site '<zone_id>/<dns_record_id>'
terraform plan
```

`proxied` defaults to false, so the name resolves directly to CloudFront. Review the plan before `terraform apply`, and change `proxied` if the live record is orange-clouded.
