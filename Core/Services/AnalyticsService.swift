//
//  AnalyticsService.swift
//  SwapDog
//
//  Analytics abstraction layer. Protocol-based so any analytics backend
//  (Firebase Analytics, Mixpanel, Amplitude) can be swapped via DI.
//
//  Step 15: App Store prep — analytics events & ConsoleAnalyticsService.
//
//  Architecture: Core/Services
//  Locked decisions enforced:
//    - No PII in event parameters (IDs only, never email/display name)
//    - os.Logger only — no print()
//    - Sendable conformance for cross-actor injection
//

import Foundation
import os

// MARK: - AnalyticsEvent

/// Typed events tracked throughout the SwapDog user journey.
///
/// Associated values carry the minimum context needed for attribution
/// without logging PII. IDs are Firestore document IDs.
enum AnalyticsEvent {

    // MARK: Auth
    /// Fired once when a user successfully creates a new account.
    case userSignedUp

    // MARK: Onboarding
    /// Fired when the user completes profile + first dog setup.
    case userCompletedOnboarding

    // MARK: Swap lifecycle
    /// Fired when a swap request is submitted.
    case swapRequested(recipientID: String)
    /// Fired when the recipient accepts a swap request.
    case swapAccepted(requestID: String)
    /// Fired when both parties mark the swap as complete.
    case swapCompleted(requestID: String)

    // MARK: Messaging
    /// Fired each time a message is sent in a conversation.
    case messageSent(conversationID: String)

    // MARK: Discovery
    /// Fired when the current user views another user's profile.
    case profileViewed(userID: String)
    /// Fired when the current user views a dog's detail page.
    case dogProfileViewed(dogID: String)
    /// Fired when the user changes the discovery search radius.
    case searchRadiusChanged(miles: Double)
}

// MARK: - AnalyticsEvent + metadata

extension AnalyticsEvent {

    /// Snake_case event name for analytics platforms and log filtering.
    var name: String {
        switch self {
        case .userSignedUp:            return "user_signed_up"
        case .userCompletedOnboarding: return "user_completed_onboarding"
        case .swapRequested:           return "swap_requested"
        case .swapAccepted:            return "swap_accepted"
        case .swapCompleted:           return "swap_completed"
        case .messageSent:             return "message_sent"
        case .profileViewed:           return "profile_viewed"
        case .dogProfileViewed:        return "dog_profile_viewed"
        case .searchRadiusChanged:     return "search_radius_changed"
        }
    }

    /// Key-value parameters attached to the event for filtering and funnels.
    /// No email addresses, display names, or other PII.
    var parameters: [String: String] {
        switch self {
        case .userSignedUp, .userCompletedOnboarding:
            return [:]
        case .swapRequested(let recipientID):
            return ["recipient_id": recipientID]
        case .swapAccepted(let requestID):
            return ["request_id": requestID]
        case .swapCompleted(let requestID):
            return ["request_id": requestID]
        case .messageSent(let conversationID):
            return ["conversation_id": conversationID]
        case .profileViewed(let userID):
            return ["user_id": userID]
        case .dogProfileViewed(let dogID):
            return ["dog_id": dogID]
        case .searchRadiusChanged(let miles):
            return ["radius_miles": String(format: "%.1f", miles)]
        }
    }
}

// MARK: - AnalyticsServiceProtocol

/// Contract for event tracking. Conform any analytics backend to this
/// protocol and inject via `DependencyContainer`.
///
/// Conforming types must be `Sendable` for safe `@MainActor` ViewModel use.
protocol AnalyticsServiceProtocol: AnyObject, Sendable {

    /// Records a single analytics event with its associated parameters.
    /// - Parameter event: The typed event to track.
    func track(_ event: AnalyticsEvent)
}

// MARK: - ConsoleAnalyticsService

/// Development / TestFlight analytics implementation.
///
/// Logs all events via `os.Logger` — visible in Xcode Console and
/// Console.app with no network dependency. Wire up Firebase Analytics,
/// Mixpanel, or Amplitude before production App Store submission by
/// creating a conforming class and swapping it in `DependencyContainer`.
final class ConsoleAnalyticsService: AnalyticsServiceProtocol, @unchecked Sendable {

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? AppConstants.bundleID,
        category: "Analytics"
    )

    // MARK: - AnalyticsServiceProtocol

    func track(_ event: AnalyticsEvent) {
        let name = event.name
        if event.parameters.isEmpty {
            logger.info("[Analytics] \(name)")
        } else {
            let paramString = event.parameters
                .sorted { $0.key < $1.key }
                .map { "\($0.key)=\($0.value)" }
                .joined(separator: ", ")
            logger.info("[Analytics] \(name) | \(paramString)")
        }
    }
}
