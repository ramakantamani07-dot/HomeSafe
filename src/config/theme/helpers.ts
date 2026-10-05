import type { ThemeColors } from './palette';

// always yields the same color, so a family member's avatar/ring color
// doesn't shift across renders or screens.
export function identityColor(theme: ThemeColors, seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % theme.identityPalette.length;
  return theme.identityPalette[index];
}

// A colored-glow border+shadow for "glass card" surfaces — the signature
// dark-mode treatment (WayGuardian-style glowing cards over a night
// backdrop). No-op-ish in light mode (a colored glow reads as a mistake on a
// white background), so screens can apply this unconditionally and get the
// right look in both themes without their own isDark branching.
export function glowStyle(theme: ThemeColors, color: string) {
  if (!theme.isDark) {
    return { borderWidth: 1, borderColor: theme.border };
  }
  return {
    borderWidth: 1,
    borderColor: color,
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  };
}
