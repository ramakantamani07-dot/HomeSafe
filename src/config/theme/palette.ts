interface SeverityColors {
  fg: string;
  bg: string;
}

export interface ThemeColors {
  // Lets screens opt into dark-only treatments (glow shadows, colored
  // borders on "glass" cards) that would just look muddy in light mode,
  // without each screen re-deriving it from raw color values.
  isDark: boolean;
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnColor: string;
  accent: string;
  accentMuted: string;
  // Solid "ink" fill for primary CTAs (Start journey, Save place, Done) —
  // near-black in light mode per the design handoff, which `accent` (teal,
  // reserved for links/safe/active states) deliberately isn't. Dark mode
  // can't reuse a near-white ink as a button fill, so it maps to the accent
  // there; `strongText` is the matching foreground for both.
  strong: string;
  strongText: string;
  // A second brand tone reserved for warmth/reassurance moments (the glow
  // behind "you're safe", a hero card's warm edge) — never used for status,
  // so it can't dilute the severity system below. Distinct from `accent`
  // (trust/action) the way Life360 pairs its purple brand color with a warm
  // coral highlight, without touching Life360's per-status color-coding.
  warm: string;
  warmMuted: string;
  safe: SeverityColors;
  warning: SeverityColors;
  critical: SeverityColors;
  connectivity: {
    live: string;
    weak: string;
    lost: string;
  };
  // Per-person decorative identity colors (avatar backgrounds, avatar rings)
  // — assigned once per person via identityColor() below and kept stable.
  // Deliberately a *separate* layer from the severity system: identity color
  // says "this is Sarah," never "something is wrong." Six people can have six
  // hues without diluting the one hue (critical) that's supposed to alarm.
  identityPalette: string[];
  /**
   * "In motion" — a traveller actively on a journey, in a family list.
   * Deliberately its own hue rather than `accent`: accent means "safe/trusted",
   * and a person mid-journey is neither alarming nor settled.
   */
  travelling: SeverityColors;
  /** Warm attention wash behind the safety-check screen (08). */
  attention: SeverityColors;
}

// Palette per docs/features/option15-ui-spec.md §2.
//
// Supersedes the earlier warm-neutral/teal handoff (decision G1, 2 Oct 2026):
// Option 15 is map-first, so the background is map land rather than paper, and
// the accent is the iOS system blue used for the route line and the user's dot.
//
// Two rules the spec is emphatic about, and that these names encode:
//   - red belongs to SOS and destructive actions, nothing else
//   - never claim certainty we don't have — there is no "you are safe" green
//     for status; `safe` means an affirmative *action* (Check in, I'm OK)
//
// Calm, non-alert states still get no colour of their own. Six unrelated hues
// for six equally-calm states dilutes the one colour that must alarm.
export const lightTheme: ThemeColors = {
  isDark: false,
  background: '#F2EFE9',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border: '#E3DFD7',
  borderStrong: '#C9C4B9',
  textPrimary: '#111214',
  textSecondary: '#5F6368',
  textTertiary: '#8E9198',
  textOnColor: '#FFFFFF',
  accent: '#0A84FF',
  accentMuted: 'rgba(10,132,255,0.12)',
  // The main CTA is the tint, not ink — Option 15's primary buttons (Go, Start
  // walk, Done) are filled blue, unlike the previous ink-filled design.
  strong: '#0A84FF',
  strongText: '#FFFFFF',
  warm: '#FF9F0A',
  warmMuted: 'rgba(255,159,10,0.14)',
  safe: { fg: '#136B2E', bg: 'rgba(52,199,89,0.16)' },
  warning: { fg: '#A65A00', bg: 'rgba(255,159,10,0.16)' },
  critical: { fg: '#D70015', bg: 'rgba(255,59,48,0.12)' },
  connectivity: {
    live: '#34C759',
    weak: '#FF9F0A',
    // Not red — "connection lost" needs attention but is not an emergency.
    lost: '#5F6368',
  },
  identityPalette: ['#34C759', '#FF9500', '#30B0C7', '#5856D6', '#7B61FF', '#0A84FF', '#FF2D55', '#0B8A74'],
  travelling: { fg: '#0A84FF', bg: 'rgba(10,132,255,0.12)' },
  attention: { fg: '#A65A00', bg: 'rgba(255,159,10,0.14)' },
};

