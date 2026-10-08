import ExpoModulesCore
import MapKit

/**
 Point-of-interest search backed by MapKit's `MKLocalSearch`.

 Exists because the alternative was Google Places, which needs a billed API key.
 MapKit gives the same search for free on any iOS device, with no account and no
 per-request cost.

 **What this deliberately does not return: opening hours.** `MKMapItem` exposes
 `name`, `location`, `address`, `phoneNumber`, `url`, `timeZone` and
 `pointOfInterestCategory` — and nothing else. Apple publishes no opening hours
 at any iOS version. The JS side therefore restricts itself to categories that
 are inherently staffed around the clock and never renders an "open now" badge,
 because wayLoc does not claim what it cannot know. See decision D4 in
 docs/plan/IMPLEMENTATION_PHASES.md.
 */
public class NearbyPlacesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NearbyPlaces")

    /**
     Searches for places in `categories` near a coordinate.

     `categories` are raw `MKPointOfInterestCategory` values ("MKPOICategoryPolice"
     and so on), passed from JS so the policy about which categories are
     trustworthy lives in one place — the TypeScript layer — rather than being
     duplicated here in Swift where tests cannot reach it.
     */
    AsyncFunction("search") {
      (
        categories: [String],
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        limit: Int
      ) -> [[String: Any?]] in
      try await Self.search(
        categories: categories,
        latitude: latitude,
        longitude: longitude,
        radiusMeters: radiusMeters,
        limit: limit
      )
    }
  }

  private static func search(
    categories: [String],
    latitude: Double,
    longitude: Double,
    radiusMeters: Double,
    limit: Int
  ) async throws -> [[String: Any?]] {
    let centre = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    let region = MKCoordinateRegion(
      center: centre,
      latitudinalMeters: radiusMeters * 2,
      longitudinalMeters: radiusMeters * 2
    )

    let request = MKLocalSearch.Request()
    request.region = region
    // A category filter rather than a text query: searching for the word
    // "police" would also match a pub called The Policeman.
    request.pointOfInterestFilter = MKPointOfInterestFilter(
      including: categories.map { MKPointOfInterestCategory(rawValue: $0) }
    )
    // naturalLanguageQuery is required even with a filter; a space is the
    // narrowest query that lets the filter do the selecting.
    request.naturalLanguageQuery = " "

    let response: MKLocalSearch.Response
    do {
      response = try await MKLocalSearch(request: request).start()
    } catch {
      // "No results" arrives as an error from MKLocalSearch, and is
      // indistinguishable from a transient failure. An empty list renders the
      // screen's existing empty state, which is the truthful outcome either way
      // — and far better than an error dialog in front of someone uneasy.
      return []
    }

    let origin = CLLocation(latitude: latitude, longitude: longitude)

    return response.mapItems
      .compactMap { item -> (item: MKMapItem, distance: CLLocationDistance)? in
        guard let coordinate = Self.coordinate(of: item) else { return nil }
        let distance = origin.distance(
          from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        )
        // MKLocalSearch treats the region as a hint, not a bound, so results
        // beyond the requested radius do come back. "Nearest" has to mean it.
        guard distance <= radiusMeters else { return nil }
        return (item, distance)
      }
      .sorted { $0.distance < $1.distance }
      .prefix(limit)
      .map { entry in
        let coordinate = Self.coordinate(of: entry.item)
        return [
          "name": entry.item.name,
          "latitude": coordinate?.latitude,
          "longitude": coordinate?.longitude,
          "category": entry.item.pointOfInterestCategory?.rawValue,
          "phoneNumber": entry.item.phoneNumber,
          "distanceMeters": entry.distance,
        ]
      }
  }

  /// `MKMapItem.placemark` is deprecated from iOS 26 in favour of `location`.
  private static func coordinate(of item: MKMapItem) -> CLLocationCoordinate2D? {
    if #available(iOS 26.0, *) {
      return item.location.coordinate
    }
    return item.placemark.location?.coordinate
  }
}
