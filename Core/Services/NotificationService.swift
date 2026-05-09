//
//  NotificationService.swift
//  SwapDog
//
//  Push notification permission request, APNs token registration,
//  and incoming notification parsing into typed DeepLink values.
//
//  Architecture layer: Core/Services
//  Locked decisions:
//    - Permission request is non-blocking (fire-and-forget Task)
//    - All FCM/APNs calls are stubbed (Firebase SDK not yet linked)
//    - Uses os.Logger for all logging — no print()
//

import Foundation
import UserNotifications
import os

// MARK: - NotificationType

/// Strongly typed notification categories sent by SwapDog Cloud Functions.
///
/// The raw `String` value must match the `type` field set in FCM payloads.
enum NotificationType: String {
    /// A new swap request has been sent to this user.
    case newSwapRequest  = "newSwapRequest"
    /// A swap request this user sent has been accepted.
    case swapAccepted    = "swapAccepted"
    /// A swap request this user sent has been declined.
    case swapDeclined    = "swapDeclined"
    /// A new chat message has arrived in one of this user's conversations.
    case newMessage      = "newMessage"
    /// A reminder that an upcoming swap is approaching.
    case swapReminder    = "swapReminder"
}

// MARK: - NotificationServiceProtocol (extended)

/// Contract for push notification permission, registration, and routing.
///
/// The protocol is intentionally focused — presentation of local alerts
/// and badge management are handled by `BadgeService`.
///
/// Conforming types must be `Sendable` and `AnyObject` so they can be
/// stored in `DependencyContainer` without data-race warnings.
protocol NotificationServiceProtocol: AnyObject, Sendable {

    /// Requests authorisation to deliver push notifications.
    ///
    /// - Returns: `true` if the user granted permission; `false` otherwise.
    /// - Note: This method suspends until the system presents the permission
    ///   dialog and the user makes a choice, but the caller is **not** expected
    ///   to block the UI. Fire-and-forget via `Task { }` at the call site.
    func requestPermission() async -> Bool

    /// Registers the device with APNs so Firebase can obtain an FCM token.
    ///
    /// Call this after `requestPermission()` returns `true`.
    /// Safe to call on every app launch — the system deduplicates tokens.
    @MainActor
    func registerForRemoteNotifications()

    /// Parses a raw notification payload into a typed `DeepLink`.
    ///
    /// - Parameter userInfo: The `[AnyHashable: Any]` dictionary delivered
    ///   by `UNUserNotificationCenterDelegate` or application(_:didReceive:).
    /// - Returns: A `DeepLink` if the payload is well-formed; `nil` otherwise.
    func handleIncomingNotification(userInfo: [AnyHashable: Any]) -> DeepLink?
}

// MARK: - FirebaseNotificationService

/// Production implementation of `NotificationServiceProtocol`.
///
/// Firebase Messaging SDK calls are commented out and marked TODO until
/// the Firebase SPM package is linked. The public API surface is identical
/// whether or not the SDK is present.
final class FirebaseNotificationService: NotificationServiceProtocol {

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? AppConstants.bundleID,
        category: "FirebaseNotificationService"
    )

    // MARK: - NotificationServiceProtocol

    /// Requests `.alert`, `.badge`, and `.sound` authorisation.
    ///
    /// Does **not** throw — any failure is logged and `false` is returned
    /// so callers stay non-blocking.
    func requestPermission() async -> Bool {
        logger.info("Requesting push notification authorisation")
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            logger.info("Push authorisation result: \(granted ? "granted" : "denied")")
            return granted
        } catch {
            logger.error("Push authorisation request failed: \(error.localizedDescription)")
            return false
        }
    }

    /// Calls `UIApplication.shared.registerForRemoteNotifications()`.
    ///
    /// Must run on the main actor because `UIApplication.shared` is MainActor-only.
    @MainActor
    func registerForRemoteNotifications() {
        UIApplication.shared.registerForRemoteNotifications()
        logger.info("registerForRemoteNotifications() called")
    }

    /// Parses `userInfo` → `NotificationType` → `DeepLink`.
    ///
    /// Expected payload keys:
    /// - `"type"`:    `NotificationType.rawValue`
    /// - `"id"`:     Firestore document ID (for request / conversation / user deep links)
    ///
    /// Returns `nil` for any unrecognised payload without throwing.
    func handleIncomingNotification(userInfo: [AnyHashable: Any]) -> DeepLink? {
        guard let typeString = userInfo["type"] as? String,
              let notificationType = NotificationType(rawValue: typeString) else {
            logger.warning("Received notification with unknown or missing 'type' field")
            return nil
        }

        let id = userInfo["id"] as? String

        switch notificationType {
        case .newSwapRequest:
            guard let swapID = id else {
                logger.error("newSwapRequest notification missing 'id' field")
                return .myRequests
            }
            logger.info("Deep link: swapRequest(id: \(swapID))")
            return .swapRequest(id: swapID)

        case .swapAccepted, .swapDeclined:
            guard let swapID = id else {
                logger.error("\(typeString) notification missing 'id' field")
                return .myRequests
            }
            logger.info("Deep link: swapRequest(id: \(swapID)) for \(typeString)")
            return .swapRequest(id: swapID)

        case .newMessage:
            guard let conversationID = id else {
                logger.error("newMessage notification missing 'id' field")
                return .myMessages
            }
            logger.info("Deep link: conversation(id: \(conversationID))")
            return .conversation(id: conversationID)

        case .swapReminder:
            guard let swapID = id else {
                logger.error("swapReminder notification missing 'id' field")
                return .myRequests
            }
            logger.info("Deep link: swapRequest(id: \(swapID)) via reminder")
            return .swapRequest(id: swapID)
        }
    }
}
