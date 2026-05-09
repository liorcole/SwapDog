//
//  MockMessagingRepository.swift
//  SwapDog
//
//  In-memory mock implementation of MessagingRepositoryProtocol.
//  Suitable for unit tests and SwiftUI previews.
//

import Foundation

// MARK: - MockMessagingRepository

/// In-memory mock of `MessagingRepositoryProtocol` for unit tests and SwiftUI previews.
///
/// Pre-populates stores with `[.mock]` data.
/// `getMessages` and `getConversations` emit the current in-memory state once,
/// then remain open — call `continuation.yield` externally to simulate updates.
final class MockMessagingRepository: MessagingRepositoryProtocol {

    // MARK: - In-Memory Store

    var messages: [Message] = [.mock]
    var conversations: [Conversation] = [.mock]

    /// When set, `sendMessage` and `markAsRead` throw this error.
    var stubbedError: SwapDogError?

    // MARK: - Recorded Calls

    private(set) var sendMessageCallCount = 0
    private(set) var markAsReadCallCount = 0

    // MARK: - MessagingRepositoryProtocol

    func sendMessage(_ message: Message) async throws {
        sendMessageCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        messages.append(message)

        // Update the parent conversation's preview
        if let index = conversations.firstIndex(where: { $0.id == message.conversationID }) {
            conversations[index].lastMessage = message.text
            conversations[index].lastMessageTimestamp = message.timestamp
        }
    }

    func getMessages(conversationID: String) -> AsyncStream<[Message]> {
        let filtered = messages.filter { $0.conversationID == conversationID }
            .sorted { $0.timestamp < $1.timestamp }
        return AsyncStream { continuation in
            continuation.yield(filtered)
        }
    }

    func getConversations(userID: String) -> AsyncStream<[Conversation]> {
        let filtered = conversations
            .filter { $0.participantIDs.contains(userID) }
            .sorted {
                ($0.lastMessageTimestamp ?? Date.distantPast) >
                ($1.lastMessageTimestamp ?? Date.distantPast)
            }
        return AsyncStream { continuation in
            continuation.yield(filtered)
        }
    }

    func markAsRead(conversationID: String, userID: String) async throws {
        markAsReadCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        guard let index = conversations.firstIndex(where: { $0.id == conversationID }) else {
            throw SwapDogError.notFound
        }
        conversations[index].unreadCount[userID] = 0
    }
}
