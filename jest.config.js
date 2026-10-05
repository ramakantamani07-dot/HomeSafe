/**
 * Two Jest projects, deliberately kept separate:
 *
 *  - "app": the RN/Expo unit suite — runs against Mock* providers, no network,
 *    no emulator. Uses jest-expo's environment and its RN-oriented
 *    transformIgnorePatterns (node_modules is skipped except a known RN/Expo
 *    allowlist).
 *
 *  - "rules": Firestore security-rules tests. These need @firebase/rules-unit-testing,
 *    which pulls in `firebase/compat/*` files that ship raw ESM `import` syntax.
 *    jest-expo's transformIgnorePatterns excludes node_modules (firebase included),
 *    so under the "app" project's config those files fail to parse. Plain Node
 *    environment + a transformIgnorePatterns that allows firebase/@firebase through
 *    for transformation fixes it without touching the RN suite's config at all.
 */
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      // Rooted under src/__tests__ specifically — functions/ has its own,
      // separate jest config (different runtime: plain Node, firebase-admin,
      // no RN environment) and must never be picked up here.
      testMatch: ['<rootDir>/src/__tests__/**/*.test.ts', '<rootDir>/src/__tests__/**/*.test.tsx'],
      testPathIgnorePatterns: ['<rootDir>/src/__tests__/firestoreRules.test.ts'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
    {
      displayName: 'rules',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/firestoreRules.test.ts'],
      transformIgnorePatterns: ['/node_modules/(?!(firebase|@firebase)/)'],
    },
  ],
};
