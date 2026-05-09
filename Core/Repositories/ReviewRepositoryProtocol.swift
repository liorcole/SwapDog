//
//  ReviewRepositoryProtocol.swift
//  SwapDog
//
//  Contract for Firestore review operations.
//  Concrete implementation: FirestoreReviewRepository (same folder).
//  Test/preview substitute: MockReviewRepository (Tests/Mocks/).
//
//  IMPORTANT: No Firestore types appear in this signature.
//

import Foundation

// MARK: - ReviewRepositoryProtocol

/// Defines the contract for creating and fetching post-swap `Review` documents.
///
/// Reviews live in the top-level `reviews` collection and are queried by
/// the reviewee's UID. A single swap should produce at most two reviews
/// (one from each party) — this is enforced at the service layer, not here.
protocol ReviewRepositoryProtocol: AnyObject, Sendable {

    // MARK: Create

    /// Writes a new `Review` document to Firestore.
    ///
    /// - Parameter review: The review to persist. The `id` field is the document ID.
    /// - Throws: `SwapDogError` if the write fails.
    func createReview(_ review: Review) async throws

    // MARK: Fetch

    /// Fetches all reviews written about a specific user.
    ///
    /// - Parameter userID: The Firebase UID of the user being reviewed.
    /// - Returns: An array of `Review` values, newest first.
    /// - Throws: `SwapDogError` if the query fails.
    func getReviews(userID: String) async throws -> [Review]
}
