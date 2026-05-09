//
//  AppCoordinator.swift
//  SwapDog
//
//  Top-level navigation coordinator that owns root auth state, the primary
//  NavigationPath, and deep-link routing from push notification taps.
//
//  Architecture: MVVM-C
//  - AppCoordinator = root Coordinator (C layer)
//  - Views observe authState / navigationPath / selectedTab to decide rendering
//  - Never import UIKit here; SwiftUI-only
//
//  Step 12: Added deep linking support (pendingDeepLink, navigate(to:),
//           selectedTab) for push notification routing.
//

import SwiftUI
import os

/// Represents the top-level authentication and onboarding state of the app.
enum AuthState: Equatable {
    /// User is not authenticated.
    case loggedOut
    /// User has authenticated but has not completed onboarding.
    case onboarding
    /// User is fully authenticated and onboarded.
    case authenticated
}

/// Root coordinator responsible for auth-state-driven navigation and deep linking.
///
/// Inject this as an `@EnvironmentObject` so all child views can read
/// `authState`, `navigationPath`, and react to deep-link events.
@MainActor
final class AppCoordinator: ObservableObject {

    // MARK: - Published State

    /// Current authentication / onboarding state. Changes trigger a root view swap.
    @Published var authState: AuthState = .loggedOut

    /// Primary navigation stack path used by the authenticated shell.
    @Published var navigationPath = NavigationPath()

    /// The currently selected root tab. Written by `navigate(to:)` for tab-switching
    /// deep links, and read by `MainTabView` to synchronise tab selection.
    @Published var selectedTab: MainTab = .discover

    /// A pending deep link queued before the app reached `.authenticated` state.
    ///
    /// When a cold-launch notification tap arrives while auth state is still
    /// resolving, the link is stored here and consumed by `MainTabView.onAppear`.
    @Published var pendingDeepLink: DeepLink?

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? AppConstants.bundleID,
        category: "AppCoordinator"
    )

    // MARK: - Init

    init() {
        logger.info("AppCoordinator initialised — authState: loggedOut")
    }

    // MARK: - Auth Transitions

    /// Transition to a new auth state, resetting the navigation stack.
    func transition(to newState: AuthState) {
        logger.info("Auth state: \(String(describing: self.authState)) → \(String(describing: newState))")
        navigationPath = NavigationPath()
        authState = newState
    }

    // MARK: - Stack Navigation Helpers

    /// Push a Hashable route onto the primary navigation stack.
    func push<R: Hashable>(_ route: R) {
        navigationPath.append(route)
    }

    /// Pop the top route from the primary navigation stack.
    func pop() {
        guard !navigationPath.isEmpty else { return }
        navigationPath.removeLast()
    }

    /// Pop all routes back to the root of the navigation stack.
    func popToRoot() {
        navigationPath = NavigationPath()
    }

    // MARK: - Deep Link Routing

    /// Routes the app to the correct destination for a given `DeepLink`.
    ///
    /// If the app is not yet in `.authenticated` state the link is stored in
    /// `pendingDeepLink` and consumed once the main shell appears.
    ///
    /// Call this from:
    /// - `SwapDogApp` when a notification tap arrives while the app is in the foreground.
    /// - The cold-launch handler after the auth state resolves to `.authenticated`.
    ///
    /// - Parameter deepLink: The destination to navigate to.
    func navigate(to deepLink: DeepLink) {
        guard authState == .authenticated else {
            logger.info("navigate(to:) deferred — authState is \(String(describing: self.authState))")
            pendingDeepLink = deepLink
            return
        }

        logger.info("navigate(to:) — \(String(describing: deepLink))")

        switch deepLink {
        case .swapRequest(let id):
            // Switch to the Requests tab then push the detail view.
            selectedTab  = .requests
            navigationPath = NavigationPath()
            // The Requests NavigationStack picks up this push via the shared path.
            // Views observing navigationPath use a SwapRequestRoute wrapper.
            navigationPath.append(SwapRequestRoute(id: id))

        case .conversation(let id):
            // Switch to the Messages tab then push the chat view.
            selectedTab  = .messages
            navigationPath = NavigationPath()
            navigationPath.append(ConversationRoute(id: id))

        case .userProfile(let id):
            // Switch to Discover tab then push the user detail view.
            selectedTab  = .discover
            navigationPath = NavigationPath()
            navigationPath.append(UserProfileRoute(id: id))

        case .myRequests:
            selectedTab    = .requests
            navigationPath = NavigationPath()

        case .myMessages:
            selectedTab    = .messages
            navigationPath = NavigationPath()
        }
    }

    /// Consumes and navigates to `pendingDeepLink` if one is stored.
    ///
    /// Call this from `MainTabView.onAppear` to handle cold-launch links.
    func consumePendingDeepLink() {
        guard let link = pendingDeepLink else { return }
        pendingDeepLink = nil
        navigate(to: link)
    }
}

// MARK: - Route Wrappers

/// Typed wrapper carried through `NavigationPath` for swap request detail navigation.
///
/// `Hashable` conformance allows `navigationDestination(for:)` to dispatch correctly.
struct SwapRequestRoute: Hashable {
    /// The Firestore swap request document ID.
    let id: String
}

/// Typed wrapper carried through `NavigationPath` for conversation / chat navigation.
struct ConversationRoute: Hashable {
    /// The Firestore conversation document ID.
    let id: String
}

/// Typed wrapper carried through `NavigationPath` for user profile navigation.
struct UserProfileRoute: Hashable {
    /// The Firestore user document ID.
    let id: String
}
