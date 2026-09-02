import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'HomeSafe',
  slug: 'homesafe',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#2563EB',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.homesafe.app',
    infoPlist: {
      NSFaceIDUsageDescription:
        'HomeSafe uses Face ID to protect your personal safety data.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2563EB',
    },
    package: 'com.homesafe.app',
  },
  plugins: [
    'expo-asset',
    'expo-router',
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'HomeSafe uses your location when you start a journey to help your trusted contacts know you are safe.',
        locationAlwaysAndWhenInUsePermission:
          'HomeSafe uses your location in the background when a journey is active so your trusted contacts can follow your progress.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#2563EB',
        androidMode: 'default',
      },
    ],
    'expo-local-authentication',
  ],
  extra: {
    firebaseApiKey: process.env.FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.FIREBASE_APP_ID,
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
  scheme: 'homesafe',
  web: {
    bundler: 'metro',
  },
});
