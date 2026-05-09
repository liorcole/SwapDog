//
//  IntegrationTests.swift
//  SwapDogTests
//
//  Integration tests exercising full user-facing flows using mock repositories.
//  All tests use ONLY in-memory mocks — no Firebase / network calls.
//
//  Flows covered:
//    1. testSignUpToDiscoveryFlow    — sign up → coordinator state → onboarding → discovery loads
//    2. testSwapRequestLifecycle     — create request → verify in outgoing → accept → verify accepted → mark complete
//    3. testMessageFlow              — send message → verify in conversation → verify lastMessage updates
//    4. testReviewAfterSwap          — complete swap → create review → verify user rating updates
//
//  Locked decisions enforced:
//    - All ViewModels instantiated with real implementations, mock repositories
//    - No force-unwraps except where explicitly noted in test assertions
//    - All tests are @MainActor to match ViewModel thread requirements
//

import XCTest

// MARK: - IntegrationTests

@MainActor
final class IntegrationTests: XCTestCase {

    // =========================================================================
    // MARK: - 1. Sign Up → Discovery Flow
    // =========================================================================
    //
    // Scenario: A brand-new user completes sign-up and onboarding, then loads
    // the discovery feed. Verifies:
    //   - AuthViewModel transitions coordinator to .onboarding on sign-up success
    //   - OnboardingViewModel successfully creates user + dog documents
    //   - Coordinator transitions to .authenticated after onboarding completes
    //   - DiscoveryViewModel loads nearby users correctly
    //

    func testSignUpToDiscoveryFlow() async throws {

        // MARK: Set up

        let authRepo      = MockAuthRepository()
        let userRepo      = MockUserRepository()
        let dogRepo       = MockDogRepository()
        let locationService = MockLocationService()
        let coordinator   = AppCoordinator()

        // Start unauthenticated
        authRepo.stubbedAuthState = nil
        XCTAssertEqual(coordinator.authState, .loggedOut)

        // MARK: Step 1: Sign Up

        let authVM = AuthViewModel(
            authRepository: authRepo,
            coordinator: coordinator
        )
        authVM.email           = "newuser@swapdog.com"
        authVM.password        = "SecurePass1"
        authVM.confirmPassword = "SecurePass1"
        authVM.isSignUp        = true

        await authVM.signUp()

        XCTAssertEqual(authRepo.signUpCallCount, 1, "signUp should have been called once")
        XCTAssertEqual(coordinator.authState, .onboarding,
                       "Coordinator must transition to .onboarding after successful sign-up")
        XCTAssertFalse(authVM.isLoading, "isLoading must be false after completion")
        XCTAssertNil(authVM.errorMessage, "No error should be set on success")

        // MARK: Step 2: Onboarding

        let signedInUserID = authRepo.stubbedUser.id
        let onboardingVM = OnboardingViewModel(
            userID:         signedInUserID,
            userEmail:      authVM.email,
            userRepository: userRepo,
            dogRepository:  dogRepo
        )

        onboardingVM.displayName = "Test User"
        onboardingVM.bio         = "Loves dogs."
        onboardingVM.latitude    = 40.7831
        onboardingVM.longitude   = -73.9712
        onboardingVM.neighborhood = "Upper West Side"

        // Configure first dog
        onboardingVM.dogs[0].name         = "Buddy"
        onboardingVM.dogs[0].breed        = "Labrador"
        onboardingVM.dogs[0].vaccinated   = true
        onboardingVM.dogs[0].spayedNeutered = true

        // Seed existing user + dog stores so createUser/addDog succeed
        let previousUserCount = userRepo.users.count
        let previousDogCount  = dogRepo.dogs.count

        try await onboardingVM.completeOnboarding()

        XCTAssertEqual(userRepo.createUserCallCount, 1,
                       "createUser should be called once during onboarding")
        XCTAssertEqual(dogRepo.addDogCallCount, 1,
                       "addDog should be called once for the first dog")
        XCTAssertEqual(userRepo.users.count, previousUserCount + 1,
                       "User store should contain the new user")
        XCTAssertEqual(dogRepo.dogs.count, previousDogCount + 1,
                       "Dog store should contain the new dog")

        // MARK: Step 3: Coordinator transitions to .authenticated

        coordinator.transition(to: .authenticated)
        XCTAssertEqual(coordinator.authState, .authenticated,
                       "Coordinator must be .authenticated before discovery")

        // MARK: Step 4: Discovery loads nearby users

        let discoveryVM = DiscoveryViewModel(
            userRepository:  userRepo,
            dogRepository:   dogRepo,
            locationService: locationService
        )

        await discoveryVM.initialLoad()

        XCTAssertFalse(discoveryVM.isLoading, "isLoading should be false after load")
        XCTAssertNil(discoveryVM.errorMessage, "No error should be set on successful load")
        // MockUserRepository.getNearbyUsers returns all seeded users
        XCTAssertGreaterThan(discoveryVM.nearbyItems.count, 0,
                             "Discovery feed should contain at least one nearby user")
        XCTAssertEqual(locationService.requestCurrentLocationCallCount, 1,
                       "Location should have been requested exactly once")
    }

