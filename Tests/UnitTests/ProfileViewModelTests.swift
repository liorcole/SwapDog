//
//  ProfileViewModelTests.swift
//  SwapDogTests
//
//  Unit tests for ProfileViewModel.
//
//  Coverage:
//  - Profile update: valid data succeeds
//  - Profile update: empty display name fails
//  - Dog deletion: removes dog from list
//  - Account deletion: clears all data and transitions auth state
//  - isDirty: set to true after name change
//  - isDirty: reset to false after save / primeEditFields
//
//  Rules:
//  - All tests are @MainActor to match the ViewModel.
//  - MockUserRepository, MockDogRepository, MockAuthRepository used throughout.
//  - No network calls — all async operations are in-memory mocks.
//

import XCTest

// MARK: - ProfileViewModelTests

@MainActor
final class ProfileViewModelTests: XCTestCase {

    // MARK: - Helpers

    /// Creates a fresh ProfileViewModel pre-loaded with mock user + dog data.
    private func makeViewModel(
        userError: SwapDogError? = nil,
        dogError: SwapDogError? = nil,
        authError: SwapDogError? = nil
    ) -> (ProfileViewModel, MockUserRepository, MockDogRepository, MockAuthRepository, AppCoordinator) {
        let userRepo = MockUserRepository()
        userRepo.stubbedError = userError

        let dogRepo = MockDogRepository()
        dogRepo.stubbedError = dogError

        let authRepo = MockAuthRepository()
        authRepo.stubbedError = authError

        let reviewRepo = MockReviewRepository()
        let coordinator = AppCoordinator()

        let vm = ProfileViewModel(
            userRepository: userRepo,
            dogRepository: dogRepo,
            authRepository: authRepo,
            reviewRepository: reviewRepo,
            coordinator: coordinator
        )
        // Seed with mock user so profile is "loaded"
        vm.user = .mock
        vm.dogs = [.mock]
        vm.primeEditFields(from: .mock)

        return (vm, userRepo, dogRepo, authRepo, coordinator)
    }

    // MARK: - Profile Update: Valid Data

    /// Saving with a valid display name updates the local user and clears isDirty.
    func testUpdateProfile_withValidData_succeeds() async {
        let (vm, userRepo, _, _, _) = makeViewModel()
        vm.editDisplayName = "New Name"
        vm.isDirty = true

        try? await vm.saveProfile()

        XCTAssertEqual(vm.user?.displayName, "New Name",
                       "User display name should update to the saved value")
        XCTAssertFalse(vm.isDirty, "isDirty should be false after a successful save")
        XCTAssertEqual(userRepo.updateUserCallCount, 1,
                       "updateUser should be called exactly once")
        XCTAssertNil(vm.errorMessage, "No error should be set on success")
    }

    // MARK: - Profile Update: Invalid Data

    /// Saving with an empty display name throws a ValidationError.
    func testUpdateProfile_withEmptyName_fails() async {
        let (vm, userRepo, _, _, _) = makeViewModel()
        vm.editDisplayName = "   "   // whitespace only — effectively empty

        do {
            try await vm.saveProfile()
            XCTFail("saveProfile should have thrown for empty display name")
        } catch {
            XCTAssertTrue(
                error is ValidationError,
                "Error should be ValidationError, got: \(type(of: error))"
            )
        }

        XCTAssertEqual(userRepo.updateUserCallCount, 0,
                       "updateUser should not be called when validation fails")
    }

    // MARK: - Dog Deletion

    /// Deleting a dog removes it from the local dogs array and calls the repository.
    func testDeleteDog_removesDogFromList() async {
        let (vm, _, dogRepo, _, _) = makeViewModel()
        XCTAssertEqual(vm.dogs.count, 1)

        try? await vm.deleteDog(id: Dog.mock.id)

        XCTAssertEqual(vm.dogs.count, 0,
                       "Dog should be removed from local list after deletion")
        XCTAssertEqual(dogRepo.deleteDogCallCount, 1,
                       "deleteDog should be called exactly once on the repository")
    }

