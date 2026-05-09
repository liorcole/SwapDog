//
//  MessagingRepositoryProtocol.swift
//  SwapDog
//
//  Contract for real-time Firestore messaging operations.
//  Concrete implementation: FirestoreMessagingRepository (same folder).
//  Test/preview substitute: MockMessagingRepository (Tests/Mocks/).
//
//  IMPORTANT: No Firestore types appear in this signature.
//

import Foundation

// MARK: - MessagingRepositoryProtocol

/// Defines the contract for real-time chat operations.
///
/// Real-time streams use `AsyncStream` backed by Firestore snapshot listeners,
/// so callers use `for await` without managing listener lifecycles directly.
protocol MessagingRepositoryProtocol: AnyObject, Sendable {

    // MARK: Send

    /// Writes a new `Message` document to a conversation's subcollection and
    /// updates the parent `Conversation` document's `lastMessage` fields.
    ///
    /// - Parameter message: The message to send.
    /// - Throws: `SwapDogError` if either write fails.
    func sendMessage(_ message: Message) async throws

    // MARK: Real-Time Streams

    /// Returns a live stream of messages for the given conversation.
    ///
    /// The stream emits a new `[Message]` array whenever a document is
    /// added, modified, or deleted in the conversation's messages subcollection.
    /// Messages are sorted by timestamp ascending.
    ///
    /// - Parameter conversationID: The Firestore document ID of the conversation.
    /// - Returns: An `AsyncStream` that never finishes while the app is alive.
    func getMessages(conversationID: String) -> AsyncStream<[Message]>

    /// Returns a live stream of all conversations the given user participates in.
    ///
    /// The stream emits a new `[Conversation]` array whenever any participant's
    /// conversation document changes. Sorted by `lastMessageTimestamp` descending.
    ///
    /// - Parameter userID: The Firebase UID of the current user.
    /// - Returns: An `AsyncStream` that never finishes while the app is alive.
    func getConversations(userID: String) -> AsyncStream<[Conversation]>

    // MARK: Read Receipts

    /// Resets the unread message count for the current user in a conversation.
    ///
    /// - Parameters:
    ///   - conversationID: The Firestore document ID of the conversation.
    ///   - userID: The Firebase UID whose unread count should be zeroed.
    /// - Throws: `SwapDogError` if the update fails.
    func markAsRead(conversationID: String, userID: String) async throws
}
