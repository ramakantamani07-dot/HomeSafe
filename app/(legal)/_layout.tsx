import { Stack } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';

/**
 * Reachable both signed-out (linked from the phone-auth disclaimer) and
 * signed-in (linked from Privacy & Security settings). See the `(legal)`
 * exemption in app/_layout.tsx's NavigationGuard — without it, the auth
 * redirect would bounce a signed-out visitor straight back to /phone.
 */
export default function LegalLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="terms" />
    </Stack>
  );
}
