#!/usr/bin/env bash
# Regression smoke test for the /upgrade Buy Pro flow.
#
# Run after every deploy that touches:
#   - functions/api/checkout/vectis-pro.ts
#   - src/pages/upgrade.astro
#   - src/pages/upgrade/success.astro
#   - src/pages/upgrade/cancelled.astro
#
# Usage:
#   ./scripts/smoke-test-checkout.sh              # against prod
#   ./scripts/smoke-test-checkout.sh --base https://vectismail.com
#   ./scripts/smoke-test-checkout.sh --json /tmp/report.json
#
# What this script DOES exercise (safe, no money moved):
#   1. Page surface: /upgrade, /upgrade/success, /upgrade/cancelled
#      all return 200 with the expected title + body markers
#   2. Proxy validation paths: empty body, malformed email, missing name,
#      missing email — all redirect to /upgrade?error=<code>
#   3. Proxy happy path: full POST → 303 Location: checkout.stripe.com/...
#      → Vx side creates a real cs_live_ session that expires unpaid
#      in 24h. Each run creates one such artefact in Vx logs.
#
# What this script does NOT yet exercise (needs coordination):
#   - Full payment via Playwright + Stripe test cards (4242..., 4000...3155
#     for 3DS, 4000...0002 for declined). Needs a Stripe TEST-mode price +
#     Vx-side env-flag-driven test mode. Tracked in the Vx coordination
#     thread (docs/notes/validonx/2026-05-19-checkout-create-session-
#     follow-up-reply-2.md §C).
#   - Webhook idempotency (replay `checkout.session.completed`).
#   - Tenant-already-exists collision.
#   - End-to-end welcome-email landing assertion (would require an MX
#     receiver + a JWT decode helper — both are scripted in Vx's own
#     test suite).
#
# Root-cause history this test guards against:
#   2026-05-19 — "Contact us for Pro" wired only to /contact/?reason=pro.
#   Replaced with real Stripe-via-Vx self-serve flow. Regression risk
#   is that any of the layers (page, proxy, Vx endpoint, Stripe) drift
#   or break silently between deploys; this test pins each layer.

set -u

BASE="https://vectismail.com"
JSON_OUT=""
VERBOSE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --base)    BASE="$2"; shift 2 ;;
    --json)    JSON_OUT="$2"; shift 2 ;;
    --verbose) VERBOSE=1; shift ;;
    -h|--help)
      sed -n '2,/^set -u/p' "$0" | sed 's/^# \?//; /^$/d'
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT

fail=0
pass=0
results_json='[]'

# Probe-marker so Vx can filter these out of their dashboard.
# Run-scoped timestamp keeps multiple runs distinguishable.
RUN_TS=$(date -u +%Y-%m-%dT%H%M%SZ)
PROBE_EMAIL="probe+smoke-${RUN_TS}@vectismail.com"
PROBE_NAME="Vectis Mail smoke ${RUN_TS}"

log() { [ "$VERBOSE" -eq 1 ] && echo "[smoke] $*" >&2 || true; }

record() {
  local label="$1" status="$2" detail="${3:-}"
  results_json=$(jq --arg l "$label" --arg s "$status" --arg d "$detail" '. + [{label: $l, status: $s, detail: $d}]' <<<"$results_json")
}

check_page() {
  local label="$1" url="$2" expected_status="$3" expected_marker="$4" min_size="${5:-2000}"
  local meta size body
  meta=$(curl -sS -o "$TMP" -w "%{http_code}|%{content_type}" "$url")
  local actual_status="${meta%%|*}"
  size=$(wc -c < "$TMP")
  body=$(cat "$TMP")

  if [ "$actual_status" = "$expected_status" ] \
     && [ "$size" -ge "$min_size" ] \
     && echo "$body" | grep -qF "$expected_marker"; then
    echo "✓ $label"
    pass=$((pass + 1))
    record "$label" "pass" "status=$actual_status size=$size"
  else
    echo "✗ $label — status=$actual_status size=$size marker=\"$expected_marker\""
    fail=$((fail + 1))
    record "$label" "fail" "status=$actual_status expected=$expected_status size=$size marker=\"$expected_marker\""
  fi
}

