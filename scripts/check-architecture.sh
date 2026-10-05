#!/usr/bin/env bash
# Enforces the layering rules in docs/architecture/ARCHITECTURE.md §2.
#
# These rules are what keep the Mock/real adapter swap working — the thing that
# lets the test suite run in seconds with no emulator, and features ship before
# their credentials exist. They erode one convenient import at a time, so this
# checks them rather than trusting them.
#
# Run: npm run check:arch
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
report() { echo "✗ $1"; echo "$2" | sed 's/^/    /'; fail=1; }

# 1. Domain and application layers must stay free of React.
hits=$(grep -rln "from 'react'" src/services src/models 2>/dev/null || true)
[ -n "$hits" ] && report "React imported in services/ or models/ (must stay framework-free)" "$hits"

# 2. Screens must not reach past hooks into services or adapters.
hits=$(grep -rn "src/services\|src/implementations" app/ 2>/dev/null || true)
[ -n "$hits" ] && report "A screen imports a service or adapter directly (go through a hook)" "$hits"

# 3. Only the composition root may name concrete adapters.
hits=$(grep -rn "from '.*context/AppProviders'" src/hooks src/components src/services src/context app 2>/dev/null \
  | grep -v "app/_layout.tsx" || true)
[ -n "$hits" ] && report "Composition-root singletons imported outside app/_layout.tsx" "$hits"

# 4. Ports describe capabilities; they must not depend on an implementation.
hits=$(grep -rn "^import.*implementations" src/providers 2>/dev/null || true)
[ -n "$hits" ] && report "A port imports a concrete adapter" "$hits"

# 5. Models sit at the centre and depend on nothing but each other.
hits=$(grep -rhn "^import" src/models/*.ts 2>/dev/null \
  | grep -v "from './" | grep -v "from '\.\./models" || true)
[ -n "$hits" ] && report "models/ imports outside models/" "$hits"

# 6. Firebase belongs behind an adapter.
hits=$(grep -rln "from 'firebase/" src/ 2>/dev/null \
  | grep -v "^src/implementations/" | grep -v "^src/config/" \
  | grep -v "AuthContext.tsx" | grep -v "FirebaseRecaptchaVerifier.tsx" || true)
[ -n "$hits" ] && report "Firebase SDK imported outside implementations/ or config/" "$hits"

# 7. Context values must be memoised, or every consumer gets unstable
#    identities and any effect depending on one is a render loop away.
unmemoised=""
for f in src/context/*.tsx; do
  case "$(basename "$f")" in
    AppProviders.tsx|NetworkContext.tsx) continue ;;  # no value object / already stable
  esac
  grep -q "useMemo" "$f" || unmemoised="${unmemoised}${f}\n"
done
[ -n "$unmemoised" ] && report "Context value not memoised" "$(printf "$unmemoised")"

if [ "$fail" -eq 0 ]; then
  echo "✓ Architecture rules hold"
fi
exit $fail
