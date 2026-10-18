/**
 * The Siri / Action Button / Back Tap SOS extension (hands-free SOS).
 * Shares a Keychain group with the app so it can read the SOS key the app
 * stores (see modules/hands-free-sos/ios/SosVault.swift).
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'app-intent',
  name: 'sos_intent',
  displayName: 'WayLoc SOS',
  // App Intents extensions are ExtensionKit extensions: iOS 17 and later.
  deploymentTarget: '17.0',
  frameworks: ['AppIntents', 'CoreLocation'],
  bundleIdentifier: '.sos-intent',
  entitlements: {
    'keychain-access-groups': config.ios.entitlements['keychain-access-groups'],
  },
});
