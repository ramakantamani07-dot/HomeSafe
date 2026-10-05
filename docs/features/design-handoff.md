> **Status: superseded (2 Oct 2026).** The Option 15 spec
> (`docs/features/option15-ui-spec.md`) replaces this palette and navigation.
> Kept for history and for the illustration-asset guidance in §Files, which
> still applies. See `docs/plan/IMPLEMENTATION_PHASES.md` decision **G1**.

# wayLoc – illustration assets

## Files
| File | Use |
|---|---|
| `welcome_illustration.svg` (+ @1x/@2x/@3x PNG) | Welcome / sign-in screen, top ~52% of the screen |
| `home_soft_header.svg` (+ PNGs) | Home screen, behind the greeting only |

Prefer the SVGs (convert to Android VectorDrawable / use flutter_svg / react-native-svg). PNGs are fallbacks. Base size is 390pt wide.

## Welcome screen
- Illustration full-width at the top, height 440 on a 390×844 screen (scale by width, crop from the top — keep the bottom edge where the hills are).
- Screen background below: `#F4F3EE`.
- Below: small logo row "wayLoc" (teal `#0B6B5A`), heading "Get home — and know they did too." (34sp, bold), body "Share your journey with the people you trust. They only see you when you choose." (16sp, `#3F434B`), then buttons pinned to the bottom: "Create account" (filled `#16181D`, white text, 56 high, fully rounded) and "Sign in" (outlined `#C9C5BA`, 52 high).

## Home screen soft header
- Place the header image absolutely at the top, full width, height 190, bottom corners rounded 32. Page background `#F4F3EE`.
- Greeting, status pill and avatar sit on top of it; the status pill background is white.
- The "Going somewhere?" card must start inside the header and overlap its bottom edge, so no body text or buttons sit on the pattern.
- Must scroll with the content (not fixed).
- **Use it on the Home tab only** (screens 01 and 07). Not on Where to, Review, On the way, Safety check, SOS, Settings or any form/list screen; those use the plain `#F4F3EE` background.

## Palette
Ink `#16181D` · Muted text `#5B5F68` · Background `#F4F3EE` · Card `#FFFFFF` · Border `#E4E2DA` · Safe/teal `#0B6B5A` · SOS red `#B91C1C` (SOS only) · Amber attention `#B45309`.
Fonts: Bricolage Grotesque (headings), Instrument Sans (body) – both Google Fonts.

## Dark mode
Don't reuse these as-is in dark mode. Swap the fills for darker equivalents, or drop the header pattern entirely and use a plain surface.
