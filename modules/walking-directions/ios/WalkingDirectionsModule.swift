import ExpoModulesCore
import MapKit

/**
 Walking routes from MapKit's `MKDirections`.

 Replaces the public OSRM demo server on iOS, which was asked for *driving*
 routes: car roads and car times for a walking app, from a volunteer server
 whose usage policy rules out production use. MapKit gives real walking routes
 — footpaths, parks, pedestrian crossings — for free, with no key, no account
 and no server of our own. See "Walking routes" in
 docs/plan/IMPLEMENTATION_PHASES.md.

 Returns raw MapKit values. Turning them into wayLoc's `RouteResult`, including
 which road a step is on, happens in TypeScript where it can be tested.
 */
public class WalkingDirectionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WalkingDirections")

    AsyncFunction("route") {
      (
        fromLatitude: Double,
        fromLongitude: Double,
        toLatitude: Double,
        toLongitude: Double,
        includeSteps: Bool,
        transport: String
      ) -> [String: Any] in
      try await Self.route(
        from: CLLocationCoordinate2D(latitude: fromLatitude, longitude: fromLongitude),
        to: CLLocationCoordinate2D(latitude: toLatitude, longitude: toLongitude),
        includeSteps: includeSteps,
        // Walking for walks; driving for anything on wheels (TravelModeProfile.ts).
        transportType: transport == "driving" ? .automobile : .walking
      )
    }
  }

  private static func route(
    from: CLLocationCoordinate2D,
    to: CLLocationCoordinate2D,
    includeSteps: Bool,
    transportType: MKDirectionsTransportType
  ) async throws -> [String: Any] {
    let request = MKDirections.Request()
    request.source = mapItem(at: from)
    request.destination = mapItem(at: to)
    request.transportType = transportType
    request.requestsAlternateRoutes = false

    // Errors (no route, no network) propagate to JS as a rejected promise; the
    // route screens already handle a failed lookup.
    let response = try await MKDirections(request: request).calculate()
    guard let route = response.routes.first else {
      throw NSError(
        domain: "WalkingDirections",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "MapKit found no walking route."]
      )
    }

    var result: [String: Any] = [
      "distanceMeters": route.distance,
      "durationSeconds": route.expectedTravelTime,
      "coordinates": points(of: route.polyline),
    ]

    if includeSteps {
      result["steps"] = route.steps.compactMap { step -> [String: Any]? in
        // MapKit's first step is the zero-length "start here"; it is not a leg.
        guard step.distance > 0, let start = points(of: step.polyline).first else { return nil }
        return [
          "instructions": step.instructions,
          "distanceMeters": step.distance,
          "startLatitude": start[0],
          "startLongitude": start[1],
        ]
      }
    } else {
      result["steps"] = [[String: Any]]()
    }
    return result
  }

  /// `[[latitude, longitude], …]` along a MapKit polyline.
  private static func points(of polyline: MKPolyline) -> [[Double]] {
    let count = polyline.pointCount
    guard count > 0 else { return [] }
    var coordinates = [CLLocationCoordinate2D](
      repeating: kCLLocationCoordinate2DInvalid, count: count
    )
    polyline.getCoordinates(&coordinates, range: NSRange(location: 0, length: count))
    return coordinates.map { [$0.latitude, $0.longitude] }
  }

  /// `MKPlacemark` is deprecated from iOS 26 in favour of `MKMapItem(location:address:)`.
  private static func mapItem(at coordinate: CLLocationCoordinate2D) -> MKMapItem {
    if #available(iOS 26.0, *) {
      return MKMapItem(
        location: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude),
        address: nil
      )
    }
    return MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
  }
}
