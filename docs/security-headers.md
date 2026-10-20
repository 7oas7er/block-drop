# Browser security headers

## Ownership

| Layer | Role |
|-------|------|
| **CloudFront** `aws_cloudfront_response_headers_policy.site` | **Source of truth** for viewer security headers (CSP, HSTS, Referrer-Policy, X-Frame-Options, X-Content-Type-Options, XSS-Protection, Permissions-Policy). Attached to default + `/api/scores` behaviors. |
| **Cloudflare** | App root: DNS. Platform `shared-edge`: cache, rate limit, origin-verify **request** header. Does **not** set CSP / Permissions-Policy for this app — avoid duplicating security headers at the edge (double headers / override fights). |
| **S3 / Lambda origins** | Do not rely on origin-emitted security headers; CloudFront policy uses `override = true`. |

Change headers in Terraform (`infra/terraform/aws/modules/site/cloudfront.tf` + `locals.tf`), then `terraform apply` the env roots. Deploy of static files alone does **not** update CSP.

## Current policy (summary)

Defined in `local.content_security_policy` and the response headers policy:

- **CSP** (same-origin vanilla game): `default-src`/`script-src`/`style-src`/`img-src`/`font-src`/`connect-src` `'self'`; `object-src 'none'`; `base-uri`/`form-action`/`frame-ancestors` `'self'`; `upgrade-insecure-requests`. High-scores use same-origin `fetch('/api/scores')` — covered by `connect-src 'self'`. Web Audio needs no extra CSP sources.
- **Permissions-Policy**: disable powerful features the game does not use (`camera`, `microphone`, `geolocation`, `payment`, `usb`, sensors, etc.).
- **HSTS**: 1y, `includeSubDomains`, `preload`.
- **Others**: `nosniff`, `SAMEORIGIN` framing, `strict-origin-when-cross-origin` referrer, XSS filter on.

## Changing CSP safely

1. Edit `locals.tf` → plan/apply **stg** first.
2. Hard-refresh the custom domain; check DevTools → Network → response headers and console for CSP violations.
3. Promote / apply **prod** only when stg is clean.
