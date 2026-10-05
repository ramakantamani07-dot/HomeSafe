import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { RADIUS } from '../config/theme';

/**
 * The Option 15 pull-up sheet, expressed as navigation options.
 *
 * Deliberately **not** a third-party sheet library and not a hand-rolled one.
 * `react-native-screens` — already a dependency, pinned by the Expo SDK, and
 * maintained by Software Mansion — implements this with the platform's own
 * sheet on both sides:
 *
 *   iOS      UISheetPresentationController with .detents  (RNSScreen.mm)
 *   Android  Material BottomSheetBehavior                 (rnscreens/bottomsheet/*.kt)
 *
 * That means the real OS sheet: correct platform feel, native gesture physics,
 * accessibility for free, and nothing of ours to maintain. See
 * docs/architecture/DEPENDENCIES.md for why `@gorhom/bottom-sheet` was rejected
 * in favour of this.
 */

/**
 * The three heights, as fractions of screen height.
 *
 * The design specifies the smallest as "~330pt" on its 390×844 base, which is
 * 0.39 of that screen. Expressed as a fraction rather than a point value so it
 * holds its proportion across device sizes — a fixed 330pt is a third of a
 * phone and most of a small one.
 */
export const SHEET_DETENTS = [0.39, 0.62, 1] as const;

/** Index into SHEET_DETENTS. Named so call sites read as intent, not arithmetic. */
export const SHEET_DETENT = {
  small: 0,
  half: 1,
  full: 2,
} as const;

/**
 * Navigation options for sheets that are **presented over** a screen —
 * "Feeling uneasy?" (`AI5`) and Settings (`AI9`), both of which the spec
 * describes as a sheet over the map.
 *
 * Deliberately NOT Home's sheet. Home's is part of the screen and never
 * dismisses, and `UISheetPresentationController` is a modal-presentation
 * primitive — it has no embedded mode, and `preventNativeDismiss` is not
 * reachable through expo-router anyway. Home uses `MapSheet` instead; this is
 * for the genuinely modal ones, where the OS sheet is exactly right.
 *
 * The load-bearing option is `sheetLargestUndimmedDetentIndex`: it keeps what
 * is underneath interactive at the lower detents rather than dimming and
 * blocking it at every height.
 */
export const PRESENTED_SHEET_OPTIONS: NativeStackNavigationOptions = {
  presentation: 'formSheet',
  sheetAllowedDetents: [...SHEET_DETENTS],
  // Opens at half (spec §3A).
  sheetInitialDetentIndex: SHEET_DETENT.half,
  // Small and half leave the map live; only full dims it.
  sheetLargestUndimmedDetentIndex: SHEET_DETENT.half,
  sheetGrabberVisible: true,
  sheetCornerRadius: RADIUS.sheet,
  // Dragging a scrolled-to-top list expands the sheet rather than bouncing the
  // list — the gesture people expect from Maps.
  sheetExpandsWhenScrolledToEdge: true,
  headerShown: false,
};
