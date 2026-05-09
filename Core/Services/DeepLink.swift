//
//  DeepLink.swift
//  SwapDog
//
//  All deep-link destinations reachable from a push notification tap.
//  Exhaustive by design — every NotificationType maps to exactly one case.
//
//  Architecture layer: Core/Services
//  Locked decision: deep link enum covers all notification types
//

import Foundation

// MARK: - DeepLink

/// Typed navigation destination produced by parsing a push notification payload.
///
/// Each case corresponds to a UI destination. `AppCoordinator.navigate(to:)` is
/// the single point of dispatch — no view should call navigation APIs directly.
///
/// ### Notification ↔ Deep-link mapping
/// | NotificationType        | DeepLink                   |
/// |-------------------------|----------------------------|
/// | `.newSwapRequest`       | `.swapRequest(id:)`        |
/// | `.swapAccepted`         | `.swapRequest(id:)`        |
/// | `.swapDeclined`         | `.swapRequest(id:)`        |
/// | `.newMessage`           | `.conversation(id:)`       |
/// | `.swapReminder`         | `.swapRequest(id:)`        |
enum DeepLink: Equatable {

    /// Navigate to the detail view for the given swap request.
    ///
    /// - Parameter id: The Firestore `swapRequest` document ID.
    case swapRequest(id: String)

    /// Navigate to the chat view for the given conversation.
    ///
    /// - Parameter id: The Firestore `conversation` document ID.
    case conversation(id: String)

    /// Navigate to the detail view for the given user.
    ///
    /// - Parameter id: The Firestore `user` document ID.
    case userProfile(id: String)

    /// Navigate to the Requests tab (shows the user's pending swap requests).
    case myRequests

    /// Navigate to the Messages tab (shows the conversations list).
    case myMessages
}
