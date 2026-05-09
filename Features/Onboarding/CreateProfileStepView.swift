//
//  CreateProfileStepView.swift
//  SwapDog
//
//  Step 2: User sets display name, bio, and profile photo.
//  Bio counter reads from OnboardingViewModel (business logic lives in VM).
//
//  Architecture layer: Features/Onboarding (View — no business logic)
//

import SwiftUI
import PhotosUI

/// Onboarding step where the user sets up their public profile.
///
/// - Display name is required; "Next" button is disabled until it's filled.
/// - Bio character counter updates in real time; truncation is enforced in the VM.
/// - Photo picker supports camera and photo library via PhotosUI.
struct CreateProfileStepView: View {

    // MARK: - Environment

    @EnvironmentObject private var coordinator: OnboardingCoordinator
    @EnvironmentObject private var viewModel: OnboardingViewModel

    // MARK: - Local State

    @State private var selectedPhotoItem: PhotosPickerItem?

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                headerText
                photoPickerSection
                nameField
                bioSection
                Spacer(minLength: Theme.Spacing.xl)
                navigationButtons
            }
            .padding(Theme.Spacing.lg)
        }
        .screenBackground()
        .hideKeyboardOnTap()
        .onChange(of: selectedPhotoItem) { _, item in
            loadPhoto(item)
        }
    }

    // MARK: - Subviews

    private var headerText: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Create your profile")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("Tell the SwapDog community about yourself.")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var photoPickerSection: some View {
        VStack(spacing: Theme.Spacing.sm) {
            PhotosPicker(
                selection: $selectedPhotoItem,
                matching: .images,
                photoLibrary: .shared()
            ) {
                profileImageView
            }
            Text("Add a photo (optional)")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    private var profileImageView: some View {
        Group {
            if let data = viewModel.profileImageData,
               let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "person.crop.circle.badge.plus")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(Theme.Colors.primary)
                    .padding(Theme.Spacing.lg)
            }
        }
        .frame(width: 100, height: 100)
        .clipShape(Circle())
        .background(
            Circle()
                .fill(Theme.Colors.surface)
                .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 2)
        )
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Label("Display Name *", systemImage: "person.fill")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            TextField("Your full name", text: $viewModel.displayName)
                .font(Theme.Typography.body)
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                        .stroke(
                            viewModel.isDisplayNameValid
                                ? Theme.Colors.primary.opacity(0.6)
                                : Theme.Colors.textSecondary.opacity(0.3),
                            lineWidth: 1
                        )
                )
                .textContentType(.name)
                .submitLabel(.next)
        }
    }

    private var bioSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            HStack {
                Label("Bio", systemImage: "text.bubble.fill")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Spacer()
                // Live counter — bound to VM's bioCharacterCount
                Text("\(viewModel.bioCharacterCount)/200")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(
                        viewModel.bioCharacterCount >= 190
                            ? Theme.Colors.error
                            : Theme.Colors.textSecondary
                    )
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.1), value: viewModel.bioCharacterCount)
            }

            TextEditor(text: $viewModel.bio)
                .font(Theme.Typography.body)
                .frame(minHeight: 100)
                .padding(Theme.Spacing.sm)
                .background(Theme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                        .stroke(Theme.Colors.textSecondary.opacity(0.3), lineWidth: 1)
                )

            Text("Describe yourself to potential swap partners.")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    private var navigationButtons: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Button {
                coordinator.nextStep()
            } label: {
                Text("Next: Add Your Dog")
                    .primaryButtonStyle()
            }
            .disabled(!viewModel.isDisplayNameValid)
            .opacity(viewModel.isDisplayNameValid ? 1 : 0.5)

            Button {
                coordinator.previousStep()
            } label: {
                Text("Back")
                    .secondaryButtonStyle()
            }
        }
    }

    // MARK: - Private

    private func loadPhoto(_ item: PhotosPickerItem?) {
        guard let item else { return }
        Task {
            if let data = try? await item.loadTransferable(type: Data.self) {
                let compressed = viewModel.compressImage(data)
                await MainActor.run {
                    viewModel.profileImageData = compressed ?? data
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    CreateProfileStepView()
        .environmentObject(OnboardingCoordinator())
        .environmentObject(OnboardingViewModel(
            userID: "preview_user",
            userEmail: "preview@example.com",
            userRepository: MockUserRepository(),
            dogRepository: MockDogRepository()
        ))
}
