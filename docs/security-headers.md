# Browser security headers

## Ownership

| Layer | Role |
|-------|------|
| **CloudFront** `aws_cloudfront_response_headers_policy.site` | **Source of truth** for viewer security headers (CSP, HSTS, Referrer-Policy, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, COOP, CORP). Attached to default + `/api/scores` behaviors. Also removes `x-amzn-trace-id` from origin responses. |
| **CloudFront Function** `strip_aws_headers` (viewer-response on `/api/scores` only) | Drops `x-amzn-trace-id`, `x-amzn-requestid`, and `x-amzn-errortype` before the response reaches the browser. Needed because CloudFront **response-headers policies cannot remove** `X-Amzn-RequestId` / `X-Amzn-ErrorType` (AWS deny list). |
| **Cloudflare** | App root: DNS. Platform `shared-edge`: cache, rate limit, origin-verify **request** header. Does **not** set CSP / Permissions-Policy for this app — avoid duplicating security headers at the edge (double headers / override fights). |
| **S3 / Lambda origins** | Do not rely on origin-emitted security headers; CloudFront policy uses `override = true`. |

Change headers in Terraform (`infra/terraform/aws/modules/site/cloudfront.tf` + `locals.tf` + `strip_aws_headers.js.tftpl`), then `terraform apply` the env roots. Deploy of static files alone does **not** update CSP or header policy.

## Current policy (summary)

Defined in `local.content_security_policy` and the response headers policy:

- **CSP** (same-origin vanilla game): `default-src`/`script-src`/`style-src`/`img-src`/`font-src`/`connect-src` `'self'`; `object-src 'none'`; `base-uri`/`form-action`/`frame-ancestors` `'self'`; `upgrade-insecure-requests`. High-scores use same-origin `fetch('/api/scores')` — covered by `connect-src 'self'`. Web Audio needs no extra CSP sources.
- **Permissions-Policy**: disable powerful features the game does not use (`camera`, `microphone`, `geolocation`, `payment`, `usb`, sensors, etc.).
- **HSTS**: 1y, `includeSubDomains`, `preload`.
- **COOP / CORP**: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` (defence-in-depth; no COEP — this app does not need `crossOriginIsolated`).
- **Others**: `nosniff`, `SAMEORIGIN` framing, `strict-origin-when-cross-origin` referrer.
- **Not set**: legacy `X-XSS-Protection` (omitted; ignored by modern browsers).

## AWS fingerprinting headers (`/api/scores`)

| Header | Mechanism |
|--------|-----------|
| `x-amzn-trace-id` | `remove_headers_config` + viewer-response Function |
| `x-amzn-requestid` | viewer-response Function only |
| `x-amzn-errortype` | viewer-response Function only |

`Via` and `x-amz-cf-*` cannot be removed via response-headers policy either; left as-is (no secrets).

## Changing headers / CSP safely

1. Edit `cloudfront.tf` / `locals.tf` / Function template → plan/apply **stg** first.
2. Hard-refresh the custom domain; check DevTools → Network → response headers (and console for CSP violations). For API: `curl -sSID - https://blockdrop-stg.7oas7er.com/api/scores` and confirm `x-amzn-*` are gone and COOP/CORP are present on HTML.
3. Promote / apply **prod** only when stg is clean.
