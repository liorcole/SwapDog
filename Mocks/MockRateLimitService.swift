//
//  MockRateLimitService.swift
//  SwapDog
//
//  Test double for RateLimitServiceProtocol.
//  Provides configurable allow/block behaviour without touching UserDefaults.
//
//  Step 15: App Store prep — rate limit mock.
//
//  Architecture: Tests/Mocks — never included in production build.
//

import Foundation

// MARK: - MockRateLimitService

/// Configurable stub of `RateLimitServiceProtocol` for unit tests.
///
/// Default behaviour mirrors production limits (allow until count ≥ max).
/// For testing "limit exceeded" paths, set `blockedActions` before the test:
///
/// ```swift
/// let rateLimit = MockRateLimitService()
/// rateLimit.blockedActions.insert(.swapRequest)
/// // Now canPerformAction(.swapRequest) returns false
/// ```
final class MockRateLimitService: RateLimitServiceProtocol, @unchecked Sendable {

    // MARK: - Configuration

    /// Actions that are unconditionally blocked (regardless of recorded count).
    /// Use this to test the "limit exceeded" code path.
    var blockedActions: Set<RateLimitAction> = []

    // MARK: - Recorded State

    /// All actions recorded since initialisation (or last `reset()`).
    private(set) var recordedActions: [RateLimitAction] = []

    // MARK: - RateLimitServiceProtocol

    func canPerformAction(_ action: RateLimitAction) -> Bool {
        !blockedActions.contains(action)
    }

    func recordAction(_ action: RateLimitAction) {
        recordedActions.append(action)
    }

    func limitExceededMessage(for action: RateLimitAction) -> String {
        action.limitExceededMessage
    }

    // MARK: - Test Helpers

    /// Returns the count of times `action` was recorded.
    func count(of action: RateLimitAction) -> Int {
        recordedActions.filter { $0 == action }.count
    }

    /// Clears all recorded state. Call in `setUp()` between test cases.
    func reset() {
        recordedActions.removeAll()
        blockedActions.removeAll()
    }
}
