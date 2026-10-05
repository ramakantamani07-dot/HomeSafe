import { ExpoConfig, ConfigContext } from 'expo/config';

// The launch screen and icon background are app *chrome*, so they come from
// the same palette the UI does rather than a hex pasted here. Changing the
// app's colour stays a one-file edit (src/config/theme/palette.ts) — these
// were still the pre-Option-15 blue, which no part of the app used any more.
// The .ts extension is required and not a mistake: Expo's config evaluator
// transpiles app.config.ts itself but resolves its imports through plain Node,
// which will not guess the extension. Dropping it fails prebuild with
// "Cannot find module './src/config/theme/palette'".
import { lightTheme } from './src/config/theme/palette.ts';

/**
 * Apple Team ID, needed only by the SOS widget target.
 *
 * The widget is an additional Xcode target, and @bacons/apple-targets cannot
 * provision one without a team. Rather than hard-failing every build until it's
 * set, the target below is registered only when this is present — so the app
 * builds and runs on device without it, just without the Lock Screen widget.
 */
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;

/**
 * The app's identifier — iOS bundle identifier and Android package name.
 *
 * Apple's identifier namespace is **global**, not per-team: a generic id is
 * likely already registered to someone else's account, and Apple then refuses
 * to register it to ours ("cannot be registered to your development team
 * because it is not available"). That is exactly what `com.wayloc.app` hit.
 *
 * One constant drives both platforms so they can never drift apart, and
 * APP_BUNDLE_ID overrides it without touching this file — needed when building
 * against a different Apple account, or for a side-by-side build variant.
 *
 * The SOS widget target derives its own id from this one; see targets/.
 */
const BUNDLE_ID = process.env.APP_BUNDLE_ID ?? 'com.ramasatish.wayLoc';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'wayLoc',
  slug: 'wayloc',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Was 'light' — that forces the app to ALWAYS render light regardless of
  // the device's system setting (confirmed directly: Android's own uiMode
  // service correctly reported night mode active, but useColorScheme() still
  // returned 'light' because this setting locks it natively). 'automatic'
  // lets useColorScheme()/ThemeContext actually follow the system setting,
  // which is what the whole light/dark theme system assumes. This is baked
  // into the native project at prebuild time, so it needs a new native build
  // to take effect — a plain JS/Metro reload won't pick it up.
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: lightTheme.background,
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: BUNDLE_ID,
    // Required before the SOS Lock Screen widget target can be provisioned.
    // Supplied via APPLE_TEAM_ID so it isn't committed; find it in Xcode under
    // Signing & Capabilities, or at developer.apple.com → Membership.
    ...(APPLE_TEAM_ID ? { appleTeamId: APPLE_TEAM_ID } : {}),
    infoPlist: {
      NSFaceIDUsageDescription:
        'wayLoc uses Face ID to protect your personal safety data.',
      // Answers Apple's export-compliance question up front so eas-cli stops
      // asking interactively on every build. Correct as "false" (= exempt) as
      // long as the app only ever uses standard HTTPS/TLS and OS-level
      // Keychain storage (expo-secure-store) — true today. Revisit this if
      // any custom/non-standard cryptography is ever added.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: lightTheme.background,
    },
    package: BUNDLE_ID,
    // Normal-protection permission (auto-granted at install, no runtime
    // prompt) — required to launch the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
    // intent from the Privacy & Security screen. Without this declared, that
    // intent silently fails on some OEM builds.
    permissions: ['android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'],
    // react-native-maps has no Expo config plugin of its own — Expo's
    // prebuild-config has first-party built-in support for it instead,
    // reading this exact field (@expo/config-plugins' GoogleMapsApiKey
    // helper, verified directly in node_modules before relying on it).
    // Android has no keyless map provider the way iOS has Apple Maps, so
    // PROVIDER_DEFAULT still needs a real key here — unset until a Google
    // Cloud project exists; the map will prebuild fine but show a blank grid
    // on Android without one.
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
  },
  plugins: [
    'expo-asset',
    'expo-router',
    'expo-secure-store',
    'expo-file-system',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'wayLoc uses your location when you start a journey to help your trusted contacts know you are safe.',
        locationAlwaysAndWhenInUsePermission:
          'wayLoc uses your location in the background when a journey is active so your trusted contacts can follow your progress.',
        // Without these, ExpoLocationProvider's background task registration
        // (Location.startLocationUpdatesAsync) silently has no effect: iOS
        // won't deliver background updates without UIBackgroundModes:
        // ['location'] in Info.plist, and Android won't grant
        // ACCESS_BACKGROUND_LOCATION or the foreground-service permissions
        // that provider already assumes exist (see its `foregroundService`
        // config block). Both flags are required — iOS and Android each need
        // their own declaration, this isn't a single cross-platform switch.
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    'expo-task-manager',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: lightTheme.accent,
        androidMode: 'default',
      },
    ],
    'expo-local-authentication',
    [
      // Xcode 27 rejects any target below iOS 15. Two pod *resource bundle*
      // targets (react-native-maps' privacy bundle, AsyncStorage's resources)
      // still declare 11.0 and 13.4 in their podspecs, which fails the build
      // outright rather than warning.
      //
      // This normalises every pod target to the app's own minimum instead of
      // hand-editing the generated Podfile, which prebuild would overwrite.
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '15.1',
        },
      },
    ],
    // expo-build-properties sets the Podfile platform, which does not reach
    // CocoaPods' generated resource-bundle targets. This raises those too.
    ['./plugins/withPodMinimumDeploymentTarget', { deploymentTarget: '15.1' }],
    './plugins/withSOSQuickSettingsTile',
    // Scaffolds the SOS Lock Screen widget's Xcode target from
    // targets/sos-widget/ (see @bacons/apple-targets — the community
    // solution for adding non-RN Xcode targets in an Expo CNG workflow).
    // Building on a real device needs the widget target's own bundle
    // identifier provisioned in Apple Developer, and a paid account to do
    // that with — pending until that's set up. `ios.appleTeamId` should be
    // added here too once available (see the plugin's own README).
    // Only registered when a team is available — see APPLE_TEAM_ID above.
    // Without it the app still builds and runs; it just has no Lock Screen
    // widget, which is an additional SOS entry point rather than SOS itself.
    ...(APPLE_TEAM_ID ? ['@bacons/apple-targets' as const] : []),
  ],
  extra: {
    firebaseApiKey: process.env.FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.FIREBASE_APP_ID,
    eas: {
      // Not a secret — this is just the identifier linking this app to its EAS
      // project, and eas-cli's own docs recommend committing it directly rather
      // than routing it through an env var. It also has to be a literal value
      // here: dynamic config files (app.config.ts, unlike static app.json)
      // can't be auto-edited by `eas build:configure`, which is what the
      // "Cannot automatically write to dynamic config" error was about.
      projectId: '7e8d2b26-6e97-4fbb-bce6-1df930a30a71',
    },
  },
  scheme: 'wayloc',
  web: {
    bundler: 'metro',
  },
});
