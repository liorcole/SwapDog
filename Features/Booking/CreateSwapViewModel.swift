//
//  CreateSwapViewModel.swift
//  SwapDog
//
//  ViewModel for the swap-request creation flow.
//  Validates inputs, creates the SwapRequest document, and auto-creates
//  a Conversation between the two users if none exists yet.
//
//  Architecture: MVVM-C — ViewModel layer (business logic only, no SwiftUI imports)
//
//  Step 15: Added AnalyticsServiceProtocol + RateLimitServiceProtocol injection.
//           Tracks .swapRequested on successful submission.
//           Enforces 10 swap requests/day rate limit with user-friendly alert.
//

import Foundation
import os

// MARK: - CreateSwapViewModel

/// Drives the CreateSwapRequestView: holds form state, validates input,
/// and orchestrates repository writes on submission.
@MainActor
final class CreateSwapViewModel: ObservableObject {

    // MARK: - Published Form State

    /// IDs of the current user's dogs that are selected for the swap.
    @Published var selectedDogIDs: Set<String> = []

    /// Start date chosen by the user. Defaults to tomorrow.
    @Published var startDate: Date = Calendar.current.date(
        byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: Date())
    ) ?? Date()

    /// End date chosen by the user. Defaults to start + 1 day.
    @Published var endDate: Date = Calendar.current.date(
        byAdding: .day, value: 2, to: Calendar.current.startOfDay(for: Date())
    ) ?? Date()

    /// Optional message from the requester (max 500 characters).
    @Published var message: String = ""

    /// Whether the confirmation alert is showing.
    @Published var showConfirmationAlert: Bool = false

    /// Whether a network operation is in progress.
    @Published var isLoading: Bool = false

    /// Non-nil when a user-facing error should be displayed.
    @Published var errorMessage: String?

    /// Set to true after a successful submission; observed by the View to navigate away.
    @Published var didSubmitSuccessfully: Bool = false

    // MARK: - Constants

    /// Maximum characters allowed in the optional message field.
    let maxMessageLength: Int = 500

    /// Maximum duration of a swap in days (enforced by locked decisions).
    private let maxSwapDays: Int = 30

    // MARK: - Dependencies

    private let currentUser: User
    private let recipient: User
    private let recipientDogs: [Dog]
    private let currentUserDogs: [Dog]
    private let swapRepository: any SwapRepositoryProtocol
    private let messagingRepository: any MessagingRepositoryProtocol
    private let analyticsService: any AnalyticsServiceProtocol
    private let rateLimitService: any RateLimitServiceProtocol
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "CreateSwapViewModel"
    )

    // MARK: - Init

    /// - Parameters:
    ///   - currentUser:        The authenticated user creating the request.
    ///   - currentUserDogs:    Dogs owned by `currentUser`.
    ///   - recipient:          The user receiving the request.
    ///   - recipientDogs:      Dogs owned by `recipient`.
    ///   - swapRepository:     Repository for persisting `SwapRequest` documents.
    ///   - messagingRepository: Repository for conversation look-up / creation.
    ///   - analyticsService:   Service for tracking analytics events.
    ///   - rateLimitService:   Service for enforcing swap request rate limits.
    init(
        currentUser: User,
        currentUserDogs: [Dog],
        recipient: User,
        recipientDogs: [Dog],
        swapRepository: any SwapRepositoryProtocol,
        messagingRepository: any MessagingRepositoryProtocol,
        analyticsService: any AnalyticsServiceProtocol = ConsoleAnalyticsService(),
        rateLimitService: any RateLimitServiceProtocol = RateLimitService()
    ) {
        self.currentUser        = currentUser
        self.currentUserDogs    = currentUserDogs
        self.recipient          = recipient
        self.recipientDogs      = recipientDogs
        self.swapRepository     = swapRepository
        self.messagingRepository = messagingRepository
        self.analyticsService   = analyticsService
        self.rateLimitService   = rateLimitService
    }

    // MARK: - Computed

    /// The current user's dogs (for display in the form).
    var myDogs: [Dog] { currentUserDogs }

    /// The recipient's dogs (for display in the summary card).
    var theirDogs: [Dog] { recipientDogs }

    /// Whether all required fields pass validation.
    var isFormValid: Bool {
        !selectedDogIDs.isEmpty && dateValidationError == nil
    }

    /// A human-readable error message if the date range is invalid; nil otherwise.
    var dateValidationError: String? {
        switch ValidationService.validateDateRange(start: startDate, end: endDate) {
        case .success:
            if daysBetween(start: startDate, end: endDate) > maxSwapDays {
                return "Swap range cannot exceed \(maxSwapDays) days."
            }
            return nil
        case .failure(let err):
            return err.errorDescription
        }
    }

    // MARK: - Actions

    /// Toggles inclusion of a dog in the selected set.
    func toggleDog(id: String) {
        if selectedDogIDs.contains(id) {
            selectedDogIDs.remove(id)
        } else {
            selectedDogIDs.insert(id)
        }
    }

    /// Presents the confirmation alert if the form is valid and rate limit allows.
    func requestSubmission() {
        guard isFormValid else {
            errorMessage = selectedDogIDs.isEmpty
                ? "Please select at least one of your dogs."
                : dateValidationError
            return
        }

        // Rate limit check — max 10 swap requests per day.
        guard rateLimitService.canPerformAction(.swapRequest) else {
            errorMessage = rateLimitService.limitExceededMessage(for: .swapRequest)
            logger.info("Swap request blocked by rate limiter")
            return
        }

        showConfirmationAlert = true
    }

    /// Creates the swap request and (if needed) a conversation. Called after user confirms.
    /// Records the action against the rate limiter and tracks the analytics event.
    func confirmSubmission() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let request = buildRequest()
            try await swapRepository.createRequest(request)
            await ensureConversationExists()
            stubPushNotification(for: request)

            // Record rate limit action and track analytics.
            rateLimitService.recordAction(.swapRequest)
            analyticsService.track(.swapRequested(recipientID: request.recipientID))

            logger.info("SwapRequest created: \(request.id, privacy: .private)")
            didSubmitSuccessfully = true
        } catch {
            logger.error("createRequest failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = (error as? SwapDogError)?.errorDescription
                ?? "Something went wrong. Please try again."
        }
    }

    // MARK: - Private Helpers

    private func buildRequest() -> SwapRequest {
        let now = Date()
        return SwapRequest(
            id: UUID().uuidString,
            requesterID: currentUser.id,
            recipientID: recipient.id,
            requesterDogIDs: Array(selectedDogIDs),
            recipientDogIDs: recipientDogs.map(\.id),
            startDate: startDate,
            endDate: endDate,
            message: message.isEmpty ? nil : message,
            status: .pending,
            createdAt: now,
            updatedAt: now
        )
    }

    /// Looks for an existing conversation and creates one if it doesn't exist.
    private func ensureConversationExists() async {
        let stream = messagingRepository.getConversations(userID: currentUser.id)
        var found = false
        for await conversations in stream {
            let pair: Set<String> = [currentUser.id, recipient.id]
            found = conversations.contains {
                Set($0.participantIDs) == pair
            }
            break  // First emission is current state; no need to continue.
        }

        guard !found else { return }

        let conversation = Conversation(
            id: UUID().uuidString,
            participantIDs: [currentUser.id, recipient.id],
            lastMessage: nil,
            lastMessageTimestamp: nil,
            unreadCount: [currentUser.id: 0, recipient.id: 0]
        )
        let systemMessage = Message(
            id: UUID().uuidString,
            conversationID: conversation.id,
            senderID: currentUser.id,
            text: "Swap request sent by \(currentUser.displayName).",
            timestamp: Date(),
            readBy: [currentUser.id]
        )
        do {
            try await messagingRepository.sendMessage(systemMessage)
            logger.info("Auto-created conversation: \(conversation.id, privacy: .private)")
        } catch {
            logger.warning("Failed to auto-create conversation: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Logs a push notification stub — replace with FCM call when push is wired.
    private func stubPushNotification(for request: SwapRequest) {
        logger.info(
            """
            [PUSH-STUB] Would send notification to \(request.recipientID, privacy: .private): \
            '\(currentUser.displayName) sent you a swap request.'
            """
        )
    }

    private func daysBetween(start: Date, end: Date) -> Int {
        Calendar.current.dateComponents([.day], from: start, to: end).day ?? 0
    }
}
