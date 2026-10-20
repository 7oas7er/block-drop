#!/usr/bin/env bash
# Verify Free-plan GraphQL analytics datasets for the Block Drop zone.
# Requires: CLOUDFLARE_API_TOKEN (Zone Analytics Read), CLOUDFLARE_ZONE_TAG (zone id).
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN (Zone Analytics Read)}"
: "${CLOUDFLARE_ZONE_TAG:?Set CLOUDFLARE_ZONE_TAG (Cloudflare zone id / zoneTag)}"

QUERY='query($zoneTag: String) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      settings {
        httpRequestsAdaptiveGroups {
          enabled
          maxDuration
          maxPageSize
          notOlderThan
        }
        firewallEventsAdaptive {
          enabled
          maxDuration
          maxPageSize
          notOlderThan
        }
        firewallEventsAdaptiveGroups {
          enabled
          maxDuration
          maxPageSize
          notOlderThan
        }
      }
    }
  }
}'

BODY=$(CLOUDFLARE_ZONE_TAG="$CLOUDFLARE_ZONE_TAG" QUERY="$QUERY" python3 - <<'PY'
import json, os
print(json.dumps({
  "query": os.environ["QUERY"],
  "variables": {"zoneTag": os.environ["CLOUDFLARE_ZONE_TAG"]},
}))
PY
)

curl -sS "https://api.cloudflare.com/client/v4/graphql" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BODY" | python3 -m json.tool