    /// Dog repository error propagates and leaves the local list unchanged.
    func testDeleteDog_repositoryError_listUnchanged() async {
        let (vm, _, _, _, _) = makeViewModel(dogError: .networkError)
        XCTAssertEqual(vm.dogs.count, 1)

        do {
            try await vm.deleteDog(id: Dog.mock.id)
            XCTFail("deleteDog should propagate the repository error")
        } catch {
            // Expected
        }

        XCTAssertEqual(vm.dogs.count, 1,
                       "Dogs list should be unchanged after a failed deletion")
    }

    // MARK: - Account Deletion

    /// deleteAccount calls auth repo, wipes local data, and transitions to loggedOut.
    func testDeleteAccount_clearsAllData() async {
        let (vm, _, dogRepo, authRepo, coordinator) = makeViewModel()
        coordinator.transition(to: .authenticated)

        try? await vm.deleteAccount()

        XCTAssertEqual(dogRepo.deleteDogCallCount, 1,
                       "All user dogs should be deleted from Firestore")
        XCTAssertEqual(authRepo.deleteAccountCallCount, 1,
                       "Firebase Auth account should be deleted")
        XCTAssertEqual(coordinator.authState, .loggedOut,
                       "Coordinator should transition to loggedOut after account deletion")
    }

    /// deleteAccount with auth repository error propagates and does NOT transition state.
    func testDeleteAccount_authError_stateUnchanged() async {
        let (vm, _, _, _, coordinator) = makeViewModel(authError: .unauthorized)
        coordinator.transition(to: .authenticated)

        do {
            try await vm.deleteAccount()
            XCTFail("deleteAccount should propagate auth error")
        } catch {
            // Expected
        }

        XCTAssertEqual(coordinator.authState, .authenticated,
                       "Auth state should not change when deletion fails")
    }

    // MARK: - isDirty Tracking

    /// isDirty becomes true after modifying editDisplayName via markDirty().
    func testIsDirty_afterNameChange_isTrue() {
        let (vm, _, _, _, _) = makeViewModel()
        XCTAssertFalse(vm.isDirty, "isDirty should start false")

        vm.editDisplayName = "Changed Name"
        vm.markDirty()

        XCTAssertTrue(vm.isDirty, "isDirty should be true after a field change")
    }

    /// isDirty resets to false after primeEditFields(from:) is called.
    func testIsDirty_afterReset_isFalse() {
        let (vm, _, _, _, _) = makeViewModel()
        vm.editDisplayName = "Dirty State"
        vm.isDirty = true

        vm.primeEditFields(from: .mock)

        XCTAssertFalse(vm.isDirty, "isDirty should be false after primeEditFields")
        XCTAssertEqual(vm.editDisplayName, User.mock.displayName,
                       "editDisplayName should be reset to the user's current value")
    }

    /// isDirty resets to false after a successful saveProfile().
    func testIsDirty_afterSuccessfulSave_isFalse() async {
        let (vm, _, _, _, _) = makeViewModel()
        vm.editDisplayName = "Valid Name"
        vm.isDirty = true

        try? await vm.saveProfile()

        XCTAssertFalse(vm.isDirty, "isDirty should be false after saveProfile succeeds")
    }

    // MARK: - Error Clearing

    /// dismissError() clears the errorMessage.
    func testDismissError_clearsErrorMessage() {
        let (vm, _, _, _, _) = makeViewModel()
        vm.errorMessage = "Some error"

        vm.dismissError()

        XCTAssertNil(vm.errorMessage, "errorMessage should be nil after dismissError()")
    }

    // MARK: - Load Profile

    /// loadProfile fetches user, dogs, and reviews in parallel and populates published properties.
    func testLoadProfile_populatesPublishedState() async {
        let (vm, _, _, _, _) = makeViewModel()
        // Reset so we actually exercise load
        vm.user = nil
        vm.dogs = []
        vm.reviews = []

        await vm.loadProfile()

        XCTAssertNotNil(vm.user, "User should be loaded after loadProfile()")
        XCTAssertFalse(vm.isLoading, "isLoading should be false after load completes")
        XCTAssertNil(vm.errorMessage, "No error should be set on successful load")
    }
}
