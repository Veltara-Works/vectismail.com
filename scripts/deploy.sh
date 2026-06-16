#!/usr/bin/env bash
#
# Build, deploy to Cloudflare Pages, and purge the edge cache.
#
# Why the purge step: a zone Cache Rule edge-caches the marketing HTML
# (trailing-slash page routes, /api/* excluded) for up to 1h. A plain
# `wrangler pages deploy` does NOT purge that cache, so without this step a
# fresh deploy can serve stale HTML until the edge TTL expires. Hashed assets
# under /_astro/* are content-addressed and safe to re-fetch, so a full
# purge_everything is correct and cheap.
#
# Cloudflare credentials for the purge are read from the environment (never
# committed):
#   CLOUDFLARE_API_TOKEN                  scoped token (preferred), or
#   CF_API_KEY + CF_API_EMAIL            legacy global key
# Zone is taken from CF_ZONE_ID, else resolved by name (CF_ZONE_NAME, default
# vectismail.com). If no credentials are present the deploy still succeeds and
# the purge is skipped with a warning.
#
# Usage:  bash scripts/deploy.sh "optional commit message"
set -euo pipefail

ZONE_NAME="${CF_ZONE_NAME:-vectismail.com}"
COMMIT_MSG="${1:-deploy}"

echo "▶ Building…"
npm run build

echo "▶ Deploying to Cloudflare Pages…"
# --commit-message is passed explicitly to avoid wrangler's git-derived UTF-8 gotcha.
npx wrangler pages deploy dist --commit-message="$COMMIT_MSG"

echo "▶ Purging Cloudflare edge cache for $ZONE_NAME…"
if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
	AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
elif [[ -n "${CF_API_KEY:-}" && -n "${CF_API_EMAIL:-}" ]]; then
	AUTH=(-H "X-Auth-Email: $CF_API_EMAIL" -H "X-Auth-Key: $CF_API_KEY")
else
	echo "⚠ No Cloudflare credentials in env (CLOUDFLARE_API_TOKEN, or CF_API_KEY + CF_API_EMAIL)."
	echo "  Skipping purge — HTML may serve stale for up to the edge TTL (1h)."
	exit 0
fi

ZID="${CF_ZONE_ID:-}"
if [[ -z "$ZID" ]]; then
	ZID=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME" "${AUTH[@]}" \
		| python3 -c "import json,sys;d=json.load(sys.stdin);print(d['result'][0]['id'] if d.get('success') and d.get('result') else '')")
fi
if [[ -z "$ZID" ]]; then
	echo "⚠ Could not resolve zone id for $ZONE_NAME; skipping purge."
	exit 0
fi

RESP=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZID/purge_cache" \
	"${AUTH[@]}" -H "Content-Type: application/json" --data '{"purge_everything":true}')
OK=$(echo "$RESP" | python3 -c "import json,sys;print(json.load(sys.stdin).get('success'))" 2>/dev/null || echo False)
if [[ "$OK" == "True" ]]; then
	echo "✓ Cache purged — fresh HTML will serve from the next request."
else
	echo "⚠ Purge failed (deploy still succeeded): $RESP"
fi
