//
//  FirestoreMessagingRepository.swift
//  SwapDog
//
//  Firestore-backed implementation of MessagingRepositoryProtocol.
//  Real-time listeners are wrapped in AsyncStream continuations.
//
//

import Foundation
import os
import FirebaseFirestore

// MARK: - FirestoreMessagingRepository

/// Concrete Firestore implementation of `MessagingRepositoryProtocol`.
///
/// Real-time snapshot listeners are bridged into Swift Concurrency via
/// `AsyncStream`, so callers use `for await` with no manual listener lifecycle.
/// Listener registration and removal are handled inside `AsyncStream.Continuation.onTermination`.
final class FirestoreMessagingRepository: MessagingRepositoryProtocol {

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "FirestoreMessagingRepository"
    )

    private let db = Firestore.firestore()

    // MARK: - MessagingRepositoryProtocol

    func sendMessage(_ message: Message) async throws {
        logger.info("sendMessage id=\(message.id, privacy: .private) conversationID=\(message.conversationID, privacy: .private)")
        do {
            // 1. Write the message document
            try await db
                .collection(FirestorePaths.messages(conversationID: message.conversationID))
                .document(message.id)
                .setData(message.firestoreData)

            // 2. Update the parent conversation's preview fields
            try await db
                .collection(FirestorePaths.conversations)
                .document(message.conversationID)
                .updateData([
                    "last_message": message.text,
                    "last_message_timestamp": message.timestamp
                ])
        } catch let error as SwapDogError {
            logger.error("sendMessage failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("sendMessage unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.networkError
        }
    }

    func getMessages(conversationID: String) -> AsyncStream<[Message]> {
        logger.info("getMessages conversationID=\(conversationID, privacy: .private) — attaching listener")
        return AsyncStream { [logger] continuation in
            let listener = Firestore.firestore()
                .collection(FirestorePaths.messages(conversationID: conversationID))
                .order(by: "timestamp", descending: false)
                .addSnapshotListener { snapshot, error in
                    if let error {
                        logger.error("getMessages listener error: \(error.localizedDescription, privacy: .public)")
                        continuation.yield([])
                        return
                    }
                    let messages = snapshot?.documents.compactMap { doc -> Message? in
                        try? JSONDecoder().decode(Message.self,
                            from: JSONSerialization.data(withJSONObject: doc.data()))
                    } ?? []
                    continuation.yield(messages)
                }
            continuation.onTermination = { _ in listener.remove() }
        }
    }

    func getConversations(userID: String) -> AsyncStream<[Conversation]> {
        logger.info("getConversations userID=\(userID, privacy: .private) — attaching listener")
        return AsyncStream { [logger] continuation in
            let listener = Firestore.firestore()
                .collection(FirestorePaths.conversations)
                .whereField("participant_ids", arrayContains: userID)
                .order(by: "last_message_timestamp", descending: true)
                .addSnapshotListener { snapshot, error in
                    if let error {
                        logger.error("getConversations listener error: \(error.localizedDescription, privacy: .public)")
                        continuation.yield([])
                        return
                    }
                    let conversations = snapshot?.documents.compactMap { doc -> Conversation? in
                        try? JSONDecoder().decode(Conversation.self,
                            from: JSONSerialization.data(withJSONObject: doc.data()))
                    } ?? []
                    continuation.yield(conversations)
                }
            continuation.onTermination = { _ in listener.remove() }
        }
    }

    func markAsRead(conversationID: String, userID: String) async throws {
        logger.info("markAsRead conversationID=\(conversationID, privacy: .private) userID=\(userID, privacy: .private)")
        do {
            try await db
                .collection(FirestorePaths.conversations)
                .document(conversationID)
                .updateData(["unread_count.\(userID)": 0])
        } catch let error as SwapDogError {
            logger.error("markAsRead failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("markAsRead unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.networkError
        }
    }
}
