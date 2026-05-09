//
//  MockAnalyticsService.swift
//  SwapDog
//
//  Test double for AnalyticsServiceProtocol.
//  Records tracked events for assertion in unit tests.
//
//  Step 15: App Store prep — analytics mock.
//
//  Architecture: Tests/Mocks — never included in production build.
//

import Foundation

// MARK: - MockAnalyticsService

/// Spy implementation of `AnalyticsServiceProtocol` for unit tests.
///
/// Accumulates all tracked events so tests can assert:
/// - Which events were fired
/// - In what order
/// - How many times
///
/// Usage:
/// ```swift
/// let analytics = MockAnalyticsService()
/// let vm = AuthViewModel(authRepository: mock, coordinator: coordinator, analytics: analytics)
/// await vm.signUp()
/// XCTAssertEqual(analytics.trackedEvents.count, 1)
/// XCTAssertTrue(analytics.didTrack(.userSignedUp))
/// ```
final class MockAnalyticsService: AnalyticsServiceProtocol, @unchecked Sendable {

    // MARK: - Recorded State

    /// All events tracked since initialisation (or last `reset()`).
    private(set) var trackedEvents: [AnalyticsEvent] = []

    // MARK: - AnalyticsServiceProtocol

    func track(_ event: AnalyticsEvent) {
        trackedEvents.append(event)
    }

    // MARK: - Test Helpers

    /// Returns `true` if an event with the given name was tracked at least once.
    /// - Parameter eventName: The `AnalyticsEvent.name` value to look for.
    func didTrackEvent(named eventName: String) -> Bool {
        trackedEvents.contains { $0.name == eventName }
    }

    /// Returns the count of events with the given name.
    /// - Parameter eventName: The `AnalyticsEvent.name` value to count.
    func count(of eventName: String) -> Int {
        trackedEvents.filter { $0.name == eventName }.count
    }

    /// Clears all tracked events. Call in `setUp()` between test cases.
    func reset() {
        trackedEvents.removeAll()
    }
}
