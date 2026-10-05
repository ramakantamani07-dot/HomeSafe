
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  // "Squircle" scale for hero surfaces that should feel tactile/premium
  // rather than just another rounded-rect card.
  xl: 28,
  /** The pull-up sheet's top corners (Option 15 §2). */
  sheet: 40,
  pill: 999,
} as const;

// Real diffused elevation instead of a flat 1px border — the signature depth
// cue for hero/elevated surfaces (Home's hero card, family avatars). Spread
// across both iOS (shadow*) and Android (elevation) props; shadowColor stays
// black on both themes since it's blended at low opacity, not a literal color.
export const ELEVATION = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
  },
  /** The faintest lift — a selected segment in a segmented control. */
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  /**
   * A control floating directly over the map (back chip, status pill, the
   * "Adjust pin" button). Needs a harder shadow than `sm` to stay legible
   * against arbitrary map imagery.
   */
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

/**
 * The hero-card shadow, which is the one elevation that differs by theme: a
 * black drop shadow is nearly invisible on a dark surface, so dark mode
 * deepens it rather than rendering an edge nobody can see.
 */
export function cardElevation(isDark: boolean) {
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.3 : 0.06,
    shadowRadius: 16,
    elevation: 4,
  };
}


/**
 * The glass material's numbers, per docs/features/option15-ui-spec.md §2.
 *
 * Two variants because the spec gives two: floating controls let the map read
 * through at 42–56% white, while sheets use a denser 80–86% "so text stays
 * readable over the map". That second one is a legibility requirement, which is
 * why it lives here as a named constant rather than as a value a screen can
 * nudge.
 *
 * Consumed only by GlassSurface — no screen should reach for these directly.
 */
export const GLASS = {
  control: {
    /** expo-blur intensity (0–100). Maps to UIVisualEffectView / RenderEffect. */
    intensity: 28,
    /** White wash over the blur — the spec's 42–56%, at the lighter end. */
    fill: 'rgba(255,255,255,0.46)',
    /** 1px white rim at 75%. */
    rim: 'rgba(255,255,255,0.75)',
    /** Android < 31 has no backdrop blur; the spec names this exact fallback. */
    solidFallback: 'rgba(249,249,251,0.92)',
    shadow: {
      shadowColor: '#111214',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 6,
    },
  },
  sheet: {
    intensity: 42,
    /** Denser, per the spec's 80–86% for sheets. */
    fill: 'rgba(255,255,255,0.84)',
    rim: 'rgba(255,255,255,0.75)',
    solidFallback: 'rgba(249,249,251,0.97)',
    shadow: {
      shadowColor: '#111214',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 10,
    },
  },
} as const;
