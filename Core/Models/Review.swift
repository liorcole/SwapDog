//
//  Review.swift
//  SwapDog
//
//  Represents a post-swap review left by one user for another.
//  Maps to the `reviews` Firestore collection.
//

import Foundation

// MARK: - Review

/// A review submitted by one user for another after completing a swap.
///
/// Stored under `reviews/{reviewID}` in Firestore.
/// Each review is tied to a specific completed `SwapRequest`.
struct Review: Codable, Identifiable {

    // MARK: Properties

    /// Unique Firestore document ID for this review.
    let id: String

    /// UID of the user who wrote the review.
    let reviewerID: String

    /// UID of the user being reviewed.
    let revieweeID: String

    /// ID of the `SwapRequest` this review relates to.
    let swapRequestID: String

    /// Star rating given by the reviewer (1 = worst, 5 = best).
    var rating: Int

    /// Written feedback left by the reviewer.
    var text: String

    /// Timestamp when the review was submitted.
    let createdAt: Date

    // MARK: CodingKeys

    enum CodingKeys: String, CodingKey {
        case id
        case reviewerID    = "reviewer_id"
        case revieweeID    = "reviewee_id"
        case swapRequestID = "swap_request_id"
        case rating
        case text
        case createdAt     = "created_at"
    }

    // MARK: Firestore Serialisation

    /// Dictionary representation suitable for writing to Firestore.
    var firestoreData: [String: Any] {
        [
            CodingKeys.id.rawValue:             id,
            CodingKeys.reviewerID.rawValue:     reviewerID,
            CodingKeys.revieweeID.rawValue:     revieweeID,
            CodingKeys.swapRequestID.rawValue:  swapRequestID,
            CodingKeys.rating.rawValue:         rating,
            CodingKeys.text.rawValue:           text,
            CodingKeys.createdAt.rawValue:      createdAt,
        ]
    }
}

// MARK: - Mock Data

extension Review {
    /// A realistic sample `Review` for use in SwiftUI previews and unit tests.
    static var mock: Review {
        Review(
            id: "review_mock_001",
            reviewerID: "usr_mock_002",
            revieweeID: "usr_mock_001",
            swapRequestID: "swap_mock_001",
            rating: 5,
            text: "Sarah was an amazing dog sitter! Luna was happy and well-cared for. Would absolutely swap again — highly recommended to the whole SwapDog community.",
            createdAt: ISO8601DateFormatter().date(from: "2026-06-13T10:00:00Z") ?? Date()
        )
    }
}
