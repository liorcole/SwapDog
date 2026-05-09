//
//  SwapRequest.swift
//  SwapDog
//
//  Represents a dog-sitting swap request between two users.
//  Maps to the `swap_requests` Firestore collection.
//

import Foundation

// MARK: - SwapStatus

/// Lifecycle state of a swap request.
enum SwapStatus: String, Codable, CaseIterable {
    case pending   = "pending"
    case accepted  = "accepted"
    case declined  = "declined"
    case completed = "completed"
    case cancelled = "cancelled"
}

// MARK: - SwapRequest

/// A request from one user to swap dog-sitting duties with another.
///
/// Stored under `swap_requests/{requestID}` in Firestore.
/// Both parties can have one or more dogs involved in a single swap.
struct SwapRequest: Codable, Identifiable {

    // MARK: Properties

    /// Unique Firestore document ID for this swap request.
    let id: String

    /// UID of the user who initiated the request.
    let requesterID: String

    /// UID of the user who received the request.
    let recipientID: String

    /// IDs of the requester's dogs participating in the swap.
    var requesterDogIDs: [String]

    /// IDs of the recipient's dogs participating in the swap.
    var recipientDogIDs: [String]

    /// Date/time when the requester needs care to start.
    var startDate: Date

    /// Date/time when the care period ends.
    var endDate: Date

    /// Optional personal message from the requester.
    var message: String?

    /// Current lifecycle status of the request.
    var status: SwapStatus

    /// Timestamp when the document was first created.
    let createdAt: Date

    /// Timestamp of the last status or field change.
    var updatedAt: Date

    // MARK: CodingKeys

    enum CodingKeys: String, CodingKey {
        case id
        case requesterID    = "requester_id"
        case recipientID    = "recipient_id"
        case requesterDogIDs = "requester_dog_ids"
        case recipientDogIDs = "recipient_dog_ids"
        case startDate      = "start_date"
        case endDate        = "end_date"
        case message
        case status
        case createdAt      = "created_at"
        case updatedAt      = "updated_at"
    }

    // MARK: Firestore Serialisation

    /// Dictionary representation suitable for writing to Firestore.
    var firestoreData: [String: Any] {
        var data: [String: Any] = [
            CodingKeys.id.rawValue:             id,
            CodingKeys.requesterID.rawValue:     requesterID,
            CodingKeys.recipientID.rawValue:     recipientID,
            CodingKeys.requesterDogIDs.rawValue: requesterDogIDs,
            CodingKeys.recipientDogIDs.rawValue: recipientDogIDs,
            CodingKeys.startDate.rawValue:       startDate,
            CodingKeys.endDate.rawValue:         endDate,
            CodingKeys.status.rawValue:          status.rawValue,
            CodingKeys.createdAt.rawValue:       createdAt,
            CodingKeys.updatedAt.rawValue:       updatedAt,
        ]
        if let message {
            data[CodingKeys.message.rawValue] = message
        }
        return data
    }
}

// MARK: - Mock Data

extension SwapRequest {
    /// A realistic sample `SwapRequest` for use in SwiftUI previews and unit tests.
    static var mock: SwapRequest {
        let formatter = ISO8601DateFormatter()
        return SwapRequest(
            id: "swap_mock_001",
            requesterID: "usr_mock_001",
            recipientID: "usr_mock_002",
            requesterDogIDs: ["dog_mock_001"],
            recipientDogIDs: ["dog_mock_002"],
            startDate: formatter.date(from: "2026-06-10T09:00:00Z") ?? Date(),
            endDate: formatter.date(from: "2026-06-12T18:00:00Z") ?? Date(),
            message: "Hi! Luna loves your neighbourhood and I'd love to set up a swap for the long weekend. Let me know if the dates work!",
            status: .pending,
            createdAt: formatter.date(from: "2026-05-08T14:22:00Z") ?? Date(),
            updatedAt: formatter.date(from: "2026-05-08T14:22:00Z") ?? Date()
        )
    }
}
