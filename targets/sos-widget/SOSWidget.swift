import SwiftUI
import WidgetKit

// Deep link into the main app's headless action route
// (app/(app)/sos-trigger.tsx), which calls the app's existing triggerSOS().
// Deliberately not a headless native Firestore write from the widget
// extension — see the implementation plan for why: it would duplicate the
// SOS write shape (and its offline-queue fallback) in Swift forever.
private let sosDeepLink = URL(string: "wayloc:///sos-trigger")!

struct SOSEntry: TimelineEntry {
    let date: Date
}

struct SOSTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> SOSEntry {
        SOSEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SOSEntry) -> Void) {
        completion(SOSEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SOSEntry>) -> Void) {
        // Static content that never needs refreshing — a single entry with
        // .never is correct here, not an oversight.
        let timeline = Timeline(entries: [SOSEntry(date: Date())], policy: .never)
        completion(timeline)
    }
}

/// .containerBackground is required on iOS 17+ for systemSmall/medium/large
/// widgets (the old .background() modifier logs a runtime warning there),
/// but isn't available pre-17. Accessory (Lock Screen) families don't need
/// this — the system supplies their background material automatically.
private struct HomeScreenBackground: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(Color.red, for: .widget)
        } else {
            content.background(Color.red)
        }
    }
}

struct SOSWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            Link(destination: sosDeepLink) {
                ZStack {
                    AccessoryWidgetBackground()
                    Text("SOS")
                        .font(.system(size: 14, weight: .bold))
                }
            }

        case .accessoryRectangular:
            Link(destination: sosDeepLink) {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                    Text("Send SOS")
                        .font(.system(size: 14, weight: .semibold))
                }
            }

        default:
            Link(destination: sosDeepLink) {
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 32))
                    Text("SOS")
                        .font(.system(size: 20, weight: .bold))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundColor(.white)
            }
            .modifier(HomeScreenBackground())
        }
    }
}

struct SOSWidget: Widget {
    let kind: String = "wayLocSOSWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SOSTimelineProvider()) { _ in
            SOSWidgetEntryView()
        }
        .configurationDisplayName("wayLoc SOS")
        .description("One tap to send an SOS alert to your trusted contacts.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .systemSmall,
        ])
    }
}

@main
struct SOSWidgetBundle: WidgetBundle {
    var body: some Widget {
        SOSWidget()
    }
}
