import { MockMapProvider } from './MockMapProvider';

// react-native-maps is native-only — importing it at all breaks Metro's web
// bundle (it pulls in RN internals like codegenNativeCommands that have no
// web equivalent). Metro resolves this .web.tsx file instead of the real
// ReactNativeMapsProvider.tsx whenever bundling for web, so the native
// module is never even reached. The web target here is a build-verification
// aid, not a shipped surface, so falling back to the same placeholder used
// in dev mode is the right trade-off.
export class ReactNativeMapsProvider extends MockMapProvider {}
