#!/usr/bin/env bash
# PageSpeed Insights baseline + monitoring sweep for vectismail.com.
#
# Hits PSI (Lighthouse + CrUX where field data exists) for every page in
# the URLS array, mobile + desktop, parses the headline scores and
# opportunities, writes a single markdown report under
# docs/audits/pagespeed/YYYY-MM-DD-<label>.md.
#
# Usage:
#   ./scripts/pagespeed-audit.sh                  # baseline (default label)
#   ./scripts/pagespeed-audit.sh --label after-img-fix
#   ./scripts/pagespeed-audit.sh --urls /tmp/urls.txt
#   ./scripts/pagespeed-audit.sh --strategy mobile  # skip desktop pass
#
# Requires:
#   - jq
#   - curl
#   - PSI API key. Two sources, in order of preference:
#       1. PAGESPEED_API_KEY env var
#       2. /opt/vectis/.claude/.secrets.md line that contains
#          "Google Page Speed Insights API = <KEY>"
#
# No CrUX standalone API call yet — PSI's response already embeds CrUX
# field data when available, so we surface that alongside lab metrics.

set -u

# ---- defaults ---------------------------------------------------------

LABEL=""
STRATEGY="both"        # mobile | desktop | both
URLS_FILE=""
OUT_DIR="docs/audits/pagespeed"

URLS=(
  "https://vectismail.com/"
  "https://vectismail.com/features"
  "https://vectismail.com/pricing"
  "https://vectismail.com/about"
  "https://vectismail.com/contact"
  "https://vectismail.com/alternatives"
  "https://vectismail.com/alternatives/mailcow"
  "https://vectismail.com/alternatives/iredmail"
  "https://vectismail.com/alternatives/mail-in-a-box"
  "https://vectismail.com/alternatives/sendgrid"
  "https://vectismail.com/alternatives/postmark"
  "https://vectismail.com/getting-started"
)

# ---- arg parse --------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --label)    LABEL="$2";    shift 2 ;;
    --strategy) STRATEGY="$2"; shift 2 ;;
    --urls)     URLS_FILE="$2"; shift 2 ;;
    --out-dir)  OUT_DIR="$2";  shift 2 ;;
    -h|--help)
      sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -n "$URLS_FILE" ]]; then
  mapfile -t URLS < "$URLS_FILE"
fi

# ---- resolve API key --------------------------------------------------

if [[ -z "${PAGESPEED_API_KEY:-}" ]]; then
  if [[ -r /opt/vectis/.claude/.secrets.md ]]; then
    PAGESPEED_API_KEY=$(grep -E '^Google Page Speed Insights API[[:space:]]*=' \
      /opt/vectis/.claude/.secrets.md \
      | sed -E 's/^[^=]+=[[:space:]]*//' | tr -d '[:space:]')
  fi
fi

if [[ -z "${PAGESPEED_API_KEY:-}" ]]; then
  echo "error: no PSI key found (env PAGESPEED_API_KEY nor .secrets.md)" >&2
  exit 1
fi

# ---- output setup -----------------------------------------------------

DATE=$(date -u +%Y-%m-%d)
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mkdir -p "$OUT_DIR"

if [[ -z "$LABEL" ]]; then
  FILE="$OUT_DIR/$DATE-baseline.md"
  RUN_LABEL="baseline"
else
  FILE="$OUT_DIR/$DATE-$LABEL.md"
  RUN_LABEL="$LABEL"
fi

# Don't clobber by accident — append a suffix if the file already exists.
if [[ -e "$FILE" ]]; then
  FILE="${FILE%.md}-$(date -u +%H%M%S).md"
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

case "$STRATEGY" in
  mobile)  STRATEGIES=(mobile) ;;
  desktop) STRATEGIES=(desktop) ;;
  both)    STRATEGIES=(mobile desktop) ;;
  *) echo "bad --strategy: $STRATEGY" >&2; exit 2 ;;
esac

# ---- run --------------------------------------------------------------

echo "PSI sweep: ${#URLS[@]} URLs × ${#STRATEGIES[@]} strategies → $FILE" >&2

probe() {
  local url="$1" strat="$2" out="$3"
  curl -fsS --max-time 90 \
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${url}&strategy=${strat}&category=performance&category=accessibility&category=best-practices&category=seo&key=${PAGESPEED_API_KEY}" \
    -o "$out" 2>>"$TMP/errors.log" \
    && return 0 || return 1
}

# Write report header.
{
  echo "# PageSpeed audit — $RUN_LABEL"
  echo
  echo "**Generated:** $TS"
  echo "**Tool:** Google PageSpeed Insights API v5 (Lighthouse + CrUX where available)"
  echo "**Pages:** ${#URLS[@]} · **Strategies:** ${STRATEGIES[*]}"
  echo
  echo "Scores are 0-100. Core Web Vitals: LCP < 2.5s good / < 4s needs improvement; CLS < 0.1 good / < 0.25 ni; INP < 200ms good / < 500ms ni; TBT proxies INP in lab."
  echo
  echo "---"
  echo
} > "$FILE"

# ---- per-page sweep ---------------------------------------------------

