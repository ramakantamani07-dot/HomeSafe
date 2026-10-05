import React from 'react';
import { Stack } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { PRESENTED_SHEET_OPTIONS } from '../../src/navigation/sheetPresentation';
import { SafetyCheckOverlay } from '../../src/components/journey/SafetyCheckOverlay';

/**
 * The authenticated navigator.
 *
 * Option 15 §1 principle 1: Home is a full-screen map with a pull-up sheet, and
 * there is **no tab bar**. Everything that used to be a tab is now reached from
 * inside that sheet — Journeys and Family from the sheet's own content, and
 * Settings from the avatar beside "Where to?".
 *
 * That is why this is a Stack rather than Tabs: a tab bar would permanently
 * occupy the bottom of the screen, which is exactly where the safety dock and
 * the sheet live.
 */
export default function AppLayout() {
  const theme = useTheme();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        {/* Home — the map. Everything else is pushed over it. */}
        <Stack.Screen name="home" />

        {/*
          Genuinely modal sheets, presented over the map. These use the
          platform sheet (UISheetPresentationController / BottomSheetBehavior)
          via react-native-screens — unlike Home's own sheet, which is part of
          the screen and never dismisses. See sheetPresentation.ts.
        */}
        <Stack.Screen name="settings" options={PRESENTED_SHEET_OPTIONS} />
        <Stack.Screen name="journeys" options={PRESENTED_SHEET_OPTIONS} />
        <Stack.Screen name="family" options={PRESENTED_SHEET_OPTIONS} />

        {/* Journey flow — full screens, pushed. */}
        <Stack.Screen name="where-to" />
        <Stack.Screen name="add-place" />
        <Stack.Screen name="saved-places" />
        <Stack.Screen name="map-picker" />
        <Stack.Screen name="route" />
        <Stack.Screen name="review-journey" />
        <Stack.Screen name="allow-location" />
        <Stack.Screen name="active-journey" />
        <Stack.Screen name="arrived" />

        {/* Safety. SOS is deliberately a full-screen modal: it must cover
            everything and never be mistaken for a sheet that can be swiped
            away mid-emergency. */}
        {/* Feeling uneasy (AI5) — deliberately NOT a fullScreenModal like SOS:
            it is the non-emergency step, and must not borrow SOS's weight. */}
        <Stack.Screen name="uneasy" options={PRESENTED_SHEET_OPTIONS} />

        <Stack.Screen name="sos" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="sos-trigger" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="emergency-mode" options={{ presentation: 'fullScreenModal' }} />

        {/* Fake call imitates the OS call screen, so it must own the display. */}
        <Stack.Screen name="fake-incoming-call" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="fake-active-call" options={{ presentation: 'fullScreenModal' }} />

        {/* Settings destinations and other pushed screens. */}
        <Stack.Screen name="contacts" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="data-visibility" />
        <Stack.Screen name="fake-call-settings" />
        <Stack.Screen name="delete-account" />
        <Stack.Screen name="family-invite" />
        <Stack.Screen name="family-member" />
      </Stack>

      {/*
        Screen 08 is raised by a background detector, not by navigation, so it
        renders as a sibling of the whole stack — it must appear over whatever
        is on screen, including a presented sheet.
      */}
      <SafetyCheckOverlay />
    </>
  );
}
