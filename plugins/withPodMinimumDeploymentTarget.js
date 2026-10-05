const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Raises every CocoaPods target to the app's minimum iOS version.
 *
 * Xcode 27 refuses to build any target below iOS 15. A handful of pods still
 * declare older minimums in their podspecs — notably the *resource bundle*
 * targets that `react-native-maps` (11.0) and `@react-native-async-storage`
 * (13.4) generate for their privacy manifests. Those bundles are created by
 * CocoaPods itself, so `expo-build-properties`' deploymentTarget does not
 * reach them: it sets the Podfile platform, while these inherit from the
 * podspec.
 *
 * The result is a hard build failure, not a warning, and it names targets that
 * do not exist in our source — so this fixes it at the one place that owns
 * every pod target at once.
 *
 * Written as a config plugin rather than by editing ios/Podfile because
 * prebuild regenerates that file; a hand edit survives exactly until the next
 * `expo prebuild`.
 */
const withPodMinimumDeploymentTarget = (config, { deploymentTarget }) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Idempotent: prebuild may run this more than once against the same file.
      if (contents.includes('WAYLOC_MIN_DEPLOYMENT_TARGET')) return cfg;

      const patch = `
    # WAYLOC_MIN_DEPLOYMENT_TARGET — see plugins/withPodMinimumDeploymentTarget.js
    # Covers resource-bundle targets, which the Podfile platform setting misses.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_configuration|
        current = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < ${deploymentTarget}.to_f
          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'
        end
      end
    end
    installer.generated_aggregate_targets.each do |aggregate_target|
      aggregate_target.user_project.native_targets.each do |target|
        target.build_configurations.each do |build_configuration|
          current = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
          if current.nil? || current.to_f < ${deploymentTarget}.to_f
            build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'
          end
        end
      end
      aggregate_target.user_project.save
    end
`;

      contents = contents.replace(
        /(\n\s*post_install do \|installer\|\n)/,
        `$1${patch}`,
      );

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);

module.exports = withPodMinimumDeploymentTarget;
