//
//  FirebaseConfig.swift
//  SwapDog
//
//  Bootstraps Firebase services at app launch.
//  Call FirebaseConfig.configure() from SwapDogApp.init() once
//  GoogleService-Info.plist is added to the project.
//

import Foundation
import FirebaseCore

// MARK: - FirebaseConfig

/// Centralises Firebase initialisation so SwapDogApp stays clean.
///
/// Usage:
/// ```swift
/// struct SwapDogApp: App {
///     init() { FirebaseConfig.configure() }
/// }
/// ```
enum FirebaseConfig {

    // MARK: - Configure

    /// Initialises all Firebase services.
    ///
    /// Must be called once before any Firebase API is used.
    /// Safe to call multiple times — Firebase ignores subsequent calls.
    static func configure() {
        FirebaseApp.configure()
    }
}
