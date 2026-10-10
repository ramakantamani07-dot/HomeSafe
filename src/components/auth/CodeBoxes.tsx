import React, { forwardRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { FIXED_PALETTES, FONTS, SPACING } from '../../config/theme';

const C = FIXED_PALETTES.signIn;

export const CODE_LENGTH = 6;
const BOX_HEIGHT = 62;

interface Props {
  /** The digits typed so far (0–6). */
  value: string;
  onChange: (digits: string) => void;
  /** Digits to show in red after a wrong code, until the next keystroke. */
  wrongCode?: string | null;
  disabled?: boolean;
}

/**
 * Six boxes, split 3–3 (AN2, AN4).
 *
 * One hidden `TextInput` sits over the boxes and the boxes only draw its
 * value. Six separate inputs — what this replaced — break one-time-code
 * auto-fill: iOS puts the whole code into the first field, which then keeps
 * one digit. A single field marked `oneTimeCode` / `sms-otp` takes the code
 * from Messages (iOS) or the autofill service (Android) in one go, and paste
 * works the same way.
 */
export const CodeBoxes = forwardRef<TextInput, Props>(function CodeBoxes(
  { value, onChange, wrongCode, disabled },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const showingWrong = !!wrongCode && value.length === 0;
  const shown = showingWrong ? wrongCode : value;

  const box = (i: number) => {
    const digit = shown[i] ?? '';
    const active = focused && !showingWrong && !disabled && i === value.length;
    return (
      <View
        key={i}
        style={[
          styles.box,
          !digit && !active && styles.boxIdle,
          active && styles.boxActive,
          showingWrong && styles.boxWrong,
        ]}
      >
        {active ? (
          <View style={styles.caret} />
        ) : (
          <Text style={[styles.digit, showingWrong && styles.digitWrong]}>{digit}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.boxes} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {box(0)}
        {box(1)}
        {box(2)}
        <Text style={styles.dash}>–</Text>
        {box(3)}
        {box(4)}
        {box(5)}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={CODE_LENGTH}
        editable={!disabled}
        autoFocus
        caretHidden
        accessibilityLabel="6-digit code"
        accessibilityValue={{ text: value.split('').join(' ') }}
        style={styles.hiddenInput}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    height: BOX_HEIGHT,
  },
  disabled: {
    opacity: 0.5,
  },
  boxes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  box: {
    flex: 1,
    height: BOX_HEIGHT,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: C.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxIdle: {
    backgroundColor: C.fieldIdle,
  },
  boxActive: {
    borderColor: C.brand,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: C.focusRing }],
  },
  boxWrong: {
    borderColor: C.errorEdge,
    backgroundColor: C.errorFill,
  },
  digit: {
    fontFamily: FONTS.headingXBold,
    fontSize: 28,
    color: C.ink,
  },
  digitWrong: {
    color: C.error,
  },
  caret: {
    width: 2,
    height: 26,
    backgroundColor: C.brand,
  },
  dash: {
    width: 10,
    textAlign: 'center',
    fontFamily: FONTS.headingXBold,
    color: C.separator,
    marginHorizontal: -SPACING.xs / 2,
  },
  // Covers the boxes so a tap anywhere on them focuses it, and long-press
  // offers Paste; invisible because the boxes draw what it holds.
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    opacity: 0.02,
  },
});
