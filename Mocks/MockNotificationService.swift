//
//  MockNotificationService.swift
//  SwapDog
//
//  In-memory mock of NotificationServiceProtocol for unit tests and previews.
//  Conforms to both the original stub protocol shape and the full Step 12
//  protocol that adds requestPermission, registerForRemoteNotifications,
//  and handleIncomingNotification.
//
//  Architecture layer: Tests/Mocks
//

import Foundation

// MARK: - MockNotificationService

/// In-memory mock conforming to `NotificationServiceProtocol`.
///
/// Use in unit tests to verify:
/// - whether permission was requested
/// - how many times token registration was triggered
/// - which `DeepLink` values were produced from notification payloads
///
/// ```swift
/// let mock = MockNotificationService()
/// mock.stubbedPermissionGranted = true
/// let granted = await mock.requestPermission()
/// XCTAssertTrue(mock.permissionRequested)
/// ```
final class MockNotificationService: NotificationServiceProtocol {

    // MARK: - Stubbed Responses

    /// Return value for `requestPermission()`. Defaults to `true`.
    var stubbedPermissionGranted: Bool = true

    /// `DeepLink` to return from `handleIncomingNotification(userInfo:)`.
    /// When `nil`, the method returns `nil` (simulating an unrecognised payload).
    var stubbedDeepLink: DeepLink?

    // MARK: - Recorded Calls

    /// Incremented each time `requestPermission()` is called.
    private(set) var permissionRequestCallCount: Int = 0

    /// `true` if `requestPermission()` has been called at least once.
    var permissionRequested: Bool { permissionRequestCallCount > 0 }

    /// Incremented each time `registerForRemoteNotifications()` is called.
    private(set) var registrationCallCount: Int = 0

    /// `true` if `registerForRemoteNotifications()` has been called at least once.
    var registrationRequested: Bool { registrationCallCount > 0 }

    /// All `userInfo` dictionaries passed to `handleIncomingNotification(userInfo:)`.
    private(set) var handledNotifications: [[AnyHashable: Any]] = []

    /// Number of times `handleIncomingNotification(userInfo:)` was called.
    var handledNotificationCount: Int { handledNotifications.count }

    // MARK: - NotificationServiceProtocol

    func requestPermission() async -> Bool {
        permissionRequestCallCount += 1
        // Simulate a brief async delay so tests exercise the async path.
        try? await Task.sleep(for: .milliseconds(10))
        return stubbedPermissionGranted
    }

    @MainActor
    func registerForRemoteNotifications() {
        registrationCallCount += 1
    }

    func handleIncomingNotification(userInfo: [AnyHashable: Any]) -> DeepLink? {
        handledNotifications.append(userInfo)
        return stubbedDeepLink
    }

    // MARK: - Test Helpers

    /// Resets all recorded calls. Useful in `tearDown()` between tests.
    func reset() {
        permissionRequestCallCount = 0
        registrationCallCount      = 0
        handledNotifications       = []
    }
}
