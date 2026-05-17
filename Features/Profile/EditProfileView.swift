//
//  EditProfileView.swift
//  SwapDog
//
//  Edit the current user's display name, bio, photo, and location.
//  Guards unsaved changes on back-swipe and Cancel.
//
//  Architecture layer: Features/Profile (View — no business logic)
//  Locked decisions:
//    - Unsaved changes detection: isDirty gate on dismiss
//    - ValidationService validates display name and bio
//    - All images use CachedAsyncImage / PhotosPicker
//

import SwiftUI
import PhotosUI

// MARK: - EditProfileView

/// Allows the authenticated user to edit their display name, bio, photo, and neighbourhood.
///
/// Shows a "Discard changes?" confirmation alert when dismissing with unsaved edits.
/// Save triggers loading state and commits via `ProfileViewModel.saveProfile()`.
struct EditProfileView: View {

    // MARK: - Environment

    @EnvironmentObject private var viewModel: ProfileViewModel
    @Environment(\.dismiss) private var dismiss

    // MARK: - Local State

    @State private var showingDiscardAlert = false
    @State private var showingValidationError = false
    @State private var validationMessage = ""
    @State private var photoPickerItem: PhotosPickerItem?

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Theme.Spacing.lg) {
                    photoSection
                    nameSection
                    bioSection
                    locationSection
                }
                .padding(.horizontal, Theme.Spacing.md)
                .padding(.vertical, Theme.Spacing.lg)
            }
            .screenBackground()
            .hideKeyboardOnTap()
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .toolbar { toolbarContent }
            .loadingOverlay(viewModel.isLoading)
            .alert("Discard Changes?", isPresented: $showingDiscardAlert) {
                Button("Discard", role: .destructive) { dismissToProfile() }
                Button("Keep Editing", role: .cancel) {}
            } message: {
                Text("You have unsaved changes. Discard them?")
            }
            .alert("Invalid Input", isPresented: $showingValidationError) {
                Button("OK") {}
            } message: {
                Text(validationMessage)
            }
            .interactiveDismissDisabled(viewModel.isDirty)
            .onChange(of: photoPickerItem) { _, item in
                Task { await loadPhoto(item) }
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") {
                if viewModel.isDirty {
                    showingDiscardAlert = true
                } else {
                    dismissToProfile()
                }
            }
            .accessibilityLabel("Cancel editing")
        }
        ToolbarItem(placement: .confirmationAction) {
            Button("Save") {
                Task { await save() }
            }
            .font(Theme.Typography.headline)
            .foregroundStyle(Theme.Colors.primary)
            .disabled(viewModel.isLoading)
            .accessibilityLabel("Save profile changes")
        }
    }

    // MARK: - Photo Section

    private var photoSection: some View {
        VStack(spacing: Theme.Spacing.sm) {
            if let imageData = viewModel.editProfileImageData,
               let uiImage = UIImage(data: imageData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 100, height: 100)
                    .clipShape(Circle())
                    .accessibilityLabel("Profile photo preview")
            } else {
                CachedAsyncImage(
                    urlString: viewModel.user?.profileImageURL,
                    cornerRadius: Theme.CornerRadius.pill,
                    size: CGSize(width: 100, height: 100)
                )
                .frame(width: 100, height: 100)
                .accessibilityLabel("Current profile photo")
            }

            PhotosPicker(
                selection: $photoPickerItem,
                matching: .images,
                photoLibrary: .shared()
            ) {
                Text("Change Photo")
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.primary)
            }
            .accessibilityLabel("Change profile photo")
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Display Name Section

    private var nameSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Label("Display Name *", systemImage: "person.fill")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            TextField("Your name", text: $viewModel.editDisplayName)
                .font(Theme.Typography.body)
                .textContentType(.name)
                .autocorrectionDisabled()
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.background)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                        .stroke(Theme.Colors.textSecondary.opacity(0.3), lineWidth: 1)
                )
                .onChange(of: viewModel.editDisplayName) { _, _ in viewModel.markDirty() }
                .accessibilityLabel("Display name field")
        }
    }

    // MARK: - Bio Section

    private var bioSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            HStack {
                Label("Bio", systemImage: "text.alignleft")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Spacer()
                Text("\(viewModel.editBio.count)/500")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }

            TextEditor(text: $viewModel.editBio)
                .font(Theme.Typography.body)
                .frame(minHeight: 100)
                .padding(Theme.Spacing.sm)
                .background(Theme.Colors.background)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                        .stroke(Theme.Colors.textSecondary.opacity(0.3), lineWidth: 1)
                )
                .onChange(of: viewModel.editBio) { _, _ in viewModel.markDirty() }
                .accessibilityLabel("Bio text editor")
        }
    }

    // MARK: - Location Section

    private var locationSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Label("Neighbourhood", systemImage: "mappin.circle")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            TextField("e.g. Upper West Side", text: $viewModel.editNeighborhood)
                .font(Theme.Typography.body)
                .textContentType(.addressCity)
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.background)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                        .stroke(Theme.Colors.textSecondary.opacity(0.3), lineWidth: 1)
                )
                .onChange(of: viewModel.editNeighborhood) { _, _ in viewModel.markDirty() }
                .accessibilityLabel("Neighbourhood field")
        }
    }

    // MARK: - Actions

    private func save() async {
        do {
            try await viewModel.saveProfile()
            dismiss()
        } catch let error as ValidationError {
            validationMessage = error.errorDescription ?? "Validation failed."
            showingValidationError = true
        } catch let error as SwapDogError {
            validationMessage = error.errorDescription ?? "Save failed."
            showingValidationError = true
        } catch {
            validationMessage = error.localizedDescription
            showingValidationError = true
        }
    }

    private func dismissToProfile() {
        if let user = viewModel.user {
            viewModel.primeEditFields(from: user)
        }
        dismiss()
    }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        if let data = try? await item.loadTransferable(type: Data.self) {
            viewModel.editProfileImageData = data
            viewModel.markDirty()
        }
    }
}

// MARK: - Preview

#Preview {
    let vm: ProfileViewModel = {
        let v = ProfileViewModel(
            userRepository: MockUserRepository(),
            dogRepository: MockDogRepository(),
            authRepository: MockAuthRepository(),
            reviewRepository: MockReviewRepository(),
            coordinator: AppCoordinator()
        )
        v.user = .mock
        v.primeEditFields(from: .mock)
        return v
    }()
    return EditProfileView()
        .environmentObject(vm)
}
