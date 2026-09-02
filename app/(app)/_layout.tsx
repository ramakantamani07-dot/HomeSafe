import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '../../src/config/constants';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.surface,
          paddingBottom: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Family',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👨‍👩‍👧" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
      {/* These screens are navigated to programmatically — hidden from tab bar */}
      <Tabs.Screen name="privacy" options={{ href: null }} />
      <Tabs.Screen name="start-journey" options={{ href: null }} />
      <Tabs.Screen name="active-journey" options={{ href: null }} />
      <Tabs.Screen name="emergency-mode" options={{ href: null }} />
      <Tabs.Screen name="fake-call-settings" options={{ href: null }} />
      <Tabs.Screen name="fake-incoming-call" options={{ href: null }} />
      <Tabs.Screen name="fake-active-call" options={{ href: null }} />
      <Tabs.Screen name="delete-account" options={{ href: null }} />
      <Tabs.Screen name="family-invite" options={{ href: null }} />
      <Tabs.Screen name="family-member" options={{ href: null }} />
    </Tabs>
  );
}
