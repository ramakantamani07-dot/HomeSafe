#!/usr/bin/env bash
# Fails if a raw colour literal appears outside the design system.
#
# The whole point of src/config/theme/ is that changing the app's colours is a
# one-file edit. Every hex that escapes into a screen quietly breaks that
# promise, and they accumulate silently — this is the guard that keeps the
# count at zero.
#
# Run: npm run check:tokens
set -euo pipefail
cd "$(dirname "$0")/.."

violations=$(grep -rnoE "#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b" src app 2>/dev/null \
  | grep -v "^src/config/theme/" \
  | grep -v "__tests__" \
  || true)

if [ -n "$violations" ]; then
  echo "✗ Raw colour literals found outside src/config/theme/:"
  echo "$violations" | sed 's/^/    /'
  echo ""
  echo "  Add a token to src/config/theme/palette.ts and use that instead."
  echo "  For deliberately theme-independent UI (SOS, fake call), use FIXED_PALETTES."
  exit 1
fi

echo "✓ No raw colour literals outside the design system"
