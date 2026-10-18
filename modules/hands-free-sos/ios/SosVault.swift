import Foundation
import Security

/**
 The hands-free SOS key and the last known position, in a Keychain group the
 app and the Siri extension (`targets/sos-intent`) share.

 **This file is used by both.** `targets/sos-intent/SosVault.swift` is a
 symbolic link to it, so the two can never disagree about where the key lives.

 - Readable after the first unlock since restart (`AfterFirstUnlockThisDeviceOnly`):
   Siri must work on a locked phone, and a restored backup or a new phone must
   *not* inherit the key — they register their own.
 - Shared through the Keychain's *default* group: the app and the extension
   both list the same group first in `keychain-access-groups` (app.config.ts
   and targets/sos-intent/expo-target.config.js), and an item saved without
   an explicit group goes to the first one. So no team id is typed here.
 */
public enum SosVault {
  public struct Credentials: Codable {
    public let keyId: String
    public let key: String
    /** The deviceSos endpoint; empty in a development build with no backend. */
    public let endpoint: String
    /** Epoch ms until which a trigger is a test that alerts nobody. */
    public var testUntil: Double?

    public init(keyId: String, key: String, endpoint: String, testUntil: Double?) {
      self.keyId = keyId
      self.key = key
      self.endpoint = endpoint
      self.testUntil = testUntil
    }

    public var isTest: Bool {
      guard let testUntil else { return false }
      return Date().timeIntervalSince1970 * 1000 < testUntil
    }
  }

  public struct LastLocation: Codable {
    public let latitude: Double
    public let longitude: Double
    /** ISO 8601. */
    public let observedAt: String

    public init(latitude: Double, longitude: Double, observedAt: String) {
      self.latitude = latitude
      self.longitude = longitude
      self.observedAt = observedAt
    }
  }

  private static let service = "wayloc.handsfree-sos"
  private static let credentialsAccount = "credentials"
  private static let locationAccount = "last-location"

  public static func saveCredentials(_ credentials: Credentials) -> Bool {
    guard let data = try? JSONEncoder().encode(credentials) else { return false }
    return write(data, account: credentialsAccount)
  }

  public static func loadCredentials() -> Credentials? {
    guard let data = read(account: credentialsAccount) else { return nil }
    return try? JSONDecoder().decode(Credentials.self, from: data)
  }

  public static func saveLastLocation(_ location: LastLocation) -> Bool {
    guard let data = try? JSONEncoder().encode(location) else { return false }
    return write(data, account: locationAccount)
  }

  public static func loadLastLocation() -> LastLocation? {
    guard let data = read(account: locationAccount) else { return nil }
    return try? JSONDecoder().decode(LastLocation.self, from: data)
  }

  /** Removes the key and the last position (sign-out, or turning the feature off). */
  public static func clear() {
    delete(account: credentialsAccount)
    delete(account: locationAccount)
  }

  // ── Keychain ─────────────────────────────────────────────────────────────

  private static func baseQuery(account: String) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }

  private static func write(_ data: Data, account: String) -> Bool {
    delete(account: account)
    var query = baseQuery(account: account)
    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
  }

  private static func read(account: String) -> Data? {
    var query = baseQuery(account: account)
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
    return result as? Data
  }

  private static func delete(account: String) {
    SecItemDelete(baseQuery(account: account) as CFDictionary)
  }
}
