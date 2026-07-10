#!/usr/bin/env bash
#
# pre-push-audit.sh — in-house gate for the vectismail.com marketing site.
#
# Run before you push (or before `npm run deploy`) so PRs and deploys land
# clean and there are very few comebacks. Prints a PASS / WARN / FAIL summary;
# non-zero exit on any hard failure, so it can be wired as a git pre-push hook:
#
#   ln -sf ../../scripts/pre-push-audit.sh .git/hooks/pre-push
#
# Gates:
#   • gitleaks secret scan   (diff-scoped: uncommitted + unpushed; never node_modules)
#   • astro build            (types, imports, content collections, MDX)  [hard]
#   • astro check            (type/content diagnostics)                  [advisory]
#   • trailing-slash links   (site is trailingSlash:'always' — a missing
#                             slash becomes a GSC redirect)              [advisory]
#
# The site build is light (Vite/Astro static output) so it is safe to run
# anywhere. Usage: scripts/pre-push-audit.sh [--strict] [-h|--help]
#   --strict   treat advisory gates (astro check, trailing-slash) as hard fails
#
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STRICT=0
for a in "$@"; do
  case "$a" in
    --strict) STRICT=1 ;;
    -h|--help) sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown arg: $a (try --help)" >&2; exit 2 ;;
  esac
done

if [ -t 1 ]; then B=$'\e[1m'; R=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; D=$'\e[2m'; Z=$'\e[0m'
else B=""; R=""; G=""; Y=""; D=""; Z=""; fi
FAILS=0; WARNS=0; declare -a SUMMARY
hr(){ printf '%s\n' "────────────────────────────────────────────────────────"; }
skip(){ SUMMARY+=("  ${D}SKIP${Z}  $1${2:+  ${D}($2)${Z}}"); }
pass(){ SUMMARY+=("  ${G}PASS${Z}  $1"); }
warn(){ SUMMARY+=("  ${Y}WARN${Z}  $1"); WARNS=$((WARNS+1)); }
fail(){ SUMMARY+=("  ${R}FAIL${Z}  $1"); FAILS=$((FAILS+1)); }

# gate NAME [--advisory] -- CMD...
gate(){
  local name="$1"; shift
  local advisory=0
  if [ "${1:-}" = "--advisory" ]; then advisory=1; shift; fi
  [ "${1:-}" = "--" ] && shift
  printf '%s▶ %s%s\n' "$B" "$name" "$Z"
  local out rc
  out="$("$@" 2>&1)"; rc=$?
  if [ $rc -eq 0 ]; then pass "$name"
  else
    printf '%s\n' "$out" | sed 's/^/    /'
    if [ $advisory -eq 1 ] && [ $STRICT -eq 0 ]; then warn "$name (advisory)"; else fail "$name"; fi
  fi
}

echo "${B}vectismail.com pre-push audit${Z}  ${D}(root: $ROOT)${Z}"
hr

# 1) secret scan — diff-scoped (never walks node_modules)
secret_scan(){
  local cfg=(); [ -f .gitleaks.toml ] && cfg=(--config .gitleaks.toml)
  local rc=0
  gitleaks protect "${cfg[@]}" --redact --no-banner || rc=$?
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    gitleaks detect "${cfg[@]}" --redact --no-banner --log-opts="origin/main..HEAD" || rc=$?
  fi
  return $rc
}
if command -v gitleaks >/dev/null 2>&1; then gate "gitleaks secret scan" -- secret_scan
else skip "gitleaks secret scan" "gitleaks not installed"; fi

# ensure deps present before the build/check gates. Suppress only stdout
# progress noise — keep stderr visible and fail hard, so a real dependency
# problem surfaces here instead of as a confusing build error two gates later.
if [ ! -d node_modules ]; then
  echo "${D}installing deps (npm ci)...${Z}"
  npm ci >/dev/null || { echo "${R}npm ci failed — fix dependencies before re-running.${Z}" >&2; exit 1; }
fi

# 2) astro build — types, imports, content collections, MDX (hard gate)
gate "astro build" -- npm run build --silent

# 3) astro check — type/content diagnostics (advisory; needs @astrojs/check)
if npx --no-install astro check --help >/dev/null 2>&1; then
  gate "astro check" --advisory -- npx --no-install astro check
else
  skip "astro check" "@astrojs/check not installed"
fi

# 4) trailing-slash internal links — trailingSlash:'always' (advisory)
trailing_slash_check(){
  local bad
  bad="$(grep -rhoE 'href="/[^"#?]*"' src 2>/dev/null \
    | sed -E 's/^href="//; s/"$//' \
    | awk '
        $0=="/"                 {next}   # root
        $0 ~ /\/$/              {next}   # already ends with slash
        $0 ~ /\.[A-Za-z0-9]+$/  {next}   # asset with a file extension
        $0 ~ /^\/_astro\//      {next}   # build assets
        {print}' \
    | sort -u)"
  [ -z "$bad" ] || { echo "internal page links missing a trailing slash:"; echo "$bad"; echo "fix: add the '/' (site is trailingSlash:'always' → otherwise a redirect)"; return 1; }
}
gate "trailing-slash links" --advisory -- trailing_slash_check

hr; echo "${B}Summary${Z}"
for line in "${SUMMARY[@]}"; do printf '%s\n' "$line"; done
hr
if [ $FAILS -gt 0 ]; then
  echo "${R}${B}✖ $FAILS gate(s) failed — do NOT push.${Z} ${D}($WARNS warning(s))${Z}"; exit 1
fi
echo "${G}${B}✓ All run gates passed.${Z} ${D}($WARNS warning(s))${Z}"
exit 0
