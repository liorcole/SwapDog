//
//  SwapRequestCreationTests.swift
//  SwapDogTests
//
//  Continuation of SwapRequestTests — covers request creation scenarios.
//
//  Split from SwapRequestTests.swift to keep each file under 300 lines.
//  (Original file covered: Date Validation, Status Transition Validation.)
//
//  Convention:
//  - All tests are @MainActor to match the ViewModels.
//  - MockSwapRepository and MockMessagingRepository for all async operations.
//  - No Firestore calls — all state is in-memory.
//

import XCTest

// MARK: - SwapRequestCreationTests

@MainActor
final class SwapRequestCreationTests: XCTestCase {

    // MARK: - Helpers (duplicated for test isolation)

    private func makeCreateVM(
        currentUser:       User     = .mock,
        currentUserDogs:   [Dog]    = [.mock],
        recipient:         User     = makeRecipient(),
        recipientDogs:     [Dog]    = [makeRecipientDog()],
        swapError:         SwapDogError? = nil,
        messagingError:    SwapDogError? = nil
    ) -> (CreateSwapViewModel, MockSwapRepository, MockMessagingRepository) {
        let swapRepo = MockSwapRepository()
        swapRepo.stubbedError = swapError
        let msgRepo = MockMessagingRepository()
        msgRepo.stubbedError = messagingError
        let vm = CreateSwapViewModel(
            currentUser:          currentUser,
            currentUserDogs:      currentUserDogs,
            recipient:            recipient,
            recipientDogs:        recipientDogs,
            swapRepository:       swapRepo,
            messagingRepository:  msgRepo
        )
        return (vm, swapRepo, msgRepo)
    }

    private static func makeRecipient() -> User {
        User(
            id:              "usr_recipient",
            email:           "recipient@example.com",
            displayName:     "Recipient",
            profileImageURL: nil,
            latitude:        40.78,
            longitude:       -73.97,
            neighborhood:    nil,
            bio:             "",
            joinedDate:      Date(),
            isVerified:      false,
            rating:          4.0,
            reviewCount:     0,
            dogs:            ["dog_recipient"],
            swapCount:       0
        )
    }

    private static func makeRecipientDog() -> Dog {
        Dog(
            id:             "dog_recipient",
            ownerID:        "usr_recipient",
            name:           "Max",
            breed:          "Beagle",
            age:            .adult,
            size:           .medium,
            energyLevel:    .moderate,
            temperament:    [],
            specialNeeds:   nil,
            vaccinated:     true,
            spayedNeutered: true,
            photos:         [],
            bio:            ""
        )
    }

    private func validDates() -> (start: Date, end: Date) {
        let cal      = Calendar.current
        let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: Date()))!
        let end      = cal.date(byAdding: .day, value: 3, to: tomorrow)!
        return (tomorrow, end)
    }

    // MARK: - Request Creation

    func testCreateRequest_withNoDogs_fails() async {
        let (vm, swapRepo, _) = makeCreateVM()
        let (start, end) = validDates()
        vm.startDate = start
        vm.endDate   = end
        // No dogs selected — selectedDogIDs is empty

        vm.requestSubmission()

        // Should NOT show confirmation alert; form is invalid
        XCTAssertFalse(vm.showConfirmationAlert)
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertEqual(swapRepo.createRequestCallCount, 0)
    }

    func testCreateRequest_valid_succeeds() async {
        let (vm, swapRepo, _) = makeCreateVM()
        let (start, end) = validDates()
        vm.startDate = start
        vm.endDate   = end
        vm.toggleDog(id: Dog.mock.id)

        await vm.confirmSubmission()

        XCTAssertTrue(vm.didSubmitSuccessfully)
        XCTAssertEqual(swapRepo.createRequestCallCount, 1)
        XCTAssertNil(vm.errorMessage)
    }

    func testCreateRequest_repositoryError_setsErrorMessage() async {
        let (vm, _, _) = makeCreateVM(swapError: .networkError)
        let (start, end) = validDates()
        vm.startDate = start
        vm.endDate   = end
        vm.toggleDog(id: Dog.mock.id)

        await vm.confirmSubmission()

        XCTAssertFalse(vm.didSubmitSuccessfully,
                       "Submission should fail when repository throws")
        XCTAssertNotNil(vm.errorMessage,
                        "Error message should be set when repository fails")
    }

    func testCreateRequest_createsConversation() async {
        let (vm, _, msgRepo) = makeCreateVM()
        let (start, end) = validDates()
        vm.startDate = start
        vm.endDate   = end
        vm.toggleDog(id: Dog.mock.id)

        // Pre-populate with empty conversation store so ensureConversationExists creates one
        msgRepo.conversations = []

        await vm.confirmSubmission()

        XCTAssertTrue(vm.didSubmitSuccessfully)
        XCTAssertGreaterThan(
            msgRepo.sendMessageCallCount,
            0,
            "Expected a system message to be sent when auto-creating a conversation"
        )
    }

    func testCreateRequest_existingConversation_doesNotDuplicate() async {
        let (vm, _, msgRepo) = makeCreateVM()
        let (start, end) = validDates()
        vm.startDate = start
        vm.endDate   = end
        vm.toggleDog(id: Dog.mock.id)

        // The mock already has a conversation between the two users from .mock
        let initialConversationCount = msgRepo.conversations.count

        await vm.confirmSubmission()

        XCTAssertTrue(vm.didSubmitSuccessfully)
        // Should not create a duplicate conversation
        XCTAssertEqual(msgRepo.conversations.count, initialConversationCount,
                       "Should not create a duplicate conversation when one already exists")
    }
}
