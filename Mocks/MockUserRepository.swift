//
//  MockUserRepository.swift
//  SwapDog
//
//  In-memory mock implementation of UserRepositoryProtocol.
//  Suitable for unit tests and SwiftUI previews.
//

import Foundation

// MARK: - MockUserRepository

/// In-memory mock of `UserRepositoryProtocol` for unit tests and SwiftUI previews.
///
/// Pre-populates `users` with `[.mock]`. All mutations operate on the
/// in-memory store so tests can verify state changes without touching Firestore.
final class MockUserRepository: UserRepositoryProtocol {

    // MARK: - In-Memory Store

    /// The backing store — mutated by create/update calls.
    var users: [User] = [.mock]

    /// When set, all methods throw this error.
    var stubbedError: SwapDogError?

    /// Return value for `uploadProfileImage`. Override in tests.
    var stubbedProfileImageURL = "https://storage.googleapis.com/swapdog-dev/mock/profile.jpg"

    // MARK: - Recorded Calls

    private(set) var createUserCallCount = 0
    private(set) var getUserCallCount = 0
    private(set) var updateUserCallCount = 0
    private(set) var getNearbyUsersCallCount = 0
    private(set) var uploadProfileImageCallCount = 0

    // MARK: - UserRepositoryProtocol

    func createUser(_ user: User) async throws {
        createUserCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        users.append(user)
    }

    func getUser(id: String) async throws -> User {
        getUserCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        guard let user = users.first(where: { $0.id == id }) else {
            throw SwapDogError.notFound
        }
        return user
    }

    func updateUser(_ user: User) async throws {
        updateUserCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        guard let index = users.firstIndex(where: { $0.id == user.id }) else {
            throw SwapDogError.notFound
        }
        users[index] = user
    }

    func getNearbyUsers(latitude: Double, longitude: Double, radiusMiles: Double) async throws -> [User] {
        getNearbyUsersCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        // Return all mock users — radius filtering not simulated
        return users
    }

    func uploadProfileImage(data: Data) async throws -> String {
        uploadProfileImageCallCount += 1
        try await Task.sleep(for: .milliseconds(200))
        if let error = stubbedError { throw error }
        return stubbedProfileImageURL
    }
}
