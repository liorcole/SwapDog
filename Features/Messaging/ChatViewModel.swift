//
//  ChatViewModel.swift
//  SwapDog
//
//  Manages real-time message streaming, sending, read receipts,
//  and pagination for a single conversation.
//
//  Architecture layer: Features/Messaging (ViewModel)
//  Locked decisions:
//    - Messages ordered oldest → newest (ascending timestamp)
//    - Pagination loads 50 messages initially; older pages appended above
//      without duplicates (compare IDs)
//    - Real-time updates via AsyncStream wrapping Firestore listeners
//
//  Step 15: Added AnalyticsServiceProtocol + RateLimitServiceProtocol injection.
//           Tracks .messageSent on every successful send.
//           Enforces 100 messages/hour rate limit with user-friendly alert.
//

import Foundation
import os

// MARK: - ChatViewModel

/// Drives `ChatView` with real-time message updates, send logic, and pagination.
///
/// Inject via `@StateObject` (or `@ObservedObject` when created by a parent view).
@MainActor
final class ChatViewModel: ObservableObject {

    // MARK: - Published State

    /// Messages ordered oldest → newest (index 0 = oldest, last index = newest).
    @Published private(set) var messages: [Message] = []

    /// Bound to the text input field.
    @Published var messageText: String = ""

    /// `true` while a `sendMessage` call is in flight.
    @Published private(set) var isSending: Bool = false

    /// Non-nil when the most recent send failed and a retry option should appear.
    @Published private(set) var sendErrorMessage: String?

    /// `true` while the initial stream batch is loading.
    @Published private(set) var isLoading: Bool = false

    /// `true` when an older-message page is being fetched.
    @Published private(set) var isLoadingOlder: Bool = false

    // MARK: - Read-Only Context

    /// Display name of the other participant (from the resolved User profile).
    let otherUserName: String

    /// Profile image URL of the other participant (if available).
    let otherUserImageURL: String?

    /// Conversation document ID.
    let conversationID: String

    // MARK: - Computed

    /// `true` when the send button should be enabled.
    var canSend: Bool {
        !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isSending
    }

    // MARK: - Constants

    private enum Pagination {
        /// Number of messages loaded on the initial fetch and per page.
        static let pageSize: Int = 50
    }

    // MARK: - Dependencies

