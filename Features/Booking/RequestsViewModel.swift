//
//  RequestsViewModel.swift
//  SwapDog
//
//  Loads and manages all swap requests for the authenticated user.
//  Handles all status transitions with validation.
//
//  Architecture: MVVM-C — ViewModel layer (business logic only)
//
//  Step 15: Added AnalyticsServiceProtocol injection.
//           Tracks .swapAccepted and .swapCompleted events.
//

import Foundation
import os

// MARK: - SwapTransitionError

/// Describes an illegal status transition attempt.
enum SwapTransitionError: LocalizedError {
    case invalidTransition(from: SwapStatus, to: SwapStatus)
    case requestNotFound(id: String)
    case endDateNotReached

    var errorDescription: String? {
        switch self {
        case .invalidTransition(let from, let to):
            return "Cannot transition from '\(from.rawValue)' to '\(to.rawValue)'."
        case .requestNotFound(let id):
            return "Request '\(id)' was not found."
        case .endDateNotReached:
            return "The swap end date has not been reached yet."
        }
    }
}

// MARK: - RequestsViewModel

/// Manages incoming and outgoing swap requests for the current user.
///
/// All status transitions are validated before the repository is called —
/// an invalid transition throws `SwapTransitionError` without touching Firestore.
@MainActor
final class RequestsViewModel: ObservableObject {

    // MARK: - Published State

    /// Requests sent to the current user.
    @Published private(set) var incomingRequests: [SwapRequest] = []

    /// Requests sent by the current user.
    @Published private(set) var outgoingRequests: [SwapRequest] = []

    /// Whether a network operation is in progress.
    @Published var isLoading: Bool = false

    /// Non-nil when a user-facing error should be displayed.
    @Published var errorMessage: String?

    // MARK: - Dependencies