check_proxy_validation() {
  local label="$1" body="$2" expected_error="$3"
  local meta location
  meta=$(curl -sS -o /dev/null -w "%{http_code}|%header{location}" -X POST "$BASE/api/checkout/vectis-pro" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-binary "$body")
  local actual_status="${meta%%|*}"
  location="${meta#*|}"

  if [ "$actual_status" = "302" ] && [[ "$location" == "/upgrade/?error=${expected_error}" ]]; then
    echo "✓ $label"
    pass=$((pass + 1))
    record "$label" "pass" "redirected to $location"
  else
    echo "✗ $label — status=$actual_status location=\"$location\" expected=302 /upgrade/?error=${expected_error}"
    fail=$((fail + 1))
    record "$label" "fail" "status=$actual_status location=\"$location\""
  fi
}

check_proxy_happy_path() {
  local label="proxy happy path — POST → 303 → checkout.stripe.com"
  local meta location
  meta=$(curl -sS -o /dev/null -w "%{http_code}|%header{location}" -X POST "$BASE/api/checkout/vectis-pro" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "owner_email=${PROBE_EMAIL}" \
    --data-urlencode "owner_name=${PROBE_NAME}")
  local actual_status="${meta%%|*}"
  location="${meta#*|}"

  if [ "$actual_status" = "303" ] && [[ "$location" == https://checkout.stripe.com/c/pay/cs_* ]]; then
    local session_id
    session_id=$(echo "$location" | grep -oE 'cs_[a-z]+_[A-Za-z0-9]+' | head -1)
    echo "✓ $label — session $session_id"
    pass=$((pass + 1))
    record "$label" "pass" "session=$session_id"
  else
    echo "✗ $label — status=$actual_status location=\"$location\""
    fail=$((fail + 1))
    record "$label" "fail" "status=$actual_status location=\"$location\""
  fi
}

echo "Smoke test: Buy Pro flow @ ${BASE}"
echo "Run timestamp: ${RUN_TS}"
echo ""

# Page surface
check_page "page /upgrade/ loads"                          "${BASE}/upgrade/"            "200" "Buy Vectis Mail Pro"
check_page "page /upgrade/ has form posting to proxy"      "${BASE}/upgrade/"            "200" "action=\"/api/checkout/vectis-pro\""
check_page "page /upgrade/success/ loads"                  "${BASE}/upgrade/success/"    "200" "Welcome to Pro"
check_page "page /upgrade/cancelled/ loads"                "${BASE}/upgrade/cancelled/"  "200" "Checkout cancelled"
check_page "/pricing CTA now points to /upgrade"           "${BASE}/pricing/"            "200" "Buy Pro — \$29 USD/mo"

# Proxy validation paths
check_proxy_validation "proxy rejects empty body"          ""                                              "invalid-email"
check_proxy_validation "proxy rejects malformed email"     "owner_email=not-an-email&owner_name=test"     "invalid-email"
check_proxy_validation "proxy rejects missing email"       "owner_name=test"                              "invalid-email"
check_proxy_validation "proxy rejects missing name"        "owner_email=ok%40example.com"                 "invalid-name"

# Proxy happy path — creates a real cs_live_ session on Vx side
check_proxy_happy_path

echo ""
echo "Results: ${pass} pass, ${fail} fail"

if [ -n "$JSON_OUT" ]; then
  jq -n \
    --arg base "$BASE" \
    --arg ts "$RUN_TS" \
    --arg probe_email "$PROBE_EMAIL" \
    --argjson pass "$pass" \
    --argjson fail "$fail" \
    --argjson results "$results_json" \
    '{base: $base, run_ts: $ts, probe_email: $probe_email, pass: $pass, fail: $fail, results: $results}' \
    > "$JSON_OUT"
  echo "JSON report: $JSON_OUT"
fi

exit "$fail"
