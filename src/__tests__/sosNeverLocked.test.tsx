/**
 * The app lock must never hold an SOS back (lockPolicy.ts).
 *
 * Renders the real BiometricGate with the lock switched on and checks what is
 * reachable: on an SOS path the screen beneath is mounted and live; elsewhere
 * it is still mounted (so nothing beneath is torn down) but covered,
 * untouchable and hidden from screen readers.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { isNeverLocked, NEVER_LOCKED_PATHS } from '../components/security/lockPolicy';

let mockPathname = '/home';
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));
jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
jest.mock('../hooks/usePrivacy', () => ({
  usePrivacy: () => ({
    biometricLockEnabled: true,
    biometricAvailable: true,
    isLoading: false,
    unlockWithBiometric: async () => false,
  }),
}));
jest.mock('../context/ThemeContext', () => {
  const { lightTheme } = jest.requireActual('../config/theme');
  return { useTheme: () => lightTheme };
});
jest.mock('../components/ui/Icon', () => ({ Icon: () => null }));

// Imported after the mocks it depends on.
// eslint-disable-next-line import/first
import { BiometricGate } from '../components/security/BiometricGate';

function renderAt(pathname: string) {
  mockPathname = pathname;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <BiometricGate>
        <Text testID="screen">screen beneath</Text>
      </BiometricGate>,
    );
  });
  return tree;
}

const texts = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => String(t.props.children));

describe('lock policy', () => {
  it('never locks the SOS path or the fake call', () => {
    for (const path of ['/sos-trigger', '/sos', '/emergency-mode', '/fake-incoming-call', '/fake-active-call']) {
      expect(isNeverLocked(path)).toBe(true);
    }
    expect(isNeverLocked('/sos/')).toBe(true);
  });

  it('locks everything else, including the screens that show family locations', () => {
    for (const path of ['/home', '/family', '/watch-member', '/find-result', '/', '']) {
      expect(isNeverLocked(path)).toBe(false);
    }
    expect(isNeverLocked(null)).toBe(false);
    expect(NEVER_LOCKED_PATHS.size).toBe(5);
  });
});

describe('BiometricGate with the lock on', () => {
  it('lets an SOS started from the widget, tile or Siri through, with no lock in front', () => {
    const tree = renderAt('/sos-trigger');
    expect(texts(tree)).toContain('screen beneath');
    expect(texts(tree)).not.toContain('Unlock to continue');
    const wrapper = tree.root.findByProps({ importantForAccessibility: 'auto' });
    expect(wrapper.props.pointerEvents).toBe('auto');
  });

  it('covers other screens without unmounting them', () => {
    const tree = renderAt('/home');
    // Still mounted beneath, so nothing in flight is torn down…
    expect(texts(tree)).toContain('screen beneath');
    // …but covered, untouchable and hidden from screen readers.
    expect(texts(tree)).toContain('Unlock to continue');
    const wrapper = tree.root.findByProps({ importantForAccessibility: 'no-hide-descendants' });
    expect(wrapper.props.pointerEvents).toBe('none');
    expect(wrapper.props.accessibilityElementsHidden).toBe(true);
  });
});
