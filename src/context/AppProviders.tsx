/**
 * AppProviders wires all concrete implementations to the app.
 * When Firebase credentials are absent (local dev), Mock providers are used
 * automatically — no code change needed to switch.
 */
import React from 'react';

import { firebaseApp, isFirebaseConfigured } from '../config/firebase';
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

import { FakeCallService } from '../services/FakeCallService';
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

import { AuthStateProvider } from './AuthContext';
import { AccountDeletionStateProvider } from './AccountDeletionContext';
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
import { FakeCallStateProvider } from './FakeCallContext';
import { BatteryStateProvider } from './BatteryContext';

const devMode = !isFirebaseConfigured();

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

// Map: MockMapProvider is used in all modes until a native SDK is chosen.
const mapProvider = new MockMapProvider();

// Routing: MockRoutingProvider in dev (no network calls), OSRM in production.
// Base URL is configurable via EXPO_PUBLIC_OSRM_BASE_URL so no URL is hardcoded.
const OSRM_BASE_URL =
  process.env.EXPO_PUBLIC_OSRM_BASE_URL ?? 'https://router.project-osrm.org';
const routingProvider = devMode
  ? new MockRoutingProvider()
  : new OSRMRoutingProvider(OSRM_BASE_URL);
const routingService = new RoutingService(routingProvider);

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
  devMode,
};

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
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
  );
}

function InnerProviders({ children }: { children: React.ReactNode }) {
  return (
    <AccountDeletionStateProvider accountDeletionService={accountDeletionService}>
    <BatteryStateProvider batteryService={batteryService}>
    <FakeCallStateProvider
      fakeCallService={fakeCallService}
      settingsStore={FakeCallSettingsStore}
    >
    <ContactStateProvider contactService={contactService}>
      {/*
        MapStateProvider supplies the map renderer singleton to the entire
        authenticated tree. It sits outside JourneyStateProvider so that
        any future map usage outside journey screens also has access.
      */}
      <MapStateProvider mapProvider={mapProvider}>
        <JourneyStateProvider journeyService={journeyService}>
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
            </RoutingStateProvider>
          </LocationTrackingProvider>
        </JourneyStateProvider>
      </MapStateProvider>
    </ContactStateProvider>
    </FakeCallStateProvider>
    </BatteryStateProvider>
    </AccountDeletionStateProvider>
  );
}
