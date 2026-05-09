//
//  AuthViewModelTests.swift
//  SwapDogTests
//
//  Unit tests for AuthViewModel.
//
//  Coverage:
//  - Email validation (6 cases)
//  - Password validation (4 cases)
//  - Sign-up success / failure
//  - Sign-in success / failure
//  - Sign-out resets coordinator state
//
//  Rules:
//  - All tests are @MainActor to match the ViewModel.
//  - MockAuthRepository configures behaviour via stubbedError / stubbedUser.
//  - No network calls — all async operations are in-memory.
//

import XCTest

// MARK: - AuthViewModelTests

@MainActor
final class AuthViewModelTests: XCTestCase {

    // MARK: - Helpers

    /// Creates a fresh ViewModel with an independent mock repository and coordinator.
    private func makeViewModel(
        stubbedError: SwapDogError? = nil,
        stubbedUser: User = .mock
    ) -> (AuthViewModel, MockAuthRepository, AppCoordinator) {
        let mock = MockAuthRepository()
        mock.stubbedError = stubbedError
        mock.stubbedUser = stubbedUser
        let coordinator = AppCoordinator()
        let vm = AuthViewModel(authRepository: mock, coordinator: coordinator)
        return (vm, mock, coordinator)
    }

    // MARK: - Email Validation

    func testValidEmail_withCorrectFormat_returnsNil() {
        let (vm, _, _) = makeViewModel()
        vm.email = "user@example.com"
        XCTAssertNil(vm.validateEmail())
    }

    func testValidEmail_withValidComplexEmail_returnsNil() {
        let (vm, _, _) = makeViewModel()
        vm.email = "first.last+tag@sub.domain.io"
        XCTAssertNil(vm.validateEmail())
    }

    func testValidEmail_withEmptyString_returnsError() {
        let (vm, _, _) = makeViewModel()
        vm.email = ""
        XCTAssertNotNil(vm.validateEmail())
    }

    func testValidEmail_withNoAtSymbol_returnsError() {
        let (vm, _, _) = makeViewModel()
        vm.email = "userexample.com"
        XCTAssertNotNil(vm.validateEmail())
    }

    func testValidEmail_withNoDomain_returnsError() {
        let (vm, _, _) = makeViewModel()
        vm.email = "user@"
        XCTAssertNotNil(vm.validateEmail())
    }

    func testValidEmail_withSpaces_returnsError() {
        let (vm, _, _) = makeViewModel()
        vm.email = "user @example.com"
        XCTAssertNotNil(vm.validateEmail())
    }

    // MARK: - Password Validation

    func testValidPassword_withStrongPassword_returnsNil() {
        let (vm, _, _) = makeViewModel()
        vm.password = "SecurePass1"
        XCTAssertNil(vm.validatePassword())
    }

    func testValidPassword_withShortPassword_returnsError() {
        let (vm, _, _) = makeViewModel()
        vm.password = "Ab1"
        let error = vm.validatePassword()
        XCTAssertNotNil(error)
        XCTAssertTrue(error!.contains("8"), "Error should mention minimum length")
    }

    func testValidPassword_withNoUppercase_returnsError() {
        let (vm, _, _) = makeViewModel()
        vm.password = "securepass1"
        let error = vm.validatePassword()
        XCTAssertNotNil(error)
        XCTAssertTrue(error!.lowercased().contains("uppercase"),
                      "Error should mention uppercase requirement")
    }

    func testValidPassword_withNoNumber_returnsError() {
        let (vm, _, _) = makeViewModel()
        vm.password = "SecurePassword"
        let error = vm.validatePassword()
        XCTAssertNotNil(error)
        XCTAssertTrue(error!.lowercased().contains("number"),
                      "Error should mention number requirement")
    }

    // MARK: - Sign-Up

    func testSignUpSuccess_updatesAuthState() async {
        let (vm, mock, coordinator) = makeViewModel()
        vm.email = "new@example.com"
        vm.password = "ValidPass1"
        vm.confirmPassword = "ValidPass1"
        vm.isSignUp = true

        await vm.signUp()

        XCTAssertEqual(mock.signUpCallCount, 1)
        XCTAssertEqual(coordinator.authState, .onboarding)
        XCTAssertFalse(vm.isLoading)
        XCTAssertNil(vm.errorMessage)
    }

    func testSignUpFailure_setsErrorMessage() async {
        let (vm, mock, coordinator) = makeViewModel(
            stubbedError: .accountCreationFailed("Email already in use.")
        )
        vm.email = "taken@example.com"
        vm.password = "ValidPass1"
        vm.confirmPassword = "ValidPass1"
        vm.isSignUp = true

        await vm.signUp()

        XCTAssertEqual(mock.signUpCallCount, 1)
        XCTAssertEqual(coordinator.authState, .loggedOut,
                       "Auth state must not change on failure")
        XCTAssertFalse(vm.isLoading)
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertFalse(vm.errorMessage!.isEmpty,
                       "Error message must be user-readable")
    }

    // MARK: - Sign-In

    func testSignInSuccess_updatesAuthState() async {
        let (vm, mock, coordinator) = makeViewModel()
        vm.email = "existing@example.com"
        vm.password = "ValidPass1"

        await vm.signIn()

        XCTAssertEqual(mock.signInCallCount, 1)
        XCTAssertEqual(coordinator.authState, .authenticated)
        XCTAssertFalse(vm.isLoading)
        XCTAssertNil(vm.errorMessage)
    }

    func testSignInFailure_setsErrorMessage() async {
        let (vm, mock, coordinator) = makeViewModel(stubbedError: .unauthorized)
        vm.email = "bad@example.com"
        vm.password = "ValidPass1"

        await vm.signIn()

        XCTAssertEqual(mock.signInCallCount, 1)
        XCTAssertEqual(coordinator.authState, .loggedOut,
                       "Auth state must not change on failure")
        XCTAssertFalse(vm.isLoading)
        XCTAssertNotNil(vm.errorMessage)
    }

    // MARK: - Sign-Out

    func testSignOut_resetsToLoggedOut() async {
        // Arrange: start authenticated
        let (vm, mock, coordinator) = makeViewModel()
        coordinator.transition(to: .authenticated)

        // Act
        vm.signOut()

        // Assert
        XCTAssertEqual(mock.signOutCallCount, 1)
        XCTAssertEqual(coordinator.authState, .loggedOut)
        XCTAssertNil(vm.errorMessage)
    }
}
