//
//  AuthView.swift
//  SwapDog
//
//  Sign in / sign up UI. Contains ZERO business logic.
//
//  Architectural contract:
//  - Reads only from AuthViewModel's @Published properties.
//  - Calls only AuthViewModel's public methods.
//  - No `async`, no `throws`, no repository imports, no validation logic.
//  - All styling via Theme design system.
//

import SwiftUI

// MARK: - AuthView

/// Presents a tabbed sign-in / sign-up form driven entirely by `AuthViewModel`.
///
/// Business logic lives in `AuthViewModel`. This view only reads published
/// state and forwards user actions to the ViewModel.
struct AuthView: View {

    // MARK: - ViewModel

    @StateObject var viewModel: AuthViewModel

    // MARK: - Body

    var body: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: Theme.Spacing.lg) {
                    headerSection
                    pickerSection
                    formSection
                    submitButton
                }
                .padding(.horizontal, Theme.Spacing.md)
                .padding(.top, Theme.Spacing.xxl)
                .padding(.bottom, Theme.Spacing.xl)
            }

            // Loading overlay
            if viewModel.isLoading {
                loadingOverlay
            }
        }
        // Server error banner (overlay at top)
        .overlay(alignment: .top) {
            if let message = viewModel.errorMessage {
                ErrorBannerView(message: message, onDismiss: viewModel.dismissError)
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.top, Theme.Spacing.sm)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .animation(.easeInOut(duration: 0.3), value: viewModel.errorMessage)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: viewModel.isSignUp)
        .dynamicTypeSize(...DynamicTypeSize.accessibility3)
    }

    // MARK: - Subviews

    private var headerSection: some View {
        VStack(spacing: Theme.Spacing.xs) {
            Text("🐾 SwapDog")
                .font(Theme.Typography.largeTitle)
                .foregroundStyle(Theme.Colors.primary)
            Text(viewModel.isSignUp ? "Create your account" : "Welcome back")
                .font(Theme.Typography.subheadline)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    private var pickerSection: some View {
        Picker("Mode", selection: $viewModel.isSignUp) {
            Text("Sign In").tag(false)
            Text("Sign Up").tag(true)
        }
        .pickerStyle(.segmented)
    }

    private var formSection: some View {
        VStack(spacing: Theme.Spacing.md) {
            // Email field
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                TextField("Email address", text: $viewModel.email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .textFieldStyle(.plain)
                    .padding(Theme.Spacing.md)
                    .background(Theme.Colors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
                            .stroke(viewModel.emailValidationError != nil
                                    ? Theme.Colors.error
                                    : Theme.Colors.fieldBorder,
                                    lineWidth: 1)
                    )
                    .onChange(of: viewModel.email) { viewModel.onEmailChanged() }

                if let error = viewModel.emailValidationError {
                    ValidationErrorText(message: error)
                }
            }

            // Password field
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                SecureField("Password", text: $viewModel.password)
                    .textContentType(viewModel.isSignUp ? .newPassword : .password)
                    .textFieldStyle(.plain)
                    .padding(Theme.Spacing.md)
                    .background(Theme.Colors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
                            .stroke(viewModel.passwordValidationError != nil
                                    ? Theme.Colors.error
                                    : Theme.Colors.fieldBorder,
                                    lineWidth: 1)
                    )
                    .onChange(of: viewModel.password) { viewModel.onPasswordChanged() }

                if let error = viewModel.passwordValidationError {
                    ValidationErrorText(message: error)
                }
            }

            // Confirm-password field (sign-up only)
            if viewModel.isSignUp {
                VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                    SecureField("Confirm password", text: $viewModel.confirmPassword)
                        .textContentType(.newPassword)
                        .textFieldStyle(.plain)
                        .padding(Theme.Spacing.md)
                        .background(Theme.Colors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm))
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
                                .stroke(viewModel.confirmPasswordValidationError != nil
                                        ? Theme.Colors.error
                                        : Theme.Colors.fieldBorder,
                                        lineWidth: 1)
                        )
                        .onChange(of: viewModel.confirmPassword) {
                            viewModel.onConfirmPasswordChanged()
                        }

                    if let error = viewModel.confirmPasswordValidationError {
                        ValidationErrorText(message: error)
                    }
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    private var submitButton: some View {
        Button {
            Task {
                if viewModel.isSignUp {
                    await viewModel.signUp()
                } else {
                    await viewModel.signIn()
                }
            }
        } label: {
            HStack {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text(viewModel.isSignUp ? "Create Account" : "Sign In")
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(viewModel.isFormValid
                        ? Theme.Colors.primary
                        : Theme.Colors.primary.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill))
        }
        .disabled(!viewModel.isFormValid || viewModel.isLoading)
    }

    private var loadingOverlay: some View {
        ZStack {
            Theme.Colors.overlayBackground
                .ignoresSafeArea()
            ProgressView()
                .scaleEffect(1.5)
                .tint(Theme.Colors.primary)
        }
    }
}

// MARK: - ValidationErrorText

/// Small red error label shown beneath an invalid field.
private struct ValidationErrorText: View {
    let message: String

    var body: some View {
        Text(message)
            .font(Theme.Typography.caption)
            .foregroundStyle(Theme.Colors.error)
            .padding(.leading, Theme.Spacing.xs)
    }
}

// MARK: - ErrorBannerView

/// Dismissible top-of-screen banner for server-side errors.
private struct ErrorBannerView: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.Colors.error)
            Text(message)
                .font(Theme.Typography.footnote)
                .foregroundStyle(Theme.Colors.textPrimary)
                .multilineTextAlignment(.leading)
            Spacer()
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            .accessibilityLabel("Dismiss error")
            .frame(minWidth: 44, minHeight: 44)
        }
        .padding(Theme.Spacing.md)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
        .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 4)
    }
}
