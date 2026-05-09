//
//  MockReviewRepository.swift
//  SwapDog
//
//  In-memory mock implementation of ReviewRepositoryProtocol.
//  Suitable for unit tests and SwiftUI previews.
//

import Foundation

// MARK: - MockReviewRepository

/// In-memory mock of `ReviewRepositoryProtocol` for unit tests and SwiftUI previews.
///
/// Pre-populates `reviews` with `[.mock]`.
final class MockReviewRepository: ReviewRepositoryProtocol {

    // MARK: - In-Memory Store

    var reviews: [Review] = [.mock]

    /// When set, all methods throw this error.
    var stubbedError: SwapDogError?

    // MARK: - Recorded Calls

    private(set) var createReviewCallCount = 0
    private(set) var getReviewsCallCount = 0

    // MARK: - ReviewRepositoryProtocol

    func createReview(_ review: Review) async throws {
        createReviewCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        reviews.append(review)
    }

    func getReviews(userID: String) async throws -> [Review] {
        getReviewsCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        return reviews
            .filter { $0.revieweeID == userID }
            .sorted { $0.createdAt > $1.createdAt }
    }
}
