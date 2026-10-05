const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro's package.json "exports" field resolution (still `unstable_` in this
// Metro version) has a confirmed bug with how the Firebase JS SDK declares
// its conditional exports — verified directly: Firebase's own top-level
// legacy `main`/`browser`/`react-native` package.json fields are correct and
// properly platform-differentiated, but even after switching this app's own
// imports to the correctly-conditioned `@firebase/*` scoped packages, Auth's
// self-registration (`registerAuth()`, called unconditionally at module load
// in @firebase/auth's own source) still silently failed to reach this app's
// FirebaseApp instance — a Metro-side exports-resolution bug, not anything
// fixable from this app's own import paths. Matches a widely-reported issue
// (expo/expo#36588) affecting Expo SDK 53+. Disabling exports resolution
// falls back to legacy mainFields resolution, which resolves Firebase
// correctly.
config.resolver.unstable_enablePackageExports = false;
config.resolver.sourceExts.push('cjs');

module.exports = config;
