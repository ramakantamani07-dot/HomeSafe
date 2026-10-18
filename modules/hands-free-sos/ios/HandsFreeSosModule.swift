import ExpoModulesCore

/**
 The app's side of hands-free SOS: stores the SOS key and the last known
 position where the Siri extension can read them (`SosVault`). The extension
 sends the SOS itself — see targets/sos-intent/SendSOSIntent.swift.
 */
public class HandsFreeSosModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HandsFreeSos")

    Function("saveCredentials") { (keyId: String, key: String, endpoint: String) -> Bool in
      SosVault.saveCredentials(.init(keyId: keyId, key: key, endpoint: endpoint, testUntil: nil))
    }

    /// The stored key's id, or nil — never the key itself.
    Function("credentialsKeyId") { () -> String? in
      SosVault.loadCredentials()?.keyId
    }

    /// Makes Siri triggers tests (nobody alerted) until `untilEpochMs`, or ends test mode with nil.
    Function("setTestUntil") { (untilEpochMs: Double?) -> Bool in
      guard var credentials = SosVault.loadCredentials() else { return false }
      credentials.testUntil = untilEpochMs
      return SosVault.saveCredentials(credentials)
    }

    Function("saveLastLocation") { (latitude: Double, longitude: Double, observedAt: String) -> Bool in
      SosVault.saveLastLocation(.init(latitude: latitude, longitude: longitude, observedAt: observedAt))
    }

    Function("clear") {
      SosVault.clear()
    }
  }
}
