//
//  BadgeService.swift
//  SwapDog
//
//  Manages the app icon badge count derived from unread messages
//  and pending swap requests. Uses UNUserNotificationCenter.setBadgeCount()
//  (iOS 16+ API — no UIApplication.applicationIconBadgeNumber).
//
//  Architecture layer: Core/Services
//  Locked decision: badge logic combines unread messages + pending requests
//

import Foundation
import UserNotifications
import os

// MARK: - BadgeServiceProtocol

/// Contract for reading and updating the iOS app-icon badge count.
///
/// The badge represents the sum of unread messages and pending swap requests
/// so users can see outstanding activity at a glance from the Home Screen.
///
/// Conforming types must be `Sendable` so they can be injected into
/// `@MainActor` ViewModels without data-race warnings.
protocol BadgeServiceProtocol: AnyObject, Sendable {

    /// Updates the app-icon badge count.
    ///
    /// The total displayed is `unreadMessages + pendingRequests`.
    /// A total of `0` clears the badge.
    ///
    /// - Parameters:
    ///   - unreadMessages:   Number of conversations with at least one unread message.
    ///   - pendingRequests:  Number of swap requests awaiting the current user's decision.
    func updateBadgeCount(unreadMessages: Int, pendingRequests: Int) async

    /// Resets the badge count to zero.
    ///
    /// Call this when the user opens a tab that makes the corresponding
    /// notifications irrelevant (e.g. opening Messages clears the message badge).
    func clearBadge() async
}

// MARK: - BadgeService

/// Production implementation of `BadgeServiceProtocol`.
///
/// Uses `UNUserNotificationCenter.current().setBadgeCount(_:)` which is
/// the iOS 16+ replacement for the deprecated `applicationIconBadgeNumber`.
final class BadgeService: BadgeServiceProtocol {

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? AppConstants.bundleID,
        category: "BadgeService"
    )

    // MARK: - BadgeServiceProtocol

    func updateBadgeCount(unreadMessages: Int, pendingRequests: Int) async {
        let total = max(0, unreadMessages + pendingRequests)
        await setBadge(to: total)
    }

    func clearBadge() async {
        await setBadge(to: 0)
    }

    // MARK: - Private Helpers

    private func setBadge(to count: Int) async {
        do {
            try await UNUserNotificationCenter.current().setBadgeCount(count)
            logger.info("App badge updated to \(count)")
        } catch {
            // setBadgeCount can fail if notification permission was revoked.
            // This is expected and non-fatal — just log and continue.
            logger.warning("Failed to set badge count to \(count): \(error.localizedDescription)")
        }
    }
}

// MARK: - BadgeService+TabClearing

extension BadgeService {

    /// Clears the badge contribution from the Messages tab.
    ///
    /// Call from `MainTabShell` when the user switches to `.messages`.
    /// The requests contribution is preserved — only call `clearBadge()`
    /// if you want to zero the entire count.
    ///
    /// - Parameter pendingRequests: The current pending request count to preserve.
    func clearMessagesBadge(pendingRequests: Int) async {
        await updateBadgeCount(unreadMessages: 0, pendingRequests: pendingRequests)
    }

    /// Clears the badge contribution from the Requests tab.
    ///
    /// Call from `MainTabShell` when the user switches to `.requests`.
    ///
    /// - Parameter unreadMessages: The current unread message count to preserve.
    func clearRequestsBadge(unreadMessages: Int) async {
        await updateBadgeCount(unreadMessages: unreadMessages, pendingRequests: 0)
    }
}
