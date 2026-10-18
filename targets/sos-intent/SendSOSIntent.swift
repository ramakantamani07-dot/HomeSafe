import AppIntents
import CoreLocation
import Foundation

/**
 "Siri, WayLoc help me" — and the same action on the Action Button, Back Tap
 and in Shortcuts (docs/features/hands-free-sos.md).

 Runs in this extension, on a locked phone, without opening WayLoc: opening
 the app from a locked phone needs Face ID, which is the wrong thing to ask
 of someone in danger. So it sends the SOS itself, to `deviceSos`, with the
 phone's SOS key — the server then writes the same SOS record the app writes
 and the usual alerts go out. One trigger is one SOS: a retry reuses its
 request id.

 What it says back is only what is true: "sent" once the server has the SOS,
 never "your contacts were told" (that happens after, on the server).
 */
struct SendSOSIntent: AppIntent {
  static var title: LocalizedStringResource = "Send SOS"
  static var description = IntentDescription(
    "Alerts your WayLoc trusted contacts with your location, without unlocking your phone."
  )
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let credentials = SosVault.loadCredentials() else {
      return .result(dialog: "Hands-free SOS isn't set up on this phone. Open WayLoc, then Settings, then Hands-free SOS. If you're in danger, call \(EmergencyNumber.local) now.")
    }
    guard let endpoint = URL(string: credentials.endpoint), !credentials.endpoint.isEmpty else {
      return .result(dialog: "This is a development build of WayLoc with no server, so nothing was sent. If you're in danger, call \(EmergencyNumber.local) now.")
    }

    let fix = await OneShotLocation.current(timeout: 4) ?? SosVault.loadLastLocation()
    let outcome = await DeviceSosClient.send(
      endpoint: endpoint,
      credentials: credentials,
      location: fix,
      test: credentials.isTest
    )

    switch outcome {
    case .sent, .duplicate:
      return .result(dialog: "SOS sent. WayLoc is alerting your trusted contacts.")
    case .testOK(let hasContacts):
      return .result(dialog: hasContacts
        ? "Test only. Hands-free SOS works, and nobody was alerted."
        : "Test only. Hands-free SOS works, but you have no trusted contacts yet. Add them in WayLoc.")
    case .rateLimited:
      return .result(dialog: "An SOS was just sent. If you're in danger, call \(EmergencyNumber.local) now.")
    case .unauthorised:
      return .result(dialog: "Hands-free SOS needs setting up again in WayLoc. If you're in danger, call \(EmergencyNumber.local) now.")
    case .failed:
      return .result(dialog: "WayLoc couldn't reach its server. Call \(EmergencyNumber.local) now if you're in danger.")
    }
  }
}

/** The phrases Siri listens for. Apple requires each to contain the app's name. */
struct WayLocShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: SendSOSIntent(),
      phrases: [
        "\(.applicationName) help me",
        "Help me with \(.applicationName)",
        "\(.applicationName) SOS",
        "Send \(.applicationName) SOS",
      ],
      shortTitle: "Send SOS",
      systemImageName: "sos"
    )
  }
}

// ── Sending ──────────────────────────────────────────────────────────────────

enum DeviceSosOutcome {
  case sent, duplicate, testOK(hasContacts: Bool), rateLimited, unauthorised, failed
}

enum DeviceSosClient {
  static func send(
    endpoint: URL,
    credentials: SosVault.Credentials,
    location: SosVault.LastLocation?,
    test: Bool
  ) async -> DeviceSosOutcome {
    var body: [String: Any] = [
      "keyId": credentials.keyId,
      "key": credentials.key,
      "requestId": UUID().uuidString,
      "test": test,
    ]
    if let location {
      body["location"] = [
        "latitude": location.latitude,
        "longitude": location.longitude,
        "observedAt": location.observedAt,
      ]
    }
    guard let payload = try? JSONSerialization.data(withJSONObject: body) else { return .failed }

    var request = URLRequest(url: endpoint, timeoutInterval: 10)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = payload

    // One retry with the same request id: the server turns a repeat into a
    // "duplicate", never a second SOS.
    for attempt in 0..<2 {
      if let outcome = await attemptSend(request) { return outcome }
      if attempt == 0 { try? await Task.sleep(nanoseconds: 1_000_000_000) }
    }
    return .failed
  }

  /** nil means "network trouble, worth one retry". */
  private static func attemptSend(_ request: URLRequest) async -> DeviceSosOutcome? {
    guard let (data, response) = try? await URLSession.shared.data(for: request),
          let http = response as? HTTPURLResponse else { return nil }
    let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    switch (http.statusCode, json?["status"] as? String) {
    case (201, _), (_, "sent"): return .sent
    case (_, "duplicate"): return .duplicate
    case (_, "test-ok"): return .testOK(hasContacts: json?["hasContacts"] as? Bool ?? false)
    case (429, _): return .rateLimited
    case (401, _): return .unauthorised
    case (500..<600, _): return nil
    default: return .failed
    }
  }
}

// ── Location ─────────────────────────────────────────────────────────────────

/**
 One quick fix if the phone will give one in a few seconds; otherwise nil and
 the caller falls back to the last position the app saved. Never waits long:
 sending the SOS matters more than a better fix.
 */
final class OneShotLocation: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var continuation: CheckedContinuation<SosVault.LastLocation?, Never>?

  static func current(timeout: TimeInterval) async -> SosVault.LastLocation? {
    let finder = OneShotLocation()
    return await finder.find(timeout: timeout)
  }

  private func find(timeout: TimeInterval) async -> SosVault.LastLocation? {
    let status = manager.authorizationStatus
    guard status == .authorizedAlways || status == .authorizedWhenInUse else { return nil }
    return await withCheckedContinuation { continuation in
      self.continuation = continuation
      DispatchQueue.main.async {
        self.manager.delegate = self
        self.manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        self.manager.requestLocation()
      }
      DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { self.finish(nil) }
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let last = locations.last else { return finish(nil) }
    finish(.init(
      latitude: last.coordinate.latitude,
      longitude: last.coordinate.longitude,
      observedAt: ISO8601DateFormatter().string(from: last.timestamp)
    ))
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    finish(nil)
  }

  private func finish(_ value: SosVault.LastLocation?) {
    guard let continuation else { return }
    self.continuation = nil
    manager.delegate = nil
    continuation.resume(returning: value)
  }
}

// ── Emergency number ─────────────────────────────────────────────────────────

/**
 What Siri tells someone to call. Mirrors `localEmergencyNumber()` in
 src/config/markets.ts: the device region's number where it differs from the
 GSM standard, 112 otherwise.
 */
enum EmergencyNumber {
  static var local: String {
    let region: String?
    if #available(iOS 16.0, *) {
      region = Locale.current.region?.identifier
    } else {
      region = Locale.current.regionCode
    }
    switch region?.uppercased() {
    case "GB": return "999"
    case "US", "CA": return "911"
    case "AU": return "000"
    case "NZ": return "111"
    default: return "112"
    }
  }
}
