const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SERVICE_NAME = '.SOSTileService';

/**
 * Adds the Android Quick Settings Tile for one-tap SOS.
 *
 * Native folders in this project are regenerated on every prebuild (CNG —
 * android/ and ios/ are gitignored), so the Kotlin source has to be copied
 * into place by a plugin rather than committed directly under android/.
 */
function withSOSTileSource(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      // Derived, never hard-coded. The destination directory and the Kotlin
      // `package` declaration must both match android.package exactly, and a
      // literal path silently desyncs the moment the app id changes — which is
      // precisely what happened when this project's bundle id was renamed: the
      // plugin kept writing to the old package directory while the app built
      // under the new one, leaving the tile service unreachable on Android.
      const androidPackage = config.android?.package;
      if (!androidPackage) {
        throw new Error(
          'withSOSQuickSettingsTile: android.package is not set, so the Quick ' +
            'Settings tile has no package to be compiled into.',
        );
      }

      const packagePath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...androidPackage.split('.'),
      );
      fs.mkdirSync(packagePath, { recursive: true });

      const source = fs.readFileSync(
        path.join(__dirname, 'android', 'SOSTileService.kt'),
        'utf8',
      );

      // The checked-in source carries a placeholder package line; the real one
      // is only knowable here, from the resolved config.
      const packaged = source.replace(
        /^package .*$/m,
        `package ${androidPackage}`,
      );
      fs.writeFileSync(path.join(packagePath, 'SOSTileService.kt'), packaged);

      return config;
    },
  ]);
}

function withSOSTileManifest(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

    if (!Array.isArray(mainApplication.service)) {
      mainApplication.service = [];
    }

    const alreadyRegistered = mainApplication.service.some(
      (service) => service.$?.['android:name'] === SERVICE_NAME,
    );
    if (alreadyRegistered) return config;

    mainApplication.service.push({
      $: {
        'android:name': SERVICE_NAME,
        'android:label': 'SOS',
        'android:icon': '@drawable/notification_icon',
        'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            {
              $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' },
            },
          ],
        },
      ],
    });

    return config;
  });
}

module.exports = function withSOSQuickSettingsTile(config) {
  config = withSOSTileSource(config);
  config = withSOSTileManifest(config);
  return config;
};
