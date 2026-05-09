//
//  AuthViewModel.swift
//  SwapDog
//
//  ViewModel for the authentication flow (sign in and sign up).
//  Owns all validation, async network calls, and state published to AuthView.
//
//  Architecture: MVVM-C — ViewModel layer.
//  Calls AuthRepositoryProtocol; never imports Firebase directly.
//  Co-ordinates auth state transitions through AppCoordinator.
//
//  Locked decisions enforced here:
//  - Password never stored beyond the @Published property; never logged.
//  - Error messages are user-friendly strings mapped from SwapDogError.
//  - Validation is debounced at 0.5 s (not per-keystroke).
//  - No force-unwraps.
//
//  Step 15: Added AnalyticsServiceProtocol injection.
//           Tracks .userSignedUp on successful sign-up.
//

import Foundation
import os

// MARK: - AuthViewModel

/// Drives the sign-in / sign-up UI.
///
/// Published properties are observed directly by `AuthView`. All mutations
/// happen on `@MainActor` so UI updates are safe.
@MainActor
final class AuthViewModel: ObservableObject {

    // MARK: - Published Input State

    /// User-entered email address.
    @Published var email: String = ""

    /// User-entered password (never logged or persisted beyond this property).
    @Published var password: String = ""

    /// Confirm-password field (sign-up only). Never logged.
    @Published var confirmPassword: String = ""

    /// Toggles between sign-in (`false`) and sign-up (`true`) modes.
    @Published var isSignUp: Bool = false

    // MARK: - Published Output State

    /// Whether a network operation is in flight (shows ProgressView).
    @Published var isLoading: Bool = false

    /// User-visible server error shown in the error banner; `nil` clears the banner.
    @Published var errorMessage: String?

    // MARK: - Published Validation Errors

    /// Inline error shown below the email field after debounce.
    @Published var emailValidationError: String?

    /// Inline error shown below the password field after debounce.
    @Published var passwordValidationError: String?

    /// Inline error shown below the confirm-password field after debounce.
    @Published var confirmPasswordValidationError: String?

    // MARK: - Computed

    /// Whether all fields pass validation and the submit button should be enabled.
    var isFormValid: Bool {
        let baseValid = validateEmail() == nil && validatePassword() == nil
        if isSignUp {
            return baseValid && validateConfirmPassword() == nil
        }
        return baseValid
    }

    // MARK: - Dependencies

