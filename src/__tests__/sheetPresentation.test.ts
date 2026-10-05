/**
 * Sheet presentation tests.
 *
 * The sheet itself is the platform's (UISheetPresentationController /
 * BottomSheetBehavior via react-native-screens), so there is no gesture logic
 * of ours to test. What *is* ours is the configuration — and two of those
 * values are load-bearing in ways that are invisible until someone changes
 * them on a device nobody re-tested:
 *
 *  - detents must be ascending fractions, or the OS silently misorders them
 *  - the undimmed index decides whether Home is still a map screen
 */

import {
  PRESENTED_SHEET_OPTIONS,
  SHEET_DETENT,
  SHEET_DETENTS,
} from '../navigation/sheetPresentation';

describe('sheet detents', () => {
  it('declares the three heights the design specifies', () => {
    expect(SHEET_DETENTS).toHaveLength(3);
  });

  it('are fractions of screen height, not point values', () => {
    // A point value here would be a third of a large phone and most of a small
    // one. The OS expects 0–1.
    for (const d of SHEET_DETENTS) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it('are strictly ascending', () => {
    const sorted = [...SHEET_DETENTS].sort((a, b) => a - b);
    expect([...SHEET_DETENTS]).toEqual(sorted);
    expect(new Set(SHEET_DETENTS).size).toBe(SHEET_DETENTS.length);
  });

  it('reaches full height at the top detent', () => {
    expect(SHEET_DETENTS[SHEET_DETENT.full]).toBe(1);
  });

  it('names every index it declares', () => {
    const named = Object.values(SHEET_DETENT).sort((a, b) => a - b);
    expect(named).toEqual(SHEET_DETENTS.map((_, i) => i));
  });
});

describe('PRESENTED_SHEET_OPTIONS', () => {
  it('opens at half, per the design', () => {
    expect(PRESENTED_SHEET_OPTIONS.sheetInitialDetentIndex).toBe(SHEET_DETENT.half);
  });

  it('leaves the map interactive at the small and half heights', () => {
    // The spec requires it, and it is the difference between Home being a map
    // screen and Home being a sheet with a picture behind it. Anything below
    // `half` here would dim and block the map at the resting height.
    expect(PRESENTED_SHEET_OPTIONS.sheetLargestUndimmedDetentIndex).toBe(SHEET_DETENT.half);
  });

  it('uses the platform sheet rather than a modal', () => {
    expect(PRESENTED_SHEET_OPTIONS.presentation).toBe('formSheet');
  });

  it('shows the grabber drawn in the design', () => {
    expect(PRESENTED_SHEET_OPTIONS.sheetGrabberVisible).toBe(true);
  });

  it('passes the detents through unchanged', () => {
    expect(PRESENTED_SHEET_OPTIONS.sheetAllowedDetents).toEqual([...SHEET_DETENTS]);
  });

  it('every initial and undimmed index is in range', () => {
    const last = SHEET_DETENTS.length - 1;
    expect(PRESENTED_SHEET_OPTIONS.sheetInitialDetentIndex).toBeLessThanOrEqual(last);
    expect(PRESENTED_SHEET_OPTIONS.sheetLargestUndimmedDetentIndex).toBeLessThanOrEqual(last);
  });
});
