#!/usr/bin/env bash
# Blocks a commit that would put a sensitive value into git.
#
# Runs as the pre-commit hook (.githooks/pre-commit, switched on by
# `npm install` through the "prepare" script) and as `npm run check:secrets`.
# It checks only what is staged, so it is fast and sees exactly what the
# commit would contain.
#
# Three checks:
#   1. No secret *files*: any .env except the .env.example templates, keys,
#      certificates, provisioning profiles, Firebase/Google service configs.
#   2. No secret-shaped *text* in added lines: Google/Firebase API keys,
#      private keys, AWS/GitHub/Slack/Stripe tokens, service-account JSON.
#   3. None of *your* values: every value in your local .env files is looked
#      for in the added lines. Matches are named by variable, never printed.
#
# Rule on record: never commit .env files or sensitive values (10 Oct 2026).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

fail=0
report() { echo "✗ $1"; printf '%s\n' "$2" | sed 's/^/    /'; fail=1; }

# Added, copied, modified or renamed — a deletion can't leak anything.
staged=$(git diff --cached --name-only --diff-filter=ACMR)
[ -z "$staged" ] && { echo "✓ No sensitive values staged"; exit 0; }

# 1 · Files that must never be committed.
bad_files=$(printf '%s\n' "$staged" | grep -E \
  '(^|/)\.env($|\.)|\.env\.bak$|\.(pem|p8|p12|pfx|key|keystore|jks|mobileprovision)$|(^|/)GoogleService-Info\.plist$|(^|/)google-services\.json$|(^|/)serviceAccount[^/]*\.json$|-firebase-adminsdk-[^/]*\.json$' \
  | grep -vE '(^|/)\.env\.example$' || true)
[ -n "$bad_files" ] && report "Secret files staged — unstage with: git restore --staged <file>" "$bad_files"

# Added lines only, excluding this script (it names the patterns it hunts).
added=$(git diff --cached --text -U0 --diff-filter=ACMR -- . ':(exclude)scripts/check-secrets.sh' \
  | grep -E '^\+' | grep -vE '^\+\+\+ ' || true)

# 2 · Text shaped like a credential.
patterns='AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[0-9A-Za-z]{30,}|xox[abposr]-[0-9A-Za-z-]{10,}|sk_live_[0-9A-Za-z]{16,}|"private_key"[[:space:]]*:|"client_secret"[[:space:]]*:'
shaped=$(printf '%s\n' "$added" | grep -cE "$patterns" || true)
if [ "${shaped:-0}" -gt 0 ]; then
  where=$(git diff --cached --text -U0 --diff-filter=ACMR -- . ':(exclude)scripts/check-secrets.sh' \
    | awk '/^\+\+\+ b\//{f=substr($0,7)} /^\+/{print f}' | sort -u | while read -r f; do
      git diff --cached --text -U0 -- "$f" | grep -E '^\+' | grep -qE "$patterns" && echo "$f"
    done)
  report "Credential-shaped text in $shaped added line(s)" "$where"
fi

# 3 · Values from your own .env files, wherever they turn up.
leaked=""
for envfile in .env .env.* functions/.env functions/.env.*; do
  [ -f "$envfile" ] || continue
  case "$envfile" in *.example) continue ;; esac
  while IFS='=' read -r key value; do
    value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
    # Short or obviously non-secret settings would match ordinary code.
    [ "${#value}" -ge 8 ] || continue
    case "$value" in auto|mock|real|true|false|https://router.project-osrm.org) continue ;; esac
    if printf '%s\n' "$added" | grep -qF -- "$value"; then
      leaked="${leaked}${key} (from ${envfile})"$'\n'
    fi
  done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$envfile")
done
[ -n "$leaked" ] && report "Values from your local .env files are in the staged changes" "${leaked%$'\n'}"

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "  Commit blocked. Move the value into .env (git ignores it) and read it"
  echo "  from config, then stage again."
  exit 1
fi
echo "✓ No sensitive values staged"
