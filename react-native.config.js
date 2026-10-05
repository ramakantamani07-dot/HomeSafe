// react-native-maps ships native views that predate React Native's New
// Architecture (Fabric). This project has newArchEnabled=true (Expo SDK 54
// default), and without this compatibility list, Fabric's codegen doesn't
// know how to interop with these components — react-native-maps' own README
// documents this exact requirement.
//
// Note: excluding expo-firebase-core from autolinking does NOT belong here.
// It's an Expo Module (uses expo-modules-core), which autolinks through a
// separate system from plain React Native's react-native.config.js
// `dependencies` key — that exclusion silently has no effect for Expo
// Modules. The real mechanism is package.json's own `expo.autolinking.exclude`
// field (see expo-modules-autolinking's own source, autolinkingOptions.js).
const AIR_MAPS_LEGACY_COMPONENTS = [
  'AIRMap',
  'AIRMapCallout',
  'AIRMapCalloutSubview',
  'AIRMapCircle',
  'AIRMapHeatmap',
  'AIRMapLocalTile',
  'AIRMapMarker',
  'AIRMapOverlay',
  'AIRMapPolygon',
  'AIRMapPolyline',
  'AIRMapUrlTile',
  'AIRMapWMSTile',
];

module.exports = {
  project: {
    android: {
      unstable_reactLegacyComponentNames: AIR_MAPS_LEGACY_COMPONENTS,
    },
    ios: {
      unstable_reactLegacyComponentNames: AIR_MAPS_LEGACY_COMPONENTS,
    },
  },
};
