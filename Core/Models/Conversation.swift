//
//  Conversation.swift
//  SwapDog
//
//  Represents a direct-message thread between two or more users.
//  Maps to the `conversations` Firestore collection.
//

import Foundation

// MARK: - Conversation

/// A real-time chat thread shared between two or more SwapDog users.
///
/// Stored under `conversations/{conversationID}` in Firestore.
/// Individual messages are stored in the `messages` subcollection.
struct Conversation: Codable, Identifiable {

    // MARK: Properties

    /// Unique Firestore document ID for this conversation.
    let id: String

    /// UIDs of all users who are party to this conversation.
    var participantIDs: [String]

    /// Text preview of the most recent message sent in this conversation.
    var lastMessage: String?

    /// Timestamp of the most recent message, used for sort ordering.
    var lastMessageTimestamp: Date?

    /// Per-user count of messages not yet read, keyed by UID.
    ///
    /// Example: `["usr_001": 3, "usr_002": 0]`
    var unreadCount: [String: Int]

    // MARK: CodingKeys

    enum CodingKeys: String, CodingKey {
        case id
        case participantIDs       = "participant_ids"
        case lastMessage          = "last_message"
        case lastMessageTimestamp = "last_message_timestamp"
        case unreadCount          = "unread_count"
    }

    // MARK: Firestore Serialisation

    /// Dictionary representation suitable for writing to Firestore.
    var firestoreData: [String: Any] {
        var data: [String: Any] = [
            CodingKeys.id.rawValue:             id,
            CodingKeys.participantIDs.rawValue: participantIDs,
            CodingKeys.unreadCount.rawValue:    unreadCount,
        ]
        if let lastMessage {
            data[CodingKeys.lastMessage.rawValue] = lastMessage
        }
        if let lastMessageTimestamp {
            data[CodingKeys.lastMessageTimestamp.rawValue] = lastMessageTimestamp
        }
        return data
    }
}

// MARK: - Mock Data

extension Conversation {
    /// A realistic sample `Conversation` for use in SwiftUI previews and unit tests.
    static var mock: Conversation {
        Conversation(
            id: "conv_mock_001",
            participantIDs: ["usr_mock_001", "usr_mock_002"],
            lastMessage: "Hi! Luna loves your neighbourhood and I'd love to set up a swap for the long weekend.",
            lastMessageTimestamp: ISO8601DateFormatter().date(from: "2026-05-08T14:22:00Z") ?? Date(),
            unreadCount: ["usr_mock_001": 0, "usr_mock_002": 1]
        )
    }
}
