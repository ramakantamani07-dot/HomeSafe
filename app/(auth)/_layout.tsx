import { Stack } from 'expo-router';
import { FIXED_PALETTES } from '../../src/config/theme';

// Sign-in is drawn on white in both themes (FIXED_PALETTES.signIn), so the
// stack behind it is too — otherwise a dark frame shows during transitions.
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: FIXED_PALETTES.signIn.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
      {/* Signed in by now: swiping back to the code would make no sense. */}
      <Stack.Screen name="verified" options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack>
  );
}
