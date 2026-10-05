/**
 * AppProviders wires all concrete implementations to the app.
 * When Firebase credentials are absent (local dev), Mock providers are used
 * automatically — no code change needed to switch.
 */
import React from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import { firebaseApp } from '../config/firebase';
import { describeDataSource, useMockData } from '../config/dataSource';
import { FirebaseAuthProvider } from '../implementations/auth/FirebaseAuthProvider';
import { MockAuthProvider } from '../implementations/auth/MockAuthProvider';
import { FirebaseContactProvider } from '../implementations/contacts/FirebaseContactProvider';
import { MockContactProvider } from '../implementations/contacts/MockContactProvider';
import { ExpoPermissionProvider } from '../implementations/permissions/ExpoPermissionProvider';
import { MockPermissionProvider } from '../implementations/permissions/MockPermissionProvider';
import { ExpoBiometricProvider } from '../implementations/biometric/ExpoBiometricProvider';
import { MockBiometricProvider } from '../implementations/biometric/MockBiometricProvider';
import { ExpoLocationProvider } from '../implementations/location/ExpoLocationProvider';
import { MockLocationProvider } from '../implementations/location/MockLocationProvider';
import { FirebaseJourneyProvider } from '../implementations/journey/FirebaseJourneyProvider';
import { MockJourneyProvider } from '../implementations/journey/MockJourneyProvider';
import { MockMapProvider } from '../implementations/map/MockMapProvider';
import { ReactNativeMapsProvider } from '../implementations/map/ReactNativeMapsProvider';
import { FirebaseCheckInProvider } from '../implementations/checkin/FirebaseCheckInProvider';
import { MockCheckInProvider } from '../implementations/checkin/MockCheckInProvider';
import { FirebaseSOSProvider } from '../implementations/sos/FirebaseSOSProvider';
import { MockSOSProvider } from '../implementations/sos/MockSOSProvider';
import { FirebaseNotificationProvider } from '../implementations/notification/FirebaseNotificationProvider';
import { MockNotificationProvider } from '../implementations/notification/MockNotificationProvider';
import { NetInfoNetworkProvider } from '../implementations/network/NetInfoNetworkProvider';
import { AsyncStorageOfflineQueueProvider } from '../implementations/offlineQueue/AsyncStorageOfflineQueueProvider';
import { OSRMRoutingProvider } from '../implementations/routing/OSRMRoutingProvider';
import { MockRoutingProvider } from '../implementations/routing/MockRoutingProvider';
import { FakeCallSettingsStore } from '../implementations/fakeCall/FakeCallSettingsStore';
import { SecureUserStorageProvider } from '../implementations/storage/SecureUserStorageProvider';
import { ExpoBatteryProvider } from '../implementations/battery/ExpoBatteryProvider';
import { MockBatteryProvider } from '../implementations/battery/MockBatteryProvider';
import { FirebaseAccountDeletionProvider } from '../implementations/auth/FirebaseAccountDeletionProvider';
import { MockAccountDeletionProvider } from '../implementations/auth/MockAccountDeletionProvider';
import { FirebaseFamilyProvider } from '../implementations/family/FirebaseFamilyProvider';
import { MockFamilyProvider } from '../implementations/family/MockFamilyProvider';
import { FirebaseDataExportProvider } from '../implementations/export/FirebaseDataExportProvider';
import { MockDataExportProvider } from '../implementations/export/MockDataExportProvider';
import { ExpoDeviceIntegrityProvider } from '../implementations/security/ExpoDeviceIntegrityProvider';
import { MockDeviceIntegrityProvider } from '../implementations/security/MockDeviceIntegrityProvider';
import { GooglePlacesProvider } from '../implementations/places/GooglePlacesProvider';
import { MockPlacesProvider } from '../implementations/places/MockPlacesProvider';
import { PlatformGeocoderPlacesProvider } from '../implementations/places/PlatformGeocoderPlacesProvider';
import { FirebaseSavedPlaceProvider } from '../implementations/places/FirebaseSavedPlaceProvider';
import { MockSavedPlaceProvider } from '../implementations/places/MockSavedPlaceProvider';
import { FirebaseSafetyCheckProvider } from '../implementations/safetyCheck/FirebaseSafetyCheckProvider';
import { MockSafetyCheckProvider } from '../implementations/safetyCheck/MockSafetyCheckProvider';
import { FirebaseWalkFeedbackProvider } from '../implementations/walkFeedback/FirebaseWalkFeedbackProvider';
import { MockWalkFeedbackProvider } from '../implementations/walkFeedback/MockWalkFeedbackProvider';