// Deep navy "night sky" dark theme — deliberately more saturated/glowing than
// a typical muted dark UI, matching the WayGuardian-style reference the user
// provided (glowing cyan/blue glass cards over a night cityscape). No literal
// photo background (impractical — see the layered-shapes approach in Home),
// but the color language (deep navy, glowing accent borders, teal safe glow)
// carries the same mood.
export const darkTheme: ThemeColors = {
  isDark: true,
  background: '#121214',
  surface: '#1C1C1E',
  surfaceRaised: '#2C2C2E',
  border: '#38383A',
  borderStrong: '#48484A',
  textPrimary: '#F5F5F7',
  textSecondary: '#A1A1A6',
  textTertiary: '#6E6E73',
  textOnColor: '#FFFFFF',
  accent: '#0A84FF',
  accentMuted: 'rgba(10,132,255,0.22)',
  strong: '#0A84FF',
  strongText: '#FFFFFF',
  warm: '#FF9F0A',
  warmMuted: 'rgba(255,159,10,0.22)',
  safe: { fg: '#30D158', bg: 'rgba(48,209,88,0.20)' },
  warning: { fg: '#FFD60A', bg: 'rgba(255,214,10,0.18)' },
  critical: { fg: '#FF453A', bg: 'rgba(255,69,58,0.20)' },
  connectivity: {
    live: '#30D158',
    weak: '#FFD60A',
    lost: '#A1A1A6',
  },
  identityPalette: ['#30D158', '#FF9F0A', '#40C8E0', '#5E5CE6', '#8E7CFF', '#0A84FF', '#FF375F', '#0FA88C'],
  travelling: { fg: '#64A9FF', bg: 'rgba(10,132,255,0.22)' },
  attention: { fg: '#FFD60A', bg: 'rgba(255,214,10,0.18)' },
};

// Stable per-person color from the theme's identity palette — same input

/**
 * Palettes that deliberately do **not** follow the light/dark theme.
 *
 * Two screens must look like themselves in every theme:
 *
 *  - **sos** — the emergency screen has to be unmistakable at a glance and
 *    must never be confused with an ordinary confirmation dialog. Theming it
 *    would let it quietly resemble the rest of the app.
 *  - **fakeCall** — it imitates the OS incoming-call UI, which has its own
 *    fixed appearance. Matching our theme instead would break the illusion
 *    the whole feature depends on.
 *
 * They live here rather than inline in those screens so that "change the
 * app's colours" remains a single-file edit, even for the parts that opt out
 * of theming.
 */
/**
 * Hues Option 15 assigns to one specific feature each.
 *
 * Kept out of `ThemeColors` deliberately: these are identity colours for
 * particular features, not part of the severity system. Putting them in the
 * theme would invite their reuse as general-purpose status colours, which is
 * precisely how a palette stops meaning anything.
 */
export const FEATURE_COLORS = {
  /** The Fake call icon, in both themes. */
  fakeCall: '#5856D6',
  /** The "Feeling uneasy?" sparkle. */
  uneasy: '#7B61FF',
  /** A basic-phone member, and their network-location circle. */
  basicPhone: '#30B0C7',
  /**
   * The fill of a network-location circle. The same hue as `basicPhone`, light
   * enough that streets read through it — the circle says "somewhere in here",
   * and hiding the map under it would undo that.
   */
  basicPhoneArea: 'rgba(48,176,199,0.18)',
  /** Sign-in screens and the logo. */
  brandTeal: '#0B8A74',
} as const;

export const FIXED_PALETTES = {
  sos: {
    background: '#1A0F0F',
    surface: '#2A1717',
    border: '#4A2626',
    red: '#DC2626',
    redPressed: '#B91C1C',
    redBright: '#FB6B6B',
    redDim: '#3A1E1E',
    text: '#FFFFFF',
    textMuted: '#C8B5B5',
  },
  /** Mirrors the native incoming-call screen. */
  fakeCall: {
    background: '#1C1C1E',
    surface: '#2C2C2E',
    control: '#3A3A3C',
    accept: '#34C759',
    decline: '#FF3B30',
    text: '#FFFFFF',
  },
} as const;
