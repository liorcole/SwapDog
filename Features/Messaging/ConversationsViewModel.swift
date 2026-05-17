//
//  ConversationsViewModel.swift
//  SwapDog
//
//  Drives the conversations list screen with a real-time Firestore stream.
//  Resolves participant display names and computes the unread badge count
//  for the Messages tab.
//
//  Architecture layer: Features/Messaging (ViewModel)
//  Locked decisions:
//    - Real-time updates via AsyncStream wrapping Firestore listeners
//    - User profiles cached in [String: User] to avoid redundant fetches
//

import Foundation
import os

// MARK: - ConversationItem

/// View-ready wrapper combining a `Conversation` with the resolved `User`
/// profile of the other participant.
struct ConversationItem: Identifiable {
    /// Conversation document ID — stable identity for the list.
    var id: String { conversation.id }

    /// The underlying conversation model.
    let conversation: Conversation

    /// Resolved profile of the other participant. `nil` while loading.
    let otherUser: User?

    // MARK: Convenience

    /// Unread count for the current user in this conversation.
    func unreadCount(for userID: String) -> Int {
        conversation.unreadCount[userID] ?? 0
    }

    /// Last message preview, truncated to ~60 characters.
    var lastMessagePreview: String {
        guard let text = conversation.lastMessage, !text.isEmpty else {
            return "No messages yet"
        }
        return String(text.prefix(60)) + (text.count > 60 ? "…" : "")
    }

    /// Relative timestamp string for the conversation row.
    var relativeTimestamp: String {
        conversation.lastMessageTimestamp?.relativeTimestamp() ?? ""
    }
}

// MARK: - ConversationsViewModel

/// Manages the conversations list, subscribing to the real-time
/// `MessagingRepository.getConversations(userID:)` stream.
///
/// Resolves participant display names on demand via `UserRepository`,
/// caching each `User` to avoid redundant network calls.
@MainActor
final class ConversationsViewModel: ObservableObject {

    // MARK: - Published State

    /// Sorted (newest first) list of conversation items ready for display.
    @Published private(set) var conversations: [ConversationItem] = []

    /// `true` while the initial stream load is in flight.
    @Published private(set) var isLoading: Bool = false

    /// Non-nil when an error needs to surface to the user.
    @Published private(set) var errorMessage: String?

    // MARK: - Computed

    /// Total unread count across all conversations — drives the Messages tab badge.
    var totalUnreadCount: Int {
        guard let currentUserID else { return 0 }
        return conversations.reduce(0) { $0 + $1.unreadCount(for: currentUserID) }
    }

    // MARK: - Dependencies

    private let messagingRepository: any MessagingRepositoryProtocol
    private let userRepository:      any UserRepositoryProtocol
    private let currentUserID:       String?

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "ConversationsViewModel"
    )

    // MARK: - Private State

    /// In-memory cache of resolved User profiles keyed by UID.
    private var userCache: [String: User] = [:]

    /// Handle to the running stream task; cancelled in `deinit`.
    private var streamTask: Task<Void, Never>?

    // MARK: - Init

    /// Creates a new `ConversationsViewModel`.
    ///
    /// - Parameters:
    ///   - messagingRepository: Source of the real-time conversations stream.
    ///   - userRepository:      Fetches participant profiles for display.
    ///   - currentUserID:       The signed-in user's Firebase UID.
    init(
        messagingRepository: any MessagingRepositoryProtocol,
        userRepository:      any UserRepositoryProtocol,
        currentUserID:       String?
    ) {
        self.messagingRepository = messagingRepository
        self.userRepository      = userRepository
        self.currentUserID       = currentUserID
    }

    deinit {
        streamTask?.cancel()
    }

    // MARK: - Public API

    /// Begins subscribing to the real-time conversations stream.
    ///
    /// Call from `.task {}` in `ConversationsListView`. Safe to call multiple
    /// times — subsequent calls are no-ops while the stream is active.
    func startListening() {
        guard streamTask == nil else { return }
        guard let userID = currentUserID else {
            logger.warning("startListening called without a currentUserID — skipping")
            return
        }

        isLoading = true
        streamTask = Task {
            defer { isLoading = false }
            let stream = messagingRepository.getConversations(userID: userID)
            for await rawConversations in stream {
                guard !Task.isCancelled else { break }
                await updateConversations(rawConversations, currentUserID: userID)
            }
        }
    }

    /// Stops the real-time stream subscription. Called automatically in `deinit`.
    func stopListening() {
        streamTask?.cancel()
        streamTask = nil
    }

    // MARK: - Private: Stream Handler

    /// Resolves participant names for each conversation and publishes items.
    private func updateConversations(
        _ rawConversations: [Conversation],
        currentUserID: String
    ) async {
        isLoading = false
        errorMessage = nil

        var items: [ConversationItem] = []
        for conversation in rawConversations {
            let otherParticipantID = conversation.participantIDs
                .first { $0 != currentUserID }

            var otherUser: User?
            if let pid = otherParticipantID {
                otherUser = await resolveUser(id: pid)
            }

            items.append(ConversationItem(
                conversation: conversation,
                otherUser:    otherUser
            ))
        }

        // Already sorted newest-first by repository; preserve that order.
        conversations = items
        logger.info("Updated conversations list — count: \(items.count)")
    }

    // MARK: - Private: User Resolution

    /// Returns a cached `User` or fetches it from `userRepository`, updating the cache.
    private func resolveUser(id: String) async -> User? {
        if let cached = userCache[id] {
            return cached
        }
        do {
            let user = try await userRepository.getUser(id: id)
            userCache[id] = user
            return user
        } catch {
            logger.error("Failed to resolve user \(id): \(error.localizedDescription)")
            return nil
        }
    }
}
