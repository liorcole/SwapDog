//
//  IntegrationTests2.swift
//  SwapDogTests
//
//  Continuation of IntegrationTests — Message Flow and Review After Swap.
//
//  Split from IntegrationTests.swift to keep each file under 300 lines.
//  (Part 1 covers: testSignUpToDiscoveryFlow, testSwapRequestLifecycle.)
//
//  Rules:
//  - All tests are @MainActor to match the ViewModel thread requirements.
//  - Mock repositories only — no Firebase / network calls.
//

import XCTest

// MARK: - IntegrationTests2

@MainActor
final class IntegrationTests2: XCTestCase {

    // =========================================================================
    // MARK: - 3. Message Flow
    // =========================================================================
    //
    // Scenario: Sender sends a message in a conversation. Verifies:
    //   - Message appears in mock store after send
    //   - Conversation's lastMessage and lastMessageTimestamp update
    //   - ChatViewModel clears messageText on successful send
    //

    func testMessageFlow() async throws {

        let messagingRepo  = MockMessagingRepository()
        let conversationID = "conv_integration_001"
        let senderID       = "usr_sender_001"
        let receiverID     = "usr_receiver_001"

        // Pre-populate with a conversation (no messages yet)
        messagingRepo.messages      = []
        messagingRepo.conversations = [
            Conversation(
                id:                   conversationID,
                participantIDs:       [senderID, receiverID],
                lastMessage:          nil,
                lastMessageTimestamp: nil,
                unreadCount:          [senderID: 0, receiverID: 0]
            )
        ]

        // Start ChatViewModel
        let chatVM = ChatViewModel(
            conversationID:      conversationID,
            currentUserID:       senderID,
            otherUser:           nil,
            messagingRepository: messagingRepo
        )

        chatVM.startListening()
        try await Task.sleep(for: .milliseconds(50))
        XCTAssertEqual(chatVM.messages.count, 0, "No messages initially")

        // Send a message
        chatVM.messageText = "Hi! Would you like to swap this weekend?"
        await chatVM.sendMessage()

        XCTAssertEqual(messagingRepo.sendMessageCallCount, 1)
        XCTAssertNil(chatVM.sendErrorMessage)
        XCTAssertTrue(chatVM.messageText.isEmpty,
                      "messageText should be cleared after successful send")

        // Verify in mock store
        XCTAssertEqual(messagingRepo.messages.count, 1)
        let sentMessage = messagingRepo.messages.first
        XCTAssertEqual(sentMessage?.senderID, senderID)
        XCTAssertEqual(sentMessage?.text, "Hi! Would you like to swap this weekend?")
        XCTAssertEqual(sentMessage?.conversationID, conversationID)

        // Verify conversation preview updated
        let conversation = messagingRepo.conversations.first(where: { $0.id == conversationID })
        XCTAssertEqual(conversation?.lastMessage,
                       "Hi! Would you like to swap this weekend?",
                       "Conversation lastMessage should update after send")
        XCTAssertNotNil(conversation?.lastMessageTimestamp)

        chatVM.stopListening()
    }

    // =========================================================================
    // MARK: - 4. Review After Swap
    // =========================================================================
    //
    // Scenario: After a completed swap, the requester leaves a 5-star review
    //   for the recipient. Verifies:
    //   - Review is persisted via reviewRepository.createReview
    //   - Review appears in recipient's review list
    //   - ProfileViewModel surfaces the review after reload
    //

    func testReviewAfterSwap() async throws {

        let userRepo   = MockUserRepository()
        let reviewRepo = MockReviewRepository()
        let authRepo   = MockAuthRepository()

        userRepo.users    = []
        reviewRepo.reviews = []

        let reviewerID = "usr_reviewer_001"
        let revieweeID = "usr_reviewee_001"

        let reviewer = makeUser(id: reviewerID, displayName: "Alice",
                                rating: 5.0, reviewCount: 3, swapCount: 5)
        var reviewee = makeUser(id: revieweeID, displayName: "Bob",
                                rating: 4.0, reviewCount: 2, swapCount: 5)
        userRepo.users = [reviewer, reviewee]

        // Submit a 5-star review
        let review = Review(
            id:            UUID().uuidString,
            reviewerID:    reviewerID,
            revieweeID:    revieweeID,
            swapRequestID: "swap_completed_001",
            rating:        5,
            text:          "Amazing host! Dog was perfectly cared for.",
            createdAt:     Date()
        )
        try await reviewRepo.createReview(review)

        XCTAssertEqual(reviewRepo.createReviewCallCount, 1)
        XCTAssertEqual(reviewRepo.reviews.count, 1)

        // Verify review appears in reviewee's list
        let reviews = try await reviewRepo.getReviews(userID: revieweeID)
        XCTAssertEqual(reviews.count, 1)
        XCTAssertEqual(reviews.first?.rating, 5)
        XCTAssertEqual(reviews.first?.reviewerID, reviewerID)

        // Simulate rating update (normally a Cloud Function)
        let totalRating    = (reviewee.rating * Double(reviewee.reviewCount)) + Double(review.rating)
        let newReviewCount = reviewee.reviewCount + 1
        reviewee.rating      = totalRating / Double(newReviewCount)
        reviewee.reviewCount = newReviewCount
        try await userRepo.updateUser(reviewee)

        let stored = userRepo.users.first(where: { $0.id == revieweeID })
        XCTAssertEqual(stored?.reviewCount, 3)
        XCTAssertEqual(stored?.rating ?? 0,
                       (4.0 * 2 + 5.0) / 3.0,
                       accuracy: 0.001)

        // Verify ProfileViewModel loads the review
        authRepo.stubbedAuthState = revieweeID
        userRepo.users[userRepo.users.firstIndex(where: { $0.id == revieweeID })!] = reviewee

        let profileVM = ProfileViewModel(
            userRepository:   userRepo,
            dogRepository:    MockDogRepository(),
            authRepository:   authRepo,
            reviewRepository: reviewRepo,
            coordinator:      AppCoordinator()
        )
        await profileVM.loadProfile()

        XCTAssertEqual(profileVM.reviews.count, 1)
        XCTAssertEqual(profileVM.reviews.first?.rating, 5)
        XCTAssertEqual(profileVM.user?.reviewCount, 3)
    }

    // =========================================================================
    // MARK: - Private Factory Helpers
    // =========================================================================

    private func makeUser(
        id:          String,
        displayName: String,
        rating:      Double = 0.0,
        reviewCount: Int    = 0,
        swapCount:   Int    = 0
    ) -> User {
        User(
            id:              id,
            email:           "\(id)@swapdog.com",
            displayName:     displayName,
            profileImageURL: nil,
            latitude:        40.7831,
            longitude:       -73.9712,
            neighborhood:    "Upper West Side",
            bio:             "Test user",
            joinedDate:      Date(),
            isVerified:      false,
            rating:          rating,
            reviewCount:     reviewCount,
            dogs:            [],
            swapCount:       swapCount
        )
    }
}