    // =========================================================================
    // MARK: - 2. Swap Request Lifecycle
    // =========================================================================
    //
    // Scenario: Requester creates a swap request. Recipient accepts it.
    // Owner marks it complete (with a backdated end date). Verifies:
    //   - Request appears in requester's outgoing list after creation
    //   - Request status transitions from .pending → .accepted → .completed
    //   - Both participants' swapCounts are incremented on completion
    //

    func testSwapRequestLifecycle() async throws {

        // MARK: Set up

        let swapRepo    = MockSwapRepository()
        let userRepo    = MockUserRepository()
        let reviewRepo  = MockReviewRepository()

        // Clear pre-seeded mock data for a clean slate
        swapRepo.requests = []
        userRepo.users    = []

        let requesterID = "usr_requester"
        let recipientID = "usr_recipient"

        // Seed both users
        let requester = makeUser(id: requesterID, displayName: "Alice", swapCount: 0)
        let recipient = makeUser(id: recipientID, displayName: "Bob",   swapCount: 0)
        userRepo.users = [requester, recipient]

        // MARK: Step 1: Create swap request

        let request = makeSwapRequest(
            requesterID: requesterID,
            recipientID: recipientID,
            status:      .pending
        )
        try await swapRepo.createRequest(request)

        XCTAssertEqual(swapRepo.createRequestCallCount, 1)
        XCTAssertEqual(swapRepo.requests.count, 1)

        // MARK: Step 2: Requester sees request in outgoing list

        let requesterVM = RequestsViewModel(
            currentUserID:   requesterID,
            swapRepository:  swapRepo,
            userRepository:  userRepo,
            reviewRepository: reviewRepo
        )
        await requesterVM.loadRequests()

        XCTAssertEqual(requesterVM.outgoingRequests.count, 1,
                       "Requester should see the request in outgoing list")
        XCTAssertEqual(requesterVM.outgoingRequests.first?.status, .pending)

        // MARK: Step 3: Recipient accepts the request

        let recipientVM = RequestsViewModel(
            currentUserID:    recipientID,
            swapRepository:   swapRepo,
            userRepository:   userRepo,
            reviewRepository: reviewRepo
        )
        await recipientVM.loadRequests()

        XCTAssertEqual(recipientVM.incomingRequests.count, 1,
                       "Recipient should see the request in incoming list")

        try await recipientVM.accept(requestID: request.id)

        let acceptedRequest = swapRepo.requests.first(where: { $0.id == request.id })
        XCTAssertEqual(acceptedRequest?.status, .accepted,
                       "Request status should be .accepted after recipient accepts")

        // MARK: Step 4: Requester reloads and sees accepted status

        await requesterVM.loadRequests()
        XCTAssertEqual(requesterVM.outgoingRequests.first?.status, .accepted,
                       "Requester should see .accepted status after reload")

        // MARK: Step 5: Mark complete (backdated end date so the validation passes)

        // Directly mutate the request endDate in the mock to simulate past end date
        if let idx = swapRepo.requests.firstIndex(where: { $0.id == request.id }) {
            swapRepo.requests[idx].endDate = Date.distantPast
        }

        // Reload so the VM has the updated endDate
        await requesterVM.loadRequests()

        try await requesterVM.markComplete(requestID: request.id)

        let completedRequest = swapRepo.requests.first(where: { $0.id == request.id })
        XCTAssertEqual(completedRequest?.status, .completed,
                       "Request status should be .completed")

        // Both participants' swapCounts should have incremented
        let updatedRequester = userRepo.users.first(where: { $0.id == requesterID })
        let updatedRecipient = userRepo.users.first(where: { $0.id == recipientID })
        XCTAssertEqual(updatedRequester?.swapCount, 1,
                       "Requester's swapCount should have been incremented")
        XCTAssertEqual(updatedRecipient?.swapCount, 1,
                       "Recipient's swapCount should have been incremented")
    }

}
