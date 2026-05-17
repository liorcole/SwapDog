//
//  RateLimitService.swift
//  SwapDog
//
//  Client-side rate limiting for abuse-prone user actions.
//  Persists action timestamps in UserDefaults so limits survive app restarts.
//
//  Step 15: App Store prep — rate limiting with user-friendly messages.
//
//  Architecture: Core/Services
//  Locked decisions:
//    - Swap requests: max 10 per rolling 24-hour window
//    - Messages:      max 100 per rolling 1-hour window
//    - No PII stored in UserDefaults — action type + ISO8601 timestamps only
//    - Sendable conformance for cross-actor injection
//

import Foundation
import os

// MARK: - RateLimitAction

/// Enumeration of user actions subject to client-side rate limiting.
enum RateLimitAction: String {

    /// Sending a swap request. Limit: 10 per 24-hour rolling window.
    case swapRequest = "swap_request"

    /// Sending a chat message. Limit: 100 per 1-hour rolling window.
    case message     = "message"
}

// MARK: - RateLimitAction + Policy

extension RateLimitAction {

    /// Maximum number of times this action may be performed within `windowDuration`.
    var maxCount: Int {
        switch self {
        case .swapRequest: return 10
        case .message:     return 100
        }
    }

    /// Rolling window duration for this action type.
    var windowDuration: TimeInterval {
        switch self {
        case .swapRequest: return 24 * 60 * 60  // 24 hours
        case .message:     return       60 * 60  //  1 hour
        }
    }

    /// User-friendly message shown when the limit is exceeded.
    var limitExceededMessage: String {
        switch self {
        case .swapRequest:
            return "You've reached the daily limit of 10 swap requests. Try again tomorrow!"
        case .message:
            return "You've sent 100 messages in the last hour. Please wait a moment before sending more."
        }
    }

    /// UserDefaults key under which timestamps are stored.
    fileprivate var storageKey: String {
        "\(AppConstants.bundleID).rateLimit.\(rawValue)"
    }
}

// MARK: - RateLimitServiceProtocol

/// Contract for client-side rate limiting of user actions.
///
/// Conforming types must be `Sendable` for safe `@MainActor` ViewModel use.
protocol RateLimitServiceProtocol: AnyObject, Sendable {

    /// Returns `true` if the action may be performed (limit not yet reached).
    ///
    /// - Parameter action: The action to evaluate.
    /// - Returns: `true` when the count within the rolling window is below the limit.
    func canPerformAction(_ action: RateLimitAction) -> Bool

    /// Persists a timestamp for the action (call after a successful action).
    ///
    /// - Parameter action: The action that was performed.
    func recordAction(_ action: RateLimitAction)

    /// Human-readable message for when `canPerformAction` returns `false`.
    ///
    /// - Parameter action: The blocked action.
    func limitExceededMessage(for action: RateLimitAction) -> String
}

// MARK: - RateLimitService

/// Production implementation backed by `UserDefaults`.
///
/// Stores an array of ISO8601-formatted timestamp strings per action key.
/// On each check, stale timestamps (outside the rolling window) are pruned
/// before counting, ensuring the window is always a true rolling duration.
final class RateLimitService: RateLimitServiceProtocol, @unchecked Sendable {

    // MARK: - Dependencies

    private let defaults: UserDefaults
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? AppConstants.bundleID,
        category: "RateLimitService"
    )

    // MARK: - Init

    /// - Parameter defaults: UserDefaults instance (injectable for testing).
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // MARK: - RateLimitServiceProtocol

    func canPerformAction(_ action: RateLimitAction) -> Bool {
        let count = activeTimestamps(for: action).count
        let allowed = count < action.maxCount
        logger.debug(
            "canPerformAction \(action.rawValue): \(count)/\(action.maxCount) → \(allowed ? "allowed" : "blocked")"
        )
        return allowed
    }

    func recordAction(_ action: RateLimitAction) {
        var timestamps = activeTimestamps(for: action)
        timestamps.append(Date())
        let encoded = timestamps.map { ISO8601DateFormatter().string(from: $0) }
        defaults.set(encoded, forKey: action.storageKey)
        logger.info(
            "Recorded \(action.rawValue) — window count now \(timestamps.count)/\(action.maxCount)"
        )
    }

    func limitExceededMessage(for action: RateLimitAction) -> String {
        action.limitExceededMessage
    }

    // MARK: - Private Helpers

    /// Returns only timestamps that fall within the current rolling window,
    /// pruning expired entries from UserDefaults as a side effect.
    private func activeTimestamps(for action: RateLimitAction) -> [Date] {
        let formatter = ISO8601DateFormatter()
        let stored = defaults.stringArray(forKey: action.storageKey) ?? []
        let cutoff  = Date().addingTimeInterval(-action.windowDuration)

        let active = stored
            .compactMap { formatter.date(from: $0) }
            .filter { $0 > cutoff }

        // Prune expired entries to keep UserDefaults tidy.
        if active.count != stored.count {
            let pruned = active.map { formatter.string(from: $0) }
            defaults.set(pruned, forKey: action.storageKey)
        }

        return active
    }
}
