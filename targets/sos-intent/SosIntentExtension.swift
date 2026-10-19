import AppIntents

/// The extension's entry point. An App Intents extension is an ExtensionKit
/// extension, and iOS refuses to install one without an `@main` type — the
/// intents and Siri phrases themselves are in SendSOSIntent.swift.
@main
struct SosIntentExtension: AppIntentsExtension {}
