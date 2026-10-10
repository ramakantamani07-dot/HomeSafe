import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FIXED_PALETTES, FONTS, SPACING } from '../../src/config/theme';
import { usePrivacy } from '../../src/hooks/usePrivacy';
import { SignInStory } from '../../src/components/auth/SignInStory';
import { SignInSheet } from '../../src/components/auth/SignInParts';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';

const C = FIXED_PALETTES.signIn;
/** What the phone's own biometric is called, for the lock offer. */
const BIOMETRIC_NAME = Platform.OS === 'ios' ? 'Face ID or Touch ID' : 'your fingerprint';
const STORY_HEIGHT = 230;
const CHECK_SIZE = 92;

/**
 * AN3 — "You're in".
 *
 * Says why location comes next, then asks for it: while-in-use only. "Always"
 * is asked when the first journey starts (allow-location), where the reason
 * for it is in front of the person (spec §4). Whatever they answer, Continue
 * goes Home — a "no" here costs nothing and can be changed later.
 *
 * Also offers the app lock, ticked by default where the phone has Face ID or
 * Touch ID: a stolen, unlocked phone otherwise opens straight onto everyone's
 * locations. Not on the AN3 board; see docs/reference/ACCOUNT_PROTECTION.md.
 */
export default function VerifiedScreen() {
  const router = useRouter();
  const {
    locationStatus,
    requestLocationPermission,
    biometricAvailable,
    biometricLockEnabled,
    enableBiometricLock,
  } = usePrivacy();
  const [asking, setAsking] = useState(false);
  const offerLock = biometricAvailable && !biometricLockEnabled;
  const [lockChosen, setLockChosen] = useState(true);

  const alreadyOn = locationStatus === 'granted';

  const handleContinue = async () => {
    setAsking(true);
    if (!alreadyOn) {
      // A failed request is the same as a "no": the journey flow asks again.
      await requestLocationPermission().catch(() => undefined);
    }
    if (offerLock && lockChosen) {
      // Confirms with Face ID before switching on. A cancel leaves it off;
      // it stays available in Privacy & Security.
      await enableBiometricLock().catch(() => undefined);
    }
    router.replace('/(app)/home');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <SignInStory style={styles.story} />

        <SignInSheet style={styles.sheet}>
          <View style={styles.check}>
            <Icon name="check" size={44} color={C.onBrand} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            You’re in
          </Text>
          <Text style={styles.body}>
            {alreadyOn
              ? 'Location is already on. Your circle sees you on journeys — only while you choose to share.'
              : 'Next: allow location so your circle can see you on journeys — only while you choose to share.'}
          </Text>

          <View style={styles.footer}>
            {offerLock && (
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: lockChosen }}
                style={styles.lockRow}
                onPress={() => setLockChosen((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, lockChosen && styles.checkboxOn]}>
                  {lockChosen && <Icon name="check" size={13} color={C.onBrand} />}
                </View>
                <Text style={styles.lockText}>
                  Lock wayLoc with {BIOMETRIC_NAME}, so no one else can open it on this phone.
                </Text>
              </TouchableOpacity>
            )}
            <Button variant="brand" label="Continue" onPress={handleContinue} loading={asking} />
            <Text style={styles.footnote}>You stay signed in on this phone.</Text>
          </View>
        </SignInSheet>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  flex: {
    flex: 1,
  },
  story: {
    height: STORY_HEIGHT,
    marginTop: SPACING.xxxl,
  },
  sheet: {
    flex: 1,
    marginTop: SPACING.xl,
    marginBottom: 6,
    alignItems: 'center',
    paddingTop: 34,
    gap: SPACING.lg,
  },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.brand,
    experimental_backgroundImage: C.checkGradient,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 12, color: C.focusRing }],
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: FONTS.headingXBold,
    fontSize: 28,
    letterSpacing: -0.6,
    color: C.ink,
  },
  body: {
    maxWidth: 290,
    textAlign: 'center',
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    color: C.textMuted,
  },
  footer: {
    marginTop: 'auto',
    alignSelf: 'stretch',
    gap: SPACING.sm + 2,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm + 2,
    alignSelf: 'stretch',
    marginBottom: SPACING.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.separator,
    backgroundColor: C.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: C.brand,
    backgroundColor: C.brand,
  },
  lockText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
    color: C.textMuted,
  },
  footnote: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: C.textMuted,
  },
});