for url in "${URLS[@]}"; do
  short=$(echo "$url" | sed -E 's#^https?://[^/]+##; s#/$#/(home)#; s#^/##')
  echo "### \`$short\`" >> "$FILE"
  echo >> "$FILE"

  for strat in "${STRATEGIES[@]}"; do
    out="$TMP/$(echo "$url$strat" | tr '/:?&=' '____').json"
    echo "  probing: $url ($strat)" >&2

    if ! probe "$url" "$strat" "$out"; then
      echo "**$strat:** _probe failed — see error log_" >> "$FILE"
      echo >> "$FILE"
      continue
    fi

    # Pull scores + CWV + top 5 opportunities by potential savings.
    summary=$(jq -r '
      def pct(s): if s == null then "—" else (s * 100 | round | tostring) end;
      def disp(a): if a == null then "—" else a end;

      .lighthouseResult as $lh |
      ($lh.categories.performance.score      | pct(.)) as $perf  |
      ($lh.categories.accessibility.score    | pct(.)) as $a11y  |
      ($lh.categories["best-practices"].score | pct(.)) as $bp   |
      ($lh.categories.seo.score              | pct(.)) as $seo   |

      ($lh.audits["largest-contentful-paint"].displayValue // "—") as $lcp |
      ($lh.audits["cumulative-layout-shift"].displayValue // "—")  as $cls |
      ($lh.audits["first-contentful-paint"].displayValue // "—")   as $fcp |
      ($lh.audits["total-blocking-time"].displayValue // "—")      as $tbt |
      ($lh.audits["speed-index"].displayValue // "—")              as $si  |
      ($lh.audits["interaction-to-next-paint"].displayValue // "—") as $inp |

      # Field data (CrUX) if available.
      (.loadingExperience.metrics // {}) as $field |
      ($field.LARGEST_CONTENTFUL_PAINT_MS.percentile // null) as $field_lcp |
      ($field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile // null) as $field_cls |
      ($field.INTERACTION_TO_NEXT_PAINT.percentile // null) as $field_inp |

      "| metric | value |\n" +
      "|---|---|\n" +
      "| Performance | \($perf) |\n" +
      "| Accessibility | \($a11y) |\n" +
      "| Best Practices | \($bp) |\n" +
      "| SEO | \($seo) |\n" +
      "| LCP (lab) | \($lcp) |\n" +
      "| CLS (lab) | \($cls) |\n" +
      "| FCP (lab) | \($fcp) |\n" +
      "| Speed Index (lab) | \($si) |\n" +
      "| TBT (lab) | \($tbt) |\n" +
      "| INP (lab) | \($inp) |\n" +
      (if $field_lcp != null then "| LCP (field, p75) | \($field_lcp)ms |\n" else "" end) +
      (if $field_cls != null then "| CLS (field, p75) | \($field_cls / 100) |\n" else "" end) +
      (if $field_inp != null then "| INP (field, p75) | \($field_inp)ms |\n" else "" end) +
      "\n**Top opportunities (lab savings):**\n\n" +
      ([$lh.audits
        | to_entries[]
        | select(.value.details.type == "opportunity")
        | select((.value.details.overallSavingsMs // 0) > 100)
        | {id: .key, title: .value.title, savings_ms: .value.details.overallSavingsMs}
       ] | sort_by(-.savings_ms) | .[0:5]
       | if length == 0 then "_(none above 100ms threshold)_"
         else map("- **\(.savings_ms | round)ms** · \(.title) (`\(.id)`)") | join("\n") end)
    ' < "$out" 2>/dev/null)

    if [[ -z "$summary" ]]; then
      echo "**$strat:** _parse failed — raw response in $TMP_" >> "$FILE"
      echo >> "$FILE"
      continue
    fi

    echo "**$strat**" >> "$FILE"
    echo >> "$FILE"
    echo "$summary" >> "$FILE"
    echo >> "$FILE"
  done

  echo "---" >> "$FILE"
  echo >> "$FILE"
done

# ---- aggregate summary at top -----------------------------------------

# Build a one-line-per-page leaderboard and prepend after the header.
LEADERBOARD="$TMP/leaderboard.md"
{
  echo "## Score leaderboard"
  echo
  echo "| Page | Mobile · Perf | Mobile · LCP | Desktop · Perf | Desktop · LCP |"
  echo "|---|---|---|---|---|"
} > "$LEADERBOARD"

for url in "${URLS[@]}"; do
  short=$(echo "$url" | sed -E 's#^https?://[^/]+##; s#/$#/(home)#; s#^/##')
  row="| \`$short\` |"
  for strat in mobile desktop; do
    out="$TMP/$(echo "$url$strat" | tr '/:?&=' '____').json"
    if [[ -r "$out" ]]; then
      perf=$(jq -r '.lighthouseResult.categories.performance.score | (. * 100 | round)' < "$out" 2>/dev/null || echo "—")
      lcp=$(jq -r '.lighthouseResult.audits["largest-contentful-paint"].displayValue // "—"' < "$out" 2>/dev/null || echo "—")
      if [[ " ${STRATEGIES[*]} " == *" $strat "* ]]; then
        row+=" $perf | $lcp |"
      else
        row+=" — | — |"
      fi
    else
      row+=" — | — |"
    fi
  done
  echo "$row" >> "$LEADERBOARD"
done
echo >> "$LEADERBOARD"
echo "---" >> "$LEADERBOARD"
echo >> "$LEADERBOARD"

# Splice leaderboard in after the report header (after the second --- line).
HEADER="$TMP/header.md"
BODY="$TMP/body.md"
awk 'BEGIN{c=0} /^---$/ && c<1 {c++; print; next} c==1{print > "/dev/stderr"; next} {print}' "$FILE" > "$HEADER" 2>"$BODY"
{
  cat "$HEADER"
  echo
  cat "$LEADERBOARD"
  cat "$BODY"
} > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"

# ---- error summary ----------------------------------------------------

if [[ -s "$TMP/errors.log" ]]; then
  {
    echo
    echo "## Probe errors"
    echo
    echo '```'
    cat "$TMP/errors.log"
    echo '```'
  } >> "$FILE"
fi

echo "wrote: $FILE" >&2