import { FakeCallService } from '../services/FakeCallService';
import { DataExportService } from '../services/DataExportService';
import { BatteryService } from '../services/BatteryService';
import { AccountDeletionService } from '../services/AccountDeletionService';
import { FamilyService } from '../services/FamilyService';
import { AuthService } from '../services/AuthService';
import { ContactService } from '../services/ContactService';
import { PrivacyService } from '../services/PrivacyService';
import { JourneyService } from '../services/JourneyService';
import { LocationTrackingService } from '../services/LocationTrackingService';
import { CheckInService } from '../services/CheckInService';
import { SOSService } from '../services/SOSService';
import { NotificationService } from '../services/NotificationService';
import { OfflineSyncService } from '../services/OfflineSyncService';
import { RoutingService } from '../services/RoutingService';
import { PlacesService } from '../services/PlacesService';
import { SavedPlaceService } from '../services/SavedPlaceService';
import { SafetyCheckService } from '../services/SafetyCheckService';

import { ThemeStateProvider } from './ThemeContext';
import { AuthStateProvider } from './AuthContext';
import { AccountDeletionStateProvider } from './AccountDeletionContext';
import { DataExportStateProvider } from './DataExportContext';
import { FamilyStateProvider } from './FamilyContext';
import { ContactStateProvider } from './ContactContext';
import { MapStateProvider } from './MapContext';
import { PrivacyStateProvider } from './PrivacyContext';
import { JourneyStateProvider } from './JourneyContext';
import { LocationTrackingProvider } from './LocationTrackingContext';
import { CheckInStateProvider } from './CheckInContext';
import { SOSStateProvider } from './SOSContext';
import { NotificationStateProvider } from './NotificationContext';
import { NetworkStateProvider } from './NetworkContext';
import { OfflineSyncStateProvider } from './OfflineSyncContext';
import { RoutingStateProvider } from './RoutingContext';
import { PlacesStateProvider } from './PlacesContext';
import { JourneyDraftStateProvider } from './JourneyDraftContext';
import { SafetyCheckStateProvider } from './SafetyCheckContext';
import { FakeCallStateProvider } from './FakeCallContext';
import { BatteryStateProvider } from './BatteryContext';

// Mock vs real lives in one place — see src/config/dataSource.ts, and
// docs/reference/RUNNING.md for how to flip it.
const devMode = useMockData;

// Logged once at startup so which backend is live is never in doubt. The one
// thing worse than running on mocks is believing you aren't.
// eslint-disable-next-line no-console
console.log(describeDataSource());

// ─── Provider singletons ──────────────────────────────────────────────────────

const authProvider = devMode
  ? new MockAuthProvider()
  : new FirebaseAuthProvider(firebaseApp!);

const contactProvider = devMode
  ? new MockContactProvider()
  : new FirebaseContactProvider(firebaseApp!);

const permissionProvider = devMode
  ? new MockPermissionProvider()
  : new ExpoPermissionProvider();

const biometricProvider = devMode
  ? new MockBiometricProvider()
  : new ExpoBiometricProvider();

const locationProvider = devMode
  ? new MockLocationProvider()
  : new ExpoLocationProvider();

const journeyProvider = devMode
  ? new MockJourneyProvider()
  : new FirebaseJourneyProvider(firebaseApp!);

const checkInProvider = devMode
  ? new MockCheckInProvider()
  : new FirebaseCheckInProvider(firebaseApp!);

const sosProvider = devMode
  ? new MockSOSProvider()
  : new FirebaseSOSProvider(firebaseApp!);

const notificationProvider = devMode
  ? new MockNotificationProvider()
  : new FirebaseNotificationProvider(firebaseApp!);

const storageProvider = new SecureUserStorageProvider();

// NetworkProvider and OfflineQueueProvider are always the real implementations
// (mocks don't need offline queueing — they never fail with network errors).
const networkProvider = new NetInfoNetworkProvider();
const queueProvider = new AsyncStorageOfflineQueueProvider();

// OfflineSyncService is only wired in production mode.
// In dev mode, services run without it (mock providers always succeed).
const offlineSyncService = devMode
  ? null
  : new OfflineSyncService(queueProvider, journeyProvider, sosProvider, checkInProvider);

// ─── Service singletons ───────────────────────────────────────────────────────

const authService = new AuthService(authProvider, storageProvider);
const contactService = new ContactService(contactProvider);
const privacyService = new PrivacyService(permissionProvider, biometricProvider);

const journeyService = new JourneyService(
  journeyProvider,
  locationProvider,
  offlineSyncService,
  devMode ? null : networkProvider,
);

const trackingService = new LocationTrackingService(
  locationProvider,
  journeyProvider,
  offlineSyncService,
  devMode ? null : networkProvider,
);

const checkInService = new CheckInService(
  checkInProvider,
  journeyProvider,
  offlineSyncService,
  devMode ? null : networkProvider,
);

const sosService = new SOSService(
  sosProvider,
  journeyProvider,
  offlineSyncService,
  devMode ? null : networkProvider,
);

