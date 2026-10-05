/**
 * The design system's single entry point.
 *
 * Every screen imports from `src/config/theme` — never from the files behind
 * it — so the split below can be reorganised without touching the 45 files
 * that consume it.
 *
 *   palette.ts      ← THE file to edit to change the app's colours
 *   typography.ts   font families and type scale
 *   layout.ts       spacing, radii, elevation
 *   helpers.ts      derived styling (per-person identity colour, glow)
 *
 * Rule: no raw colour literal belongs anywhere else in the codebase. If a
 * screen needs a colour, it comes from here — including the deliberately
 * fixed, theme-independent palettes (SOS, fake call), which live in
 * palette.ts precisely so "change the colours" stays a one-file job.
 */

export type { ThemeColors } from './palette';
export { lightTheme, darkTheme, FIXED_PALETTES, FEATURE_COLORS } from './palette';
export { identityColor, glowStyle } from './helpers';
export { FONTS, TYPOGRAPHY } from './typography';
export { SPACING, RADIUS, ELEVATION, GLASS, cardElevation } from './layout';