    private let messagingRepository: any MessagingRepositoryProtocol
    private let currentUserID:       String
    private let analyticsService:    any AnalyticsServiceProtocol
    private let rateLimitService:    any RateLimitServiceProtocol

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "ChatViewModel"
    )

    // MARK: - Private State

    /// All message IDs currently in the list — used for deduplication.
    private var knownMessageIDs: Set<String> = []

    /// Handle to the running stream task; cancelled in `deinit`.
    private var streamTask: Task<Void, Never>?

    // MARK: - Init

    /// Creates a new `ChatViewModel`.
    ///
    /// - Parameters:
    ///   - conversationID:      The Firestore conversation document ID.
    ///   - currentUserID:       The signed-in user's Firebase UID.
    ///   - otherUser:           Resolved profile of the other participant.
    ///   - messagingRepository: Source of the real-time messages stream.
    ///   - analyticsService:    Service for tracking analytics events.
    ///   - rateLimitService:    Service for enforcing message rate limits.
    init(
        conversationID:      String,
        currentUserID:       String,
        otherUser:           User?,
        messagingRepository: any MessagingRepositoryProtocol,
        analyticsService:    any AnalyticsServiceProtocol = ConsoleAnalyticsService(),
        rateLimitService:    any RateLimitServiceProtocol = RateLimitService()
    ) {
        self.conversationID       = conversationID
        self.currentUserID        = currentUserID
        self.otherUserName        = otherUser?.displayName ?? "Chat"
        self.otherUserImageURL    = otherUser?.profileImageURL
        self.messagingRepository  = messagingRepository
        self.analyticsService     = analyticsService
        self.rateLimitService     = rateLimitService
    }

    deinit {
        streamTask?.cancel()
    }

    // MARK: - Public API: Lifecycle

    /// Begins the real-time messages stream.
    ///
    /// Call from `.task {}` in `ChatView`. Safe to call multiple times.
    func startListening() {
        guard streamTask == nil else { return }
        isLoading = true

        streamTask = Task {
            defer { isLoading = false }
            let stream = messagingRepository.getMessages(conversationID: conversationID)
            for await batch in stream {
                guard !Task.isCancelled else { break }
                mergeLiveUpdate(batch)
            }
        }
    }

    /// Stops the stream. Called automatically in `deinit`.
    func stopListening() {
        streamTask?.cancel()
        streamTask = nil
    }

    // MARK: - Public API: Actions

    /// Sends the current `messageText` as a new message.
    ///
    /// Checks the rate limit first (100 messages/hour). If allowed, clears the
    /// input field optimistically, writes to Firestore, and tracks the event.
    /// If the write fails, the error is surfaced via `sendErrorMessage`.
    func sendMessage() async {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }

        // Rate limit check — max 100 messages per hour.
        guard rateLimitService.canPerformAction(.message) else {
            sendErrorMessage = rateLimitService.limitExceededMessage(for: .message)
            logger.info("Message blocked by rate limiter — hourly limit reached")
            return
        }

        let message = Message(
            id:             UUID().uuidString,
            conversationID: conversationID,
            senderID:       currentUserID,
            text:           text,
            timestamp:      Date(),
            readBy:         [currentUserID]
        )

        // Optimistic clear
        messageText      = ""
        isSending        = true
        sendErrorMessage = nil

        do {
            try await messagingRepository.sendMessage(message)
            rateLimitService.recordAction(.message)
            analyticsService.track(.messageSent(conversationID: conversationID))
            logger.info("sendMessage success id=\(message.id, privacy: .private)")
        } catch {
            sendErrorMessage = (error as? SwapDogError)?.errorDescription
                ?? "Failed to send message. Tap to retry."
            logger.error("sendMessage failed: \(error.localizedDescription, privacy: .public)")
            // Restore the draft text so the user can retry.
            messageText = text
        }

        isSending = false
    }

    /// Marks the conversation as read for the current user.
    ///
    /// Call on `.onAppear` of `ChatView`.
    func markAsRead() async {
        do {
            try await messagingRepository.markAsRead(
                conversationID: conversationID,
                userID:         currentUserID
            )
        } catch {
            // Non-fatal — badge will self-correct on next stream update.
            logger.warning("markAsRead failed (non-fatal): \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Loads an additional page of older messages above the current list.
    ///
    /// Uses ID-based deduplication so overlapping cursor windows don't
    /// introduce duplicate rows.
    func loadOlderMessages() async {
        guard !isLoadingOlder, !messages.isEmpty else { return }
        isLoadingOlder = true
        defer { isLoadingOlder = false }

        // In a real implementation the repository would expose a cursor-based
        // paginated fetch. The mock and Firestore stub both return the full
        // sorted list via `getMessages`, so this no-ops until a cursor API
        // is added. The deduplication guard is the key safety net.
        logger.info("loadOlderMessages — pagination cursor API not yet wired")
    }

    // MARK: - Private: Stream Merge

    /// Merges a live update from the stream into the local `messages` array.
    ///
    /// Inserts only messages whose IDs are not already tracked, maintaining
    /// strict timestamp-ascending order and preventing duplicates from
    /// pagination cursor overlap.
    private func mergeLiveUpdate(_ incoming: [Message]) {
        isLoading = false
        let newMessages = incoming.filter { !knownMessageIDs.contains($0.id) }
        guard !newMessages.isEmpty || messages.count != incoming.count else { return }

        // Build a merged set from the live array (repo always returns full sorted list).
        let merged = incoming.sorted { $0.timestamp < $1.timestamp }
        knownMessageIDs = Set(merged.map(\.id))
        messages = merged

        logger.info("Messages updated — count: \(merged.count)")
    }
}
