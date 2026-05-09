//
//  MockAuthRepository.swift
//  SwapDog
//
//  In-memory mock implementation of AuthRepositoryProtocol.
//  Suitable for unit tests and SwiftUI previews.
//

import Foundation

// MARK: - MockAuthRepository

/// In-memory mock of `AuthRepositoryProtocol` for unit tests and SwiftUI previews.
///
/// Pre-populates with `.mock` data. Simulates network latency with a short
/// `Task.sleep` so async code paths are exercised in tests.
///
/// Usage in tests:
/// ```swift
/// let mock = MockAuthRepository()
/// let container = DependencyContainer(authRepository: mock)
/// ```
///
/// Usage in previews:
/// ```swift
/// DependencyContainer(authRepository: MockAuthRepository())
/// ```
final class MockAuthRepository: AuthRepositoryProtocol {

    // MARK: - Configurable State

    /// The user returned by `signUp` and `signIn`. Override to test different users.
    var stubbedUser: User = .mock

    /// When set, `signUp` / `signIn` / `deleteAccount` throw this error.
    var stubbedError: SwapDogError?

    /// Controls the value emitted by `authStateChanges()`.
    var stubbedAuthState: String? = User.mock.id

    // MARK: - Recorded Calls (test assertions)

    private(set) var signUpCallCount = 0
    private(set) var signInCallCount = 0
    private(set) var signOutCallCount = 0
    private(set) var deleteAccountCallCount = 0

    // MARK: - AuthRepositoryProtocol

    func signUp(email: String, password: String) async throws -> User {
        signUpCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        return stubbedUser
    }

    func signIn(email: String, password: String) async throws -> User {
        signInCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        return stubbedUser
    }

    func signOut() throws {
        signOutCallCount += 1
        if let error = stubbedError { throw error }
    }

    var currentUserID: String? {
        stubbedAuthState
    }

    func authStateChanges() -> AsyncStream<String?> {
        let state = stubbedAuthState
        return AsyncStream { continuation in
            continuation.yield(state)
        }
    }

    func deleteAccount() async throws {
        deleteAccountCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
    }
}