const notificationService = new NotificationService(notificationProvider);

// The map is the one provider that must NOT follow `devMode`.
//
// Every other provider splits on whether backend credentials exist. The map has
// no backend and no credentials: PROVIDER_DEFAULT is Apple Maps on iOS, which is
// free and keyless. Tying it to the data source meant a mock-data run showed a
// placeholder rectangle on precisely the builds where the real map works — the
// map was the thing we most needed to look at, and it was the thing hidden.
//
// What actually decides this is whether the *native module* can load.
// react-native-maps has no JS fallback, so Expo Go cannot render it at all,
// while a dev client or a release build can. That is the real constraint, so
// that is what this reads — leaving mock data free to mean only "mock data".
const nativeMapsAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const mapProvider = nativeMapsAvailable
  ? new ReactNativeMapsProvider()
  : new MockMapProvider();

// Routing: MockRoutingProvider in dev (no network calls), OSRM in production.
// Base URL is configurable via EXPO_PUBLIC_OSRM_BASE_URL so no URL is hardcoded.
const OSRM_BASE_URL =
  process.env.EXPO_PUBLIC_OSRM_BASE_URL ?? 'https://router.project-osrm.org';
const routingProvider = devMode
  ? new MockRoutingProvider()
  : new OSRMRoutingProvider(OSRM_BASE_URL);
const routingService = new RoutingService(routingProvider);

// Address lookup, in descending order of capability.
//
// Google Places is the only one that does point-of-interest autocomplete, so a
// configured key always wins. Without one we use the OS geocoder rather than
// fixtures: it resolves real addresses and postcodes for free, with no key and
// no account, so a real postcode typed on a real device finds the real place.
// Fixtures are now only for where there is no native geocoder to call at all.
//
// This keys off the API key rather than Firebase config because the two are
// provisioned independently — a Places key is not implied by having a backend.
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
const placesProvider = GOOGLE_PLACES_API_KEY
  ? new GooglePlacesProvider(GOOGLE_PLACES_API_KEY)
  : nativeMapsAvailable
    ? new PlatformGeocoderPlacesProvider()
    : new MockPlacesProvider();
const placesService = new PlacesService(placesProvider);

const savedPlaceProvider = devMode
  ? new MockSavedPlaceProvider()
  : new FirebaseSavedPlaceProvider(firebaseApp!);
const savedPlaceService = new SavedPlaceService(savedPlaceProvider);

const safetyCheckProvider = devMode
  ? new MockSafetyCheckProvider()
  : new FirebaseSafetyCheckProvider(firebaseApp!);
const safetyCheckService = new SafetyCheckService(safetyCheckProvider);

const walkFeedbackProvider = devMode
  ? new MockWalkFeedbackProvider()
  : new FirebaseWalkFeedbackProvider(firebaseApp!);

const fakeCallService = new FakeCallService();

const batteryProvider = devMode ? new MockBatteryProvider() : new ExpoBatteryProvider();
const batteryService = new BatteryService(batteryProvider);

const accountDeletionProvider = devMode
  ? new MockAccountDeletionProvider()
  : new FirebaseAccountDeletionProvider(firebaseApp!);

const accountDeletionService = new AccountDeletionService(
  accountDeletionProvider,
  authProvider,
  queueProvider,
  storageProvider,
);

const familyProvider = devMode
  ? new MockFamilyProvider()
  : new FirebaseFamilyProvider(firebaseApp!);

const familyService = new FamilyService(familyProvider);

const dataExportProvider = devMode
  ? new MockDataExportProvider()
  : new FirebaseDataExportProvider(firebaseApp!);

const dataExportService = new DataExportService(dataExportProvider, storageProvider);

// Not Firebase-dependent, but split the same way as everything else here so
// local dev on a jailbroken/rooted simulator or an unlinked native module
// never produces a false "compromised" flag during development.
export const deviceIntegrityProvider = devMode
  ? new MockDeviceIntegrityProvider()
  : new ExpoDeviceIntegrityProvider();