    private let authRepository: any AuthRepositoryProtocol
    private weak var coordinator: AppCoordinator?
    private let analyticsService: any AnalyticsServiceProtocol
    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
                                category: "AuthViewModel")

    // MARK: - Debounce Tasks

    private var emailDebounceTask: Task<Void, Never>?
    private var passwordDebounceTask: Task<Void, Never>?
    private var confirmPasswordDebounceTask: Task<Void, Never>?

    // MARK: - Init

    /// - Parameters:
    ///   - authRepository:  The auth repository (real or mock).
    ///   - coordinator:     Root coordinator for transitioning auth state.
    ///   - analyticsService: Analytics service for event tracking.
    init(
        authRepository: any AuthRepositoryProtocol,
        coordinator: AppCoordinator,
        analyticsService: any AnalyticsServiceProtocol = ConsoleAnalyticsService()
    ) {
        self.authRepository  = authRepository
        self.coordinator     = coordinator
        self.analyticsService = analyticsService
    }

    // MARK: - Validation (pure, return optional error string)

    /// Validates the current email string against an RFC-5322–inspired regex.
    ///
    /// - Returns: `nil` if valid, or a user-friendly error string.
    func validateEmail() -> String? {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return "Email address is required." }
        if trimmed.contains(" ") { return "Email address cannot contain spaces." }
        let pattern = #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#
        let predicate = NSPredicate(format: "SELF MATCHES %@", pattern)
        if !predicate.evaluate(with: trimmed) {
            return "Please enter a valid email address."
        }
        return nil
    }

    /// Validates the current password: min 8 chars, 1 uppercase, 1 digit.
    ///
    /// - Returns: `nil` if valid, or a user-friendly error string.
    func validatePassword() -> String? {
        if password.isEmpty { return "Password is required." }
        if password.count < 8 { return "Password must be at least 8 characters." }
        let uppercasePattern = ".*[A-Z]+.*"
        let numberPattern = ".*[0-9]+.*"
        let hasUppercase = NSPredicate(format: "SELF MATCHES %@", uppercasePattern)
            .evaluate(with: password)
        let hasNumber = NSPredicate(format: "SELF MATCHES %@", numberPattern)
            .evaluate(with: password)
        if !hasUppercase { return "Password must contain at least one uppercase letter." }
        if !hasNumber { return "Password must contain at least one number." }
        return nil
    }

    /// Validates that the confirm-password field matches the password field.
    ///
    /// - Returns: `nil` if they match, or a user-friendly error string.
    func validateConfirmPassword() -> String? {
        if confirmPassword.isEmpty { return "Please confirm your password." }
        if confirmPassword != password { return "Passwords do not match." }
        return nil
    }

    // MARK: - Debounced Validation Triggers

    /// Call from `AuthView.onChange(of: email)` to trigger debounced validation.
    func onEmailChanged() {
        emailDebounceTask?.cancel()
        emailDebounceTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            emailValidationError = validateEmail()
        }
    }

    /// Call from `AuthView.onChange(of: password)` to trigger debounced validation.
    func onPasswordChanged() {
        passwordDebounceTask?.cancel()
        passwordDebounceTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            passwordValidationError = validatePassword()
            // Re-validate confirm when password changes (sign-up mode).
            if isSignUp && !confirmPassword.isEmpty {
                confirmPasswordValidationError = validateConfirmPassword()
            }
        }
    }

    /// Call from `AuthView.onChange(of: confirmPassword)` to trigger debounced validation.
    func onConfirmPasswordChanged() {
        confirmPasswordDebounceTask?.cancel()
        confirmPasswordDebounceTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            confirmPasswordValidationError = validateConfirmPassword()
        }
    }

    // MARK: - Actions

    /// Creates a new account; transitions coordinator to `.onboarding` on success.
    ///
    /// Validates all fields before making a network call. Sets `errorMessage`
    /// on failure with a user-friendly description.
    /// Tracks `.userSignedUp` analytics event on success.
    func signUp() async {
        guard validateEmail() == nil else {
            emailValidationError = validateEmail()
            return
        }
        guard validatePassword() == nil else {
            passwordValidationError = validatePassword()
            return
        }
        guard validateConfirmPassword() == nil else {
            confirmPasswordValidationError = validateConfirmPassword()
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            _ = try await authRepository.signUp(email: email, password: password)
            logger.info("Sign-up succeeded for email hash: \(self.email.hashValue)")
            analyticsService.track(.userSignedUp)
            coordinator?.transition(to: .onboarding)
        } catch let error as SwapDogError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = SwapDogError.unknown(error).errorDescription
        }
    }

    /// Signs in with existing credentials; transitions coordinator to `.authenticated` on success.
    ///
    /// Sets `errorMessage` on failure with a user-friendly description.
    func signIn() async {
        guard validateEmail() == nil else {
            emailValidationError = validateEmail()
            return
        }
        guard validatePassword() == nil else {
            passwordValidationError = validatePassword()
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            _ = try await authRepository.signIn(email: email, password: password)
            logger.info("Sign-in succeeded for email hash: \(self.email.hashValue)")
            coordinator?.transition(to: .authenticated)
        } catch let error as SwapDogError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = SwapDogError.unknown(error).errorDescription
        }
    }

    /// Signs out and resets the coordinator to `.loggedOut`.
    func signOut() {
        do {
            try authRepository.signOut()
            clearFields()
            coordinator?.transition(to: .loggedOut)
        } catch let error as SwapDogError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = SwapDogError.unknown(error).errorDescription
        }
    }

    /// Dismisses the server error banner.
    func dismissError() {
        errorMessage = nil
    }

    // MARK: - Private Helpers

    private func clearFields() {
        email = ""
        password = ""
        confirmPassword = ""
        emailValidationError = nil
        passwordValidationError = nil
        confirmPasswordValidationError = nil
        errorMessage = nil
    }
}
