//
//  Message.swift
//  SwapDog
//
//  Represents a single chat message within a conversation.
//  Maps to the `conversations/{conversationID}/messages` Firestore subcollection.
//

import Foundation

// MARK: - Message

/// A single message sent within a `Conversation`.
///
/// Stored under `conversations/{conversationID}/messages/{messageID}` in Firestore.
struct Message: Codable, Identifiable {

    // MARK: Properties

    /// Unique Firestore document ID for this message.
    let id: String

    /// ID of the parent `Conversation` document.
    let conversationID: String

    /// UID of the user who sent this message.
    let senderID: String

    /// Text body of the message.
    var text: String

    /// Server timestamp when the message was created.
    let timestamp: Date

    /// UIDs of participants who have read this message.
    var readBy: [String]

    // MARK: CodingKeys

    enum CodingKeys: String, CodingKey {
        case id
        case conversationID = "conversation_id"
        case senderID       = "sender_id"
        case text
        case timestamp
        case readBy         = "read_by"
    }

    // MARK: Firestore Serialisation

    /// Dictionary representation suitable for writing to Firestore.
    var firestoreData: [String: Any] {
        [
            CodingKeys.id.rawValue:             id,
            CodingKeys.conversationID.rawValue: conversationID,
            CodingKeys.senderID.rawValue:       senderID,
            CodingKeys.text.rawValue:           text,
            CodingKeys.timestamp.rawValue:      timestamp,
            CodingKeys.readBy.rawValue:         readBy,
        ]
    }
}

// MARK: - Mock Data

extension Message {
    /// A realistic sample `Message` for use in SwiftUI previews and unit tests.
    static var mock: Message {
        Message(
            id: "msg_mock_001",
            conversationID: "conv_mock_001",
            senderID: "usr_mock_001",
            text: "Hi! Luna loves your neighbourhood and I'd love to set up a swap for the long weekend. Let me know if the dates work!",
            timestamp: ISO8601DateFormatter().date(from: "2026-05-08T14:22:00Z") ?? Date(),
            readBy: ["usr_mock_001"]
        )
    }
}
