//
//  DeleteAccountView.swift
//  SwapDog
//
//  Standalone delete-account confirmation sheet.
//  Extracted from SettingsView to keep it under 300 lines.
//
//  Architecture layer: Features/Profile (View — no business logic)
//  Locked decision: user must type exactly "DELETE" to enable confirmation.
//

import SwiftUI

// MARK: - DeleteAccountView

/// Sheet that requires the user to type "DELETE" before allowing account deletion.
///
/// The Confirm button is disabled until `confirmationText == "DELETE"`.
/// On success, `ProfileViewModel.deleteAccount()` transitions the app to `.loggedOut`.
struct DeleteAccountView: View {

    // MARK: - Environment

    @EnvironmentObject private var viewModel: ProfileViewModel
    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var confirmationText   = ""
    @State private var showingProgress    = false
    @State private var showingErrorAlert  = false

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: Theme.Spacing.xl) {
                warningHeader
                typedConfirmationField
                confirmButton
                Spacer()
            }
            .padding(.horizontal, Theme.Spacing.xl)
            .padding(.top, Theme.Spacing.xl)
            .screenBackground()
            .navigationTitle("Confirm Deletion")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityLabel("Cancel account deletion")
                }
            }
            .alert("Error", isPresented: $showingErrorAlert) {
                Button("OK") { viewModel.dismissError() }
            } message: {
                Text(viewModel.errorMessage ?? "An error occurred.")
            }
        }
    }

    // MARK: - Sub-Views

    private var warningHeader: some View {
        VStack(spacing: Theme.Spacing.md) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.Colors.error)
                .accessibilityHidden(true)

            Text("Delete Account")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)

            Text("This will permanently delete your profile, all your dogs, and your reviews. This action **cannot be undone**.")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var typedConfirmationField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Type **DELETE** to confirm:")
                .font(Theme.Typography.subheadline)
                .foregroundStyle(Theme.Colors.textPrimary)

            TextField("DELETE", text: $confirmationText)
                .font(Theme.Typography.body)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.characters)
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.background)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                        .stroke(
                            isConfirmed ? Theme.Colors.error : Theme.Colors.textSecondary.opacity(0.3),
                            lineWidth: 1
                        )
                )
                .accessibilityLabel("Type DELETE to confirm account deletion")
        }
    }

    private var confirmButton: some View {
        Button {
            Task { await confirm() }
        } label: {
            if showingProgress {
                ProgressView()
                    .tint(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Spacing.md)
                    .background(Theme.Colors.error)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill, style: .continuous))
            } else {
                Text("Delete My Account")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Spacing.md)
                    .background(isConfirmed ? Theme.Colors.error : Theme.Colors.textSecondary.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill, style: .continuous))
            }
        }
        .disabled(!isConfirmed || showingProgress)
        .accessibilityLabel("Confirm account deletion")
        .accessibilityHint(isConfirmed
            ? "Tap to permanently delete your account"
            : "Type DELETE above to enable this button"
        )
    }

    // MARK: - Helpers

    private var isConfirmed: Bool {
        confirmationText == AppConstants.deleteAccountConfirmationWord
    }

    private func confirm() async {
        showingProgress = true
        defer { showingProgress = false }
        do {
            try await viewModel.deleteAccount()
            dismiss()
        } catch let error as SwapDogError {
            viewModel.errorMessage = error.errorDescription
            showingErrorAlert = true
        } catch {
            viewModel.errorMessage = error.localizedDescription
            showingErrorAlert = true
        }
    }
}

// MARK: - Preview

#Preview {
    DeleteAccountView()
        .environmentObject(
            ProfileViewModel(
                userRepository: MockUserRepository(),
                dogRepository: MockDogRepository(),
                authRepository: MockAuthRepository(),
                reviewRepository: MockReviewRepository(),
                coordinator: AppCoordinator()
            )
        )
}
