#!/usr/bin/env bash
#
# Submit the site's URLs to IndexNow (Bing, Yandex, and other participating
# engines) so a fresh deploy is picked up without waiting for an organic crawl.
#
# Why this exists: Bing Webmaster showed the homepage "discovered but not
# crawled" for months — low crawl priority for a young domain. IndexNow pushes
# URLs directly to Bing's index queue instead of waiting to be crawled.
#
# The key is hosted at https://vectismail.com/<key>.txt (public/<key>.txt in
# this repo). IndexNow verifies ownership by fetching that file and matching
# its contents to the `key` field below.
#
# Usage:
#   bash scripts/indexnow-submit.sh                 # submit every URL in the sitemap
#   bash scripts/indexnow-submit.sh https://vectismail.com/ https://vectismail.com/pricing/
#                                                   # submit only the given URLs
set -euo pipefail

HOST="vectismail.com"
KEY="5b34759e221c87a5e1c215a950f027f1"
KEY_LOCATION="https://${HOST}/${KEY}.txt"
ENDPOINT="https://api.indexnow.org/indexnow"

# Collect URLs: explicit args win; otherwise pull <loc> entries from the built sitemap.
if [[ $# -gt 0 ]]; then
	URLS=("$@")
else
	SITEMAP="dist/sitemap-0.xml"
	if [[ ! -f "$SITEMAP" ]]; then
		echo "⚠ $SITEMAP not found — run 'npm run build' first, or pass URLs explicitly." >&2
		exit 1
	fi
	mapfile -t URLS < <(grep -oE '<loc>[^<]+</loc>' "$SITEMAP" | sed -E 's#</?loc>##g')
fi

if [[ ${#URLS[@]} -eq 0 ]]; then
	echo "⚠ No URLs to submit." >&2
	exit 1
fi

echo "▶ Submitting ${#URLS[@]} URL(s) to IndexNow (${ENDPOINT})…"
BODY=$(python3 - "$HOST" "$KEY" "$KEY_LOCATION" "${URLS[@]}" <<'PY'
import json, sys
host, key, key_location, *urls = sys.argv[1:]
print(json.dumps({"host": host, "key": key, "keyLocation": key_location, "urlList": urls}))
PY
)

CODE=$(curl -s -o /tmp/indexnow_resp.txt -w '%{http_code}' -X POST "$ENDPOINT" \
	-H "Content-Type: application/json; charset=utf-8" --data "$BODY")

# IndexNow returns 200 (accepted) or 202 (accepted, key validation pending).
if [[ "$CODE" == "200" || "$CODE" == "202" ]]; then
	echo "✓ IndexNow accepted the submission (HTTP $CODE)."
else
	echo "⚠ IndexNow returned HTTP $CODE:" >&2
	cat /tmp/indexnow_resp.txt >&2 2>/dev/null || true
	echo >&2
	exit 1
fi
