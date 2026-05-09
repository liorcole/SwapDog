//
//  DependencyContainer.swift
//  SwapDog
//
//  Protocol-based dependency injection container.
//
//  Rules (enforced by architecture):
//  - DependencyContainer is created ONCE at app launch (in SwapDogApp)
//  - It is injected into the view hierarchy via @EnvironmentObject
//  - NO static properties, NO shared/singleton pattern
//  - All repository properties are typed as protocols so tests can substitute
//    mocks without changing call sites
//
//  Adding a new dependency:
//  1. Define its protocol in Core/Repositories/ or Core/Services/
//  2. Add a property here typed as the protocol
//  3. Wire up the concrete implementation in the production init()
//  4. In tests: DependencyContainer(authRepository: MockAuthRepository(), ...)
//
//  Step 12: Replaced StubNotificationService with FirebaseNotificationService.
//           Added BadgeServiceProtocol + BadgeService.
//  Step 15: Added AnalyticsServiceProtocol + ConsoleAnalyticsService.
//           Added RateLimitServiceProtocol + RateLimitService.
//

import Foundation
import os

// MARK: - Service Protocols

/// Contract for image upload/download via remote storage.
protocol StorageServiceProtocol: AnyObject, Sendable {}

// MARK: - Service Stubs

// Replaced with real implementations in later steps.
final class StubStorageService: StorageServiceProtocol {}

// MARK: - DependencyContainer

/// Holds all live dependencies for the SwapDog app.
///
/// Inject via `.environmentObject(container)` at the root scene and
/// retrieve in any child view with `@EnvironmentObject var container: DependencyContainer`.
///
/// Production code uses Firebase-backed repositories by default.
/// Test and preview code passes Mock* implementations via the designated initialiser.
@MainActor
final class DependencyContainer: ObservableObject {

    // MARK: - Repositories

    /// Handles Firebase Authentication: sign up, sign in, sign out, auth state.
    let authRepository: any AuthRepositoryProtocol

    /// Handles Firestore user document CRUD and profile image uploads.
    let userRepository: any UserRepositoryProtocol

    /// Handles Firestore dog profile CRUD and dog photo uploads.
    let dogRepository: any DogRepositoryProtocol

    /// Handles swap request creation, status transitions, and history queries.
    let swapRepository: any SwapRepositoryProtocol

    /// Handles real-time Firestore messaging (messages and conversations streams).
    let messagingRepository: any MessagingRepositoryProtocol

    /// Handles post-swap review creation and retrieval.
    let reviewRepository: any ReviewRepositoryProtocol

    // MARK: - Services

    /// Resolves the device's GPS coordinates and performs reverse geocoding.
    let locationService: any LocationServiceProtocol

    /// Manages APNs / FCM push notification permission, token registration, and payload parsing.
    let notificationService: any NotificationServiceProtocol

    /// Manages Firebase Storage uploads and download URL resolution.
    let storageService: any StorageServiceProtocol

    /// Manages app-icon badge counts derived from unread messages and pending requests.
    let badgeService: any BadgeServiceProtocol

    /// Tracks user behaviour events for analytics and funnel analysis.
    let analyticsService: any AnalyticsServiceProtocol

    /// Enforces client-side rate limits on swap requests and messages.
    let rateLimitService: any RateLimitServiceProtocol

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? AppConstants.bundleID,
        category: "DependencyContainer"
    )

    // MARK: - Initialisers

    /// Production initialiser — uses Firebase-backed repositories by default.
    ///
    /// Every parameter has a default value so call sites that don't need mocks
    /// just write `DependencyContainer()`.
    ///
    /// - Parameters:
    ///   - authRepository:      Defaults to `FirebaseAuthRepository`.
    ///   - userRepository:      Defaults to `FirestoreUserRepository`.
    ///   - dogRepository:       Defaults to `FirestoreDogRepository`.
    ///   - swapRepository:      Defaults to `FirestoreSwapRepository`.
    ///   - messagingRepository: Defaults to `FirestoreMessagingRepository`.
    ///   - reviewRepository:    Defaults to `FirestoreReviewRepository`.
    ///   - locationService:     Defaults to `LocationService`.
    ///   - notificationService: Defaults to `FirebaseNotificationService`.
    ///   - storageService:      Defaults to `StubStorageService`.
    ///   - badgeService:        Defaults to `BadgeService`.
    ///   - analyticsService:    Defaults to `ConsoleAnalyticsService`.
    ///   - rateLimitService:    Defaults to `RateLimitService`.
    init(
        authRepository:      any AuthRepositoryProtocol      = FirebaseAuthRepository(),
        userRepository:      any UserRepositoryProtocol      = FirestoreUserRepository(),
        dogRepository:       any DogRepositoryProtocol       = FirestoreDogRepository(),
        swapRepository:      any SwapRepositoryProtocol      = FirestoreSwapRepository(),
        messagingRepository: any MessagingRepositoryProtocol = FirestoreMessagingRepository(),
        reviewRepository:    any ReviewRepositoryProtocol    = FirestoreReviewRepository(),
        locationService:     any LocationServiceProtocol     = LocationService(),
        notificationService: any NotificationServiceProtocol = FirebaseNotificationService(),
        storageService:      any StorageServiceProtocol      = StubStorageService(),
        badgeService:        any BadgeServiceProtocol        = BadgeService(),
        analyticsService:    any AnalyticsServiceProtocol    = ConsoleAnalyticsService(),
        rateLimitService:    any RateLimitServiceProtocol    = RateLimitService()
    ) {
        self.authRepository      = authRepository
        self.userRepository      = userRepository
        self.dogRepository       = dogRepository
        self.swapRepository      = swapRepository
        self.messagingRepository = messagingRepository
        self.reviewRepository    = reviewRepository
        self.locationService     = locationService
        self.notificationService = notificationService
        self.storageService      = storageService
        self.badgeService        = badgeService
        self.analyticsService    = analyticsService
        self.rateLimitService    = rateLimitService

        logger.info("DependencyContainer initialised with 12 dependencies (6 repos + 6 services)")
    }

    // MARK: - Preview / Test Convenience

    /// Returns a container pre-loaded with all mock repositories and services.
    ///
    /// Use this in SwiftUI previews and XCTest setUp methods:
    /// ```swift
    /// let container = DependencyContainer.preview
    /// ```
    static var preview: DependencyContainer {
        DependencyContainer(
            authRepository:      MockAuthRepository(),
            userRepository:      MockUserRepository(),
            dogRepository:       MockDogRepository(),
            swapRepository:      MockSwapRepository(),
            messagingRepository: MockMessagingRepository(),
            reviewRepository:    MockReviewRepository(),
            locationService:     MockLocationService(),
            notificationService: MockNotificationService(),
            analyticsService:    MockAnalyticsService(),
            rateLimitService:    MockRateLimitService()
        )
    }
}
