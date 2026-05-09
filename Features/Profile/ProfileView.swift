//
//  ProfileView.swift
//  SwapDog
//
//  The current user's own profile screen.
//  Navigation host: delegates content to ProfileBodyView.
//
//  Architecture layer: Features/Profile (View — no business logic)
//  Locked decisions:
//    - All images use CachedAsyncImage
//    - All interactive elements have VoiceOver accessibility labels
//    - Every screen has loading, error, and empty states
//

import SwiftUI

// MARK: - ProfileView

/// Root navigation container for the authenticated user's profile.
///
/// Owns sheet triggers and the navigation toolbar. Content is
/// delegated to `ProfileBodyView` to keep this file under 300 lines.
struct ProfileView: View {

    // MARK: - Environment

    @EnvironmentObject private var viewModel: ProfileViewModel
    @EnvironmentObject private var coordinator: AppCoordinator

    // MARK: - Local State

    @State private var showingEditProfile    = false
    @State private var showingSettings       = false
    @State private var showingErrorAlert     = false

    // MARK: - Body

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.user == nil {
                    loadingView
                } else if let user = viewModel.user {
                    ProfileBodyView(
                        user: user,
                        onEditProfile: { showingEditProfile = true }
                    )
                    .environmentObject(viewModel)
                } else {
                    emptyStateView
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .toolbar { toolbarContent }
            .sheet(isPresented: $showingEditProfile) {
                EditProfileView()
                    .environmentObject(viewModel)
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
                    .environmentObject(viewModel)
                    .environmentObject(coordinator)
            }
            .alert("Error", isPresented: $showingErrorAlert) {
                Button("OK") { viewModel.dismissError() }
            } message: {
                Text(viewModel.errorMessage ?? "An error occurred.")
            }
            .onChange(of: viewModel.errorMessage) { _, newValue in
                if newValue != nil { showingErrorAlert = true }
            }
        }
        .task { await viewModel.loadProfile() }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarTrailing) {
            Button {
                showingSettings = true
            } label: {
                Image(systemName: "gearshape")
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .accessibilityLabel("Settings")
            }
        }
    }

    // MARK: - Loading / Empty

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.lg) {
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(1.2)
            Text("Loading profile…")
                .font(Theme.Typography.subheadline)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .screenBackground()
    }

    private var emptyStateView: some View {
        ErrorView(
            type: .generic,
            message: "We couldn't load your profile. Pull down to refresh.",
            retryAction: { Task { await viewModel.loadProfile() } }
        )
    }
}

// MARK: - Preview

#Preview {
    let vm = ProfileViewModel(
        userRepository: MockUserRepository(),
        dogRepository: MockDogRepository(),
        authRepository: MockAuthRepository(),
        reviewRepository: MockReviewRepository(),
        coordinator: AppCoordinator()
    )
    ProfileView()
        .environmentObject(vm)
        .environmentObject(AppCoordinator())
}
