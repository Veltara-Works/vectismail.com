#!/usr/bin/env bash
# Regression smoke test for the /account/billing Pages Function proxy.
#
# Run after every deploy that touches functions/account/billing.ts:
#   ./scripts/smoke-test-billing.sh
#
# Hits every error-code branch we can exercise without a real Stripe
# customer + validates the response status, page title, body size, and
# absence of brand leakage. The 200 (real Stripe portal) and 409
# (existing tenant with no Stripe customer) paths can't be safely
# exercised from a public script without leaking a real tenant UUID —
# those are covered by ValidonX's welcome-email re-fire test.
#
# Root-cause history this test guards against:
#   2026-05-16 — Pages Function emitted status 502 from errorPage(),
#   Cloudflare intercepted with its 15-byte text/plain default page,
#   our branded HTML never reached the customer. Fixed by clamping
#   errorPage() status to non-5xx. This script proves the fix sticks.

set -u
BASE="https://vectismail.com/account/billing"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

fail=0
pass=0

check() {
  local label="$1"
  local url="$2"
  local expected_status="$3"
  local expected_title="$4"
  local min_size="${5:-1000}"     # branded pages are ~3-4KB; CF default 5xx is 15 bytes

  local meta
  meta=$(curl -sS -o "$TMP" -w "%{http_code}|%{content_type}" "$url")
  local actual_status="${meta%%|*}"
  local content_type="${meta#*|}"
  local size; size=$(wc -c < "$TMP")
  local title; title=$(grep -oE '<title>[^<]+</title>' "$TMP" | head -1 | sed 's/<[^>]*>//g')

  # Brand-leak check — these substrings must NOT appear in any error page.
  local leak=""
  for needle in "validonx" "app.validonx" "billing.stripe.com"; do
    if grep -qiF "$needle" "$TMP"; then leak="$leak $needle"; fi
  done

  if [ "$actual_status" = "$expected_status" ] \
     && [ "$title" = "$expected_title" ] \
     && [ "$size" -ge "$min_size" ] \
     && [ -z "$leak" ] \
     && [[ "$content_type" == text/html* ]]; then
    echo "PASS  $label  (status=$actual_status size=${size}B)"
    pass=$((pass+1))
  else
    echo "FAIL  $label"
    echo "      url:              $url"
    echo "      expected status:  $expected_status"
    echo "      actual status:    $actual_status"
    echo "      expected title:   $expected_title"
    echo "      actual title:     $title"
    echo "      size:             ${size}B (min ${min_size}B)"
    echo "      content-type:     $content_type"
    [ -n "$leak" ] && echo "      BRAND LEAK:       $leak"
    fail=$((fail+1))
  fi
}

# --- Input validation paths (caught at our edge, no Vx round-trip) --------
check "missing tenant param" \
  "$BASE" \
  "400" "Missing tenant identifier — Vectis Mail"

check "non-UUID tenant" \
  "$BASE?tenant=not-a-uuid" \
  "400" "Invalid tenant identifier — Vectis Mail"

check "ULID rejected at edge (post-2026-05-16 UUID-only contract)" \
  "$BASE?tenant=01HX0V4Y0Z9N5R8M2K8B3T4PQR" \
  "400" "Invalid tenant identifier — Vectis Mail"

# --- Vx round-trip paths --------------------------------------------------
check "well-formed UUID, not registered with Vx (404 path)" \
  "$BASE?tenant=00000000-0000-0000-0000-000000000099" \
  "404" "Subscription not found — Vectis Mail"

# Note: the 409 path needs a real tenant UUID that exists on Vx without a
# Stripe customer. Covered by Vx's welcome-email re-fire test, not here.
# The 422 path is now unreachable from the public edge (ULID-only inputs
# that would have triggered it are now rejected at our regex). The 401/403
# paths are admin-only failure modes — covered by Vx's audit log when they
# revoke + we redeploy without rotating.

echo
echo "Summary: $pass passed, $fail failed"
exit "$fail"