    private let currentUserID: String
    private let swapRepository: any SwapRepositoryProtocol
    private let userRepository: any UserRepositoryProtocol
    private let reviewRepository: any ReviewRepositoryProtocol
    private let analyticsService: any AnalyticsServiceProtocol
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "RequestsViewModel"
    )

    // MARK: - Init

    /// - Parameters:
    ///   - currentUserID:   The Firebase UID of the authenticated user.
    ///   - swapRepository:  Repository for reading and updating swap requests.
    ///   - userRepository:  Repository for updating swap counts on completion.
    ///   - reviewRepository: Repository for creating post-swap reviews.
    ///   - analyticsService: Service for tracking analytics events.
    init(
        currentUserID: String,
        swapRepository: any SwapRepositoryProtocol,
        userRepository: any UserRepositoryProtocol,
        reviewRepository: any ReviewRepositoryProtocol,
        analyticsService: any AnalyticsServiceProtocol = ConsoleAnalyticsService()
    ) {
        self.currentUserID   = currentUserID
        self.swapRepository  = swapRepository
        self.userRepository  = userRepository
        self.reviewRepository = reviewRepository
        self.analyticsService = analyticsService
    }

    // MARK: - Load

    /// Fetches all active requests and splits them into incoming and outgoing arrays.
    func loadRequests() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let all = try await swapRepository.getRequestsForUser(userID: currentUserID)
            incomingRequests = all
                .filter { $0.recipientID == currentUserID }
                .sorted { $0.createdAt > $1.createdAt }
            outgoingRequests = all
                .filter { $0.requesterID == currentUserID }
                .sorted { $0.createdAt > $1.createdAt }
            logger.info("Loaded \(all.count) requests for user \(self.currentUserID, privacy: .private)")
        } catch {
            logger.error("loadRequests failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = (error as? SwapDogError)?.errorDescription
                ?? "Failed to load requests."
        }
    }

    // MARK: - Status Transitions

    /// Accepts an incoming pending request.
    ///
    /// Tracks `.swapAccepted` analytics event on success.
    /// - Throws: `SwapTransitionError.invalidTransition` if the request is not `.pending`.
    func accept(requestID: String) async throws {
        let request = try findRequest(id: requestID)
        try validateTransition(request: request, to: .accepted)
        try await swapRepository.updateRequestStatus(id: requestID, status: .accepted)
        analyticsService.track(.swapAccepted(requestID: requestID))
        logger.info("Accepted request \(requestID, privacy: .private)")
        await loadRequests()
    }

    /// Declines an incoming pending request.
    ///
    /// - Throws: `SwapTransitionError.invalidTransition` if the request is not `.pending`.
    func decline(requestID: String) async throws {
        let request = try findRequest(id: requestID)
        try validateTransition(request: request, to: .declined)
        try await swapRepository.updateRequestStatus(id: requestID, status: .declined)
        logger.info("Declined request \(requestID, privacy: .private)")
        await loadRequests()
    }

    /// Cancels an outgoing pending request.
    ///
    /// - Throws: `SwapTransitionError.invalidTransition` if the request is not `.pending`.
    func cancel(requestID: String) async throws {
        let request = try findRequest(id: requestID)
        try validateTransition(request: request, to: .cancelled)
        try await swapRepository.updateRequestStatus(id: requestID, status: .cancelled)
        logger.info("Cancelled request \(requestID, privacy: .private)")
        await loadRequests()
    }

    /// Marks an accepted request as complete. Validates that the end date has passed
    /// and increments both participants' swap counts.
    ///
    /// Tracks `.swapCompleted` analytics event on success.
    /// - Throws: `SwapTransitionError.invalidTransition` if not `.accepted`.
    /// - Throws: `SwapTransitionError.endDateNotReached` if today is before `endDate`.
    func markComplete(requestID: String) async throws {
        let request = try findRequest(id: requestID)
        try validateTransition(request: request, to: .completed)

        guard Date() >= request.endDate else {
            throw SwapTransitionError.endDateNotReached
        }

        try await swapRepository.updateRequestStatus(id: requestID, status: .completed)
        await incrementSwapCounts(for: request)
        analyticsService.track(.swapCompleted(requestID: requestID))
        logger.info("Marked request \(requestID, privacy: .private) as complete")
        await loadRequests()
    }

    /// Submits a review for the other party after a completed swap.
    ///
    /// - Parameters:
    ///   - requestID: The completed `SwapRequest` document ID.
    ///   - rating:    Star rating 1–5.
    ///   - text:      Written review text.
    func submitReview(requestID: String, rating: Int, text: String) async throws {
        let request = try findRequest(id: requestID)
        guard request.status == .completed else {
            throw SwapTransitionError.invalidTransition(from: request.status, to: .completed)
        }

        let revieweeID = request.requesterID == currentUserID
            ? request.recipientID
            : request.requesterID

        let review = Review(
            id: UUID().uuidString,
            reviewerID: currentUserID,
            revieweeID: revieweeID,
            swapRequestID: requestID,
            rating: rating,
            text: text,
            createdAt: Date()
        )
        try await reviewRepository.createReview(review)
        logger.info("Submitted review for request \(requestID, privacy: .private)")
    }

    // MARK: - Private Helpers

    /// Finds a request in either the incoming or outgoing list.
    private func findRequest(id: String) throws -> SwapRequest {
        if let req = incomingRequests.first(where: { $0.id == id }) { return req }
        if let req = outgoingRequests.first(where: { $0.id == id }) { return req }
        throw SwapTransitionError.requestNotFound(id: id)
    }

    /// Validates that the transition from the request's current status to `target` is legal.
    ///
    /// Legal transitions:
    /// - `.pending` → `.accepted`, `.declined`, `.cancelled`
    /// - `.accepted` → `.completed`
    ///
    /// All other transitions throw `SwapTransitionError.invalidTransition`.
    private func validateTransition(request: SwapRequest, to target: SwapStatus) throws {
        let allowed: Bool
        switch (request.status, target) {
        case (.pending, .accepted),
             (.pending, .declined),
             (.pending, .cancelled),
             (.accepted, .completed):
            allowed = true
        default:
            allowed = false
        }
        guard allowed else {
            throw SwapTransitionError.invalidTransition(from: request.status, to: target)
        }
    }

    /// Increments `swapCount` for both the requester and recipient.
    private func incrementSwapCounts(for request: SwapRequest) async {
        async let requesterTask: () = incrementCount(for: request.requesterID)
        async let recipientTask: ()  = incrementCount(for: request.recipientID)
        _ = await (requesterTask, recipientTask)
    }

    private func incrementCount(for userID: String) async {
        do {
            var user = try await userRepository.getUser(id: userID)
            user.swapCount += 1
            try await userRepository.updateUser(user)
        } catch {
            logger.error("incrementCount failed for \(userID, privacy: .private): \(error.localizedDescription, privacy: .public)")
        }
    }
}
