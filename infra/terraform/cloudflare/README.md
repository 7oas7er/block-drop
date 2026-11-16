# Cloudflare — Block Drop (DNS only)

Manages DNS for `blockdrop.7oas7er.com` and `blockdrop-stg.7oas7er.com` on zone `7oas7er.com`.

Does **not** manage zone apex or `www` (homepage owns `www`; apex → `www` redirect lives in platform `shared-edge`).

**Zone rulesets** (origin-verify, cache, apex redirects, `/api/scores` rate limit, SSL mode) are owned by the platform repo:

https://github.com/7oas7er/platform → `infra/terraform/shared-edge`

Do not recreate competing zone rulesets here (Cloudflare allows one ruleset per phase).

```bash
export AWS_PROFILE=7oas7er
export CLOUDFLARE_API_TOKEN=…   # Zone.DNS Edit + Zone.Read (+ Cache Purge for deploy)
cd infra/terraform/cloudflare
terraform init && terraform apply
```

## State reconcile (after removing www / root from this root)

Live `www` is owned by the homepage Cloudflare root (same Cloudflare record id that this state may still track). **Do not `terraform apply` until state is reconciled**, or apply will destroy/hijack homepage `www`.

```bash
export AWS_PROFILE=7oas7er
export CLOUDFLARE_API_TOKEN=…   # Zone.DNS Edit + Zone.Read
cd infra/terraform/cloudflare
terraform init
terraform state list | grep -E 'cloudflare_dns_record\.(www|root)$'
# Drop stale addresses from state only (does not call Cloudflare destroy):
terraform state rm 'cloudflare_dns_record.www' 'cloudflare_dns_record.root'
terraform plan   # expect: no changes to DNS (or only blockdrop / blockdrop_stg drift)
# Only then:
terraform apply
```

Confirm plan shows **no** destroy of `www` / `@` before apply.