export {
  authProvider,
  storageProvider,
  contactProvider,
  permissionProvider,
  biometricProvider,
  locationProvider,
  journeyProvider,
  checkInProvider,
  sosProvider,
  notificationProvider,
  networkProvider,
  mapProvider,
  authService,
  contactService,
  privacyService,
  journeyService,
  trackingService,
  checkInService,
  sosService,
  notificationService,
  offlineSyncService,
  routingService,
  placesProvider,
  placesService,
  savedPlaceProvider,
  savedPlaceService,
  safetyCheckProvider,
  safetyCheckService,
  walkFeedbackProvider,
  devMode,
};

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeStateProvider>
      <NetworkStateProvider networkProvider={networkProvider}>
        {/*
          PrivacyStateProvider sits outside AuthStateProvider so that the
          BiometricGate can read privacy prefs regardless of auth state.
        */}
        <PrivacyStateProvider privacyService={privacyService}>
          <AuthStateProvider
            authService={authService}
            authProvider={authProvider}
            isDevMode={devMode}
          >
            {/*
              NotificationStateProvider sits directly inside AuthStateProvider so
              the FCM token is registered (and saved to Firestore) on every sign-in,
              before any journey or SOS activity begins.
            */}
            <NotificationStateProvider notificationService={notificationService}>
              {/*
                OfflineSyncStateProvider watches NetworkContext and triggers
                syncNow() whenever connectivity returns. It also runs an initial
                sync on mount to flush items left over from a previous session.
                Placed here so it runs after auth is established (queue items
                carry userId) but before journey/check-in/SOS contexts try Firestore.
              */}
              {offlineSyncService ? (
                <OfflineSyncStateProvider offlineSyncService={offlineSyncService}>
                  <InnerProviders>{children}</InnerProviders>
                </OfflineSyncStateProvider>
              ) : (
                <InnerProviders>{children}</InnerProviders>
              )}
            </NotificationStateProvider>
          </AuthStateProvider>
        </PrivacyStateProvider>
      </NetworkStateProvider>
    </ThemeStateProvider>
  );
}

function InnerProviders({ children }: { children: React.ReactNode }) {
  return (
    <AccountDeletionStateProvider accountDeletionService={accountDeletionService}>
    <DataExportStateProvider dataExportService={dataExportService}>
    <BatteryStateProvider batteryService={batteryService}>
    <FakeCallStateProvider
      fakeCallService={fakeCallService}
      settingsStore={FakeCallSettingsStore}
    >
    <ContactStateProvider contactService={contactService}>
    {/*
      PlacesStateProvider only needs auth, but sits above the journey tree so
      the review/arrived screens can save a destination as a place without
      threading the service through navigation params.
    */}
    <PlacesStateProvider placesService={placesService} savedPlaceService={savedPlaceService}>
    {/*
      Holds the in-flight destination selection across screens 02 → 03 → 04.
      Pure UI state (no service), but it lives here rather than in a screen so
      the back-navigation rules in JOURNEY_FLOW_SPEC §3 survive unmounting.
    */}
    <JourneyDraftStateProvider>
      {/*
        MapStateProvider supplies the map renderer singleton to the entire
        authenticated tree. It sits outside JourneyStateProvider so that
        any future map usage outside journey screens also has access.
      */}
      <MapStateProvider mapProvider={mapProvider}>
        <JourneyStateProvider
          journeyService={journeyService}
          walkFeedbackProvider={walkFeedbackProvider}
        >
          {/*
            LocationTrackingProvider must be inside JourneyStateProvider so
            it can read activeJourney. It starts/stops the tracking service
            automatically as the journey lifecycle changes.
          */}
          <LocationTrackingProvider trackingService={trackingService}>
            {/*
              RoutingStateProvider must be inside LocationTrackingProvider so it
              can read currentLocation for off-route detection, and inside
              JourneyStateProvider so it can read activeJourney.
            */}
            <RoutingStateProvider
              routingService={routingService}
              journeyService={journeyService}
            >
            {/*
              CheckInStateProvider must be inside LocationTrackingProvider
              (which is inside JourneyStateProvider) so that it can read
              activeJourney and call missedCheckIn() on the journey context.
            */}
            {/*
              Must sit inside RoutingStateProvider: the late-detector measures
              against the live route's ETA, and the off-route detector against
              its geometry.
            */}
            <SafetyCheckStateProvider safetyCheckService={safetyCheckService}>
            <CheckInStateProvider checkInService={checkInService}>
              {/*
                SOSStateProvider must be inside JourneyStateProvider so it
                can read activeJourney and call clearJourneyForSOS(). It sits
                inside CheckInStateProvider to ensure the check-in timer stops
                (activeJourney → null) before SOS state is visible to screens.
              */}
              <SOSStateProvider sosService={sosService}>
                {/*
                  FamilyStateProvider sits inside SOSStateProvider and
                  BatteryStateProvider so it can read activeSOS, activeJourney,
                  and batteryLevel to publish the user's live family status.
                */}
                <FamilyStateProvider familyService={familyService}>
                  {children}
                </FamilyStateProvider>
              </SOSStateProvider>
            </CheckInStateProvider>
            </SafetyCheckStateProvider>
            </RoutingStateProvider>
          </LocationTrackingProvider>
        </JourneyStateProvider>
      </MapStateProvider>
    </JourneyDraftStateProvider>
    </PlacesStateProvider>
    </ContactStateProvider>
    </FakeCallStateProvider>
    </BatteryStateProvider>
    </DataExportStateProvider>
    </AccountDeletionStateProvider>
  );
}
