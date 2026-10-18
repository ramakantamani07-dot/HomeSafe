import ExpoModulesCore
import MapKit

/**
 Place and address search from MapKit — free, no key, no account.

 Before this, search on iOS used the system geocoder: it resolves addresses and
 postcodes but knows no place names ("King's College Hospital") and makes no
 suggestions while you type. Google Places would add both, for a billed key.
 MapKit does both for free:

 - `complete` — `MKLocalSearchCompleter`, suggestions as the person types,
   places and addresses together, biased towards where they are;
 - `resolve` — `MKLocalSearch` for the suggestion they picked, giving its
   coordinates and address.

 Only strings and numbers cross to JS; which suggestion becomes which `Place`
 is decided in TypeScript (`MapKitPlacesProvider`), where it is tested.
 */
public class PlaceSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PlaceSearch")

    AsyncFunction("complete") {
      (query: String, nearLatitude: Double?, nearLongitude: Double?) async throws -> [[String: String]] in
      try await withCheckedThrowingContinuation { continuation in
        // MKLocalSearchCompleter reports to its delegate on the main thread.
        DispatchQueue.main.async {
          CompletionRequest(continuation: continuation).start(
            query: query,
            region: Self.region(nearLatitude, nearLongitude)
          )
        }
      }
    }

    AsyncFunction("resolve") {
      (title: String, subtitle: String, nearLatitude: Double?, nearLongitude: Double?) async throws -> [String: Any?] in
      try await Self.resolve(
        title: title,
        subtitle: subtitle,
        region: Self.region(nearLatitude, nearLongitude)
      )
    }
  }

  /// About 20 km around the person: a bias, not a fence.
  static func region(_ latitude: Double?, _ longitude: Double?) -> MKCoordinateRegion? {
    guard let latitude, let longitude else { return nil }
    return MKCoordinateRegion(
      center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
      latitudinalMeters: 20_000,
      longitudinalMeters: 20_000
    )
  }

  private static func resolve(
    title: String,
    subtitle: String,
    region: MKCoordinateRegion?
  ) async throws -> [String: Any?] {
    let request = MKLocalSearch.Request()
    request.naturalLanguageQuery = subtitle.isEmpty ? title : "\(title), \(subtitle)"
    request.resultTypes = [.address, .pointOfInterest]
    if let region { request.region = region }

    let response = try await MKLocalSearch(request: request).start()
    guard let item = response.mapItems.first else {
      throw NSError(
        domain: "PlaceSearch",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "MapKit could not find that place."]
      )
    }
    // `placemark` is deprecated from iOS 26 but still answers; its address
    // parts are what a UK or Indian address is made of.
    let placemark = item.placemark
    let street = [placemark.subThoroughfare, placemark.thoroughfare]
      .compactMap { $0 }
      .joined(separator: " ")
    let parts = [street, placemark.locality, placemark.postalCode]
      .compactMap { $0 }
      .filter { !$0.isEmpty }
    return [
      "name": item.name ?? title,
      "latitude": placemark.coordinate.latitude,
      "longitude": placemark.coordinate.longitude,
      "formattedAddress": parts.isEmpty ? subtitle : parts.joined(separator: ", "),
      "postcode": placemark.postalCode,
    ]
  }
}

/**
 One run of `MKLocalSearchCompleter`, turned into one answer.

 The completer is delegate-based and may report several times as results
 refine; the first report is the answer, and later ones are ignored. It keeps
 itself alive until it has answered, and gives up with no suggestions after
 a few seconds rather than leaving the search box waiting.
 */
private final class CompletionRequest: NSObject, MKLocalSearchCompleterDelegate {
  private let completer = MKLocalSearchCompleter()
  private var continuation: CheckedContinuation<[[String: String]], Error>?
  private var keepAlive: CompletionRequest?

  init(continuation: CheckedContinuation<[[String: String]], Error>) {
    self.continuation = continuation
  }

  func start(query: String, region: MKCoordinateRegion?) {
    keepAlive = self
    completer.delegate = self
    completer.resultTypes = [.address, .pointOfInterest]
    if let region { completer.region = region }
    completer.queryFragment = query
    DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
      self?.finish(.success([]))
    }
  }

  func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    finish(.success(completer.results.map { ["title": $0.title, "subtitle": $0.subtitle] }))
  }

  func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    // "No results" also arrives here; an empty list is the truthful answer.
    finish(.success([]))
  }

  private func finish(_ result: Result<[[String: String]], Error>) {
    guard let continuation else { return }
    self.continuation = nil
    completer.delegate = nil
    completer.cancel()
    continuation.resume(with: result)
    keepAlive = nil
  }
}
