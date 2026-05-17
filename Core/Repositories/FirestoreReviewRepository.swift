//
//  FirestoreReviewRepository.swift
//  SwapDog
//
//  Firestore-backed implementation of ReviewRepositoryProtocol.
//
//

import Foundation
import os
import FirebaseFirestore

// MARK: - FirestoreReviewRepository

/// Concrete Firestore implementation of `ReviewRepositoryProtocol`.
///
/// Reviews live in the top-level `reviews` collection and are queried by
/// the reviewee's UID. The repository also updates the reviewee's average
/// rating in their `users` document after a new review is written.
final class FirestoreReviewRepository: ReviewRepositoryProtocol {

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "FirestoreReviewRepository"
    )

    private let db = Firestore.firestore()

    // MARK: - ReviewRepositoryProtocol

    func createReview(_ review: Review) async throws {
        logger.info("createReview id=\(review.id) revieweeID=\(review.revieweeID)")
        do {
            try await db
                .collection(FirestorePaths.reviews)
                .document(review.id)
                .setData(review.firestoreData)

            // Update the reviewee's aggregate rating in a transaction
            try await db.runTransaction { transaction, errorPointer in
                let userRef = self.db.collection(FirestorePaths.users).document(review.revieweeID)
                guard let snapshot = try? transaction.getDocument(userRef) else { return nil }
                let currentCount = snapshot.data()?["review_count"] as? Int ?? 0
                let currentRating = snapshot.data()?["rating"] as? Double ?? 0.0
                let newCount = currentCount + 1
                let newRating = ((currentRating * Double(currentCount)) + Double(review.rating)) / Double(newCount)
                transaction.updateData(["rating": newRating, "review_count": newCount], forDocument: userRef)
                return nil
            }
        } catch let error as SwapDogError {
            logger.error("createReview failed: \(error.localizedDescription)")
            throw error
        } catch {
            logger.error("createReview unexpected error: \(error.localizedDescription)")
            throw SwapDogError.networkError
        }
    }

    func getReviews(userID: String) async throws -> [Review] {
        logger.info("getReviews userID=\(userID)")
        do {
            let snapshot = try await db
                .collection(FirestorePaths.reviews)
                .whereField("reviewee_id", isEqualTo: userID)
                .order(by: "created_at", descending: true)
                .getDocuments()
            return try snapshot.documents.compactMap { try decode(Review.self, from: $0.data()) }
        } catch let error as SwapDogError {
            logger.error("getReviews failed: \(error.localizedDescription)")
            throw error
        } catch {
            logger.error("getReviews unexpected error: \(error.localizedDescription)")
            throw SwapDogError.networkError
        }
    }

    // MARK: - Private Helpers

    private func decode<T: Decodable>(_ type: T.Type, from data: [String: Any]) throws -> T {
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return try decoder.decode(type, from: jsonData)
    }
}
