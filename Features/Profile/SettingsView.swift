//
//  SettingsView.swift
//  SwapDog
//
//  App settings: notifications, discovery radius, account actions, about.
//  Delete-account confirmation is delegated to DeleteAccountView.
//
//  Architecture layer: Features/Profile (View — no business logic)
//  Locked decisions:
//    - Delete account requires typed "DELETE" confirmation (DeleteAccountView)
//    - Settings persist via UserDefaults (@AppStorage)
//    - Sign-out shows a confirmation alert
//

import SwiftUI

// MARK: - SettingsView

/// Presents notification toggles, discovery radius, account actions, and about information.
struct SettingsView: View {

    // MARK: - Environment

    @EnvironmentObject private var viewModel: ProfileViewModel
    @EnvironmentObject private var coordinator: AppCoordinator
    @Environment(\.dismiss) private var dismiss

    // MARK: - UserDefaults-backed Preferences

    @AppStorage(AppConstants.UserDefaultsKeys.notifySwapRequests) private var notifySwapRequests: Bool   = true
    @AppStorage(AppConstants.UserDefaultsKeys.notifyMessages)     private var notifyMessages:     Bool   = true
    @AppStorage(AppConstants.UserDefaultsKeys.notifyReminders)    private var notifyReminders:    Bool   = true
    @AppStorage(AppConstants.UserDefaultsKeys.searchRadiusMiles)  private var searchRadiusMiles:  Double = AppConstants.defaultSearchRadiusMiles

    // MARK: - Local State

    @State private var showingSignOutAlert        = false
    @State private var showingDeleteAccountSheet  = false
    @State private var showingChangePasswordAlert = false
    @State private var showingErrorAlert          = false

    // MARK: - Body

    var body: some View {
        NavigationStack {
            List {
                notificationsSection
                discoverySection
                accountSection
                aboutSection
                signOutSection
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityLabel("Close settings")
                }
            }
            .alert("Sign Out?", isPresented: $showingSignOutAlert) {
                Button("Sign Out", role: .destructive) { viewModel.signOut() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to sign out?")
            }
            .alert("Coming Soon", isPresented: $showingChangePasswordAlert) {
                Button("OK") {}
            } message: {
                Text("Password change will be available in a future update.")
            }
            .sheet(isPresented: $showingDeleteAccountSheet) {
                DeleteAccountView()
                    .environmentObject(viewModel)
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
    }

    // MARK: - Notifications Section

    private var notificationsSection: some View {
        Section {
            Toggle("Swap Requests", isOn: $notifySwapRequests)
                .accessibilityLabel("Notify me about swap requests")
            Toggle("Messages", isOn: $notifyMessages)
                .accessibilityLabel("Notify me about new messages")
            Toggle("Reminders", isOn: $notifyReminders)
                .accessibilityLabel("Notify me about reminders")
        } header: {
            Text("Notifications")
        }
    }

    // MARK: - Discovery Section

    private var discoverySection: some View {
        Section {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                HStack {
                    Text("Search Radius").font(Theme.Typography.body)
                    Spacer()
                    Text("\(Int(searchRadiusMiles)) mi")
                        .font(Theme.Typography.subheadline)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .monospacedDigit()
                }
                Slider(
                    value: $searchRadiusMiles,
                    in: AppConstants.minSearchRadiusMiles...AppConstants.maxSearchRadiusMiles,
                    step: 1
                ) {
                    Text("Search Radius")
                } minimumValueLabel: {
                    Text("\(Int(AppConstants.minSearchRadiusMiles))mi").font(Theme.Typography.caption)
                } maximumValueLabel: {
                    Text("\(Int(AppConstants.maxSearchRadiusMiles))mi").font(Theme.Typography.caption)
                }
                .tint(Theme.Colors.primary)
                .accessibilityLabel("Search radius slider")
                .accessibilityValue("\(Int(searchRadiusMiles)) miles")
            }
            .padding(.vertical, Theme.Spacing.xs)
        } header: {
            Text("Discovery")
        } footer: {
            Text("Owners within this radius appear in your discovery feed.")
        }
    }

    // MARK: - Account Section

    private var accountSection: some View {
        Section {
            Button {
                showingChangePasswordAlert = true
            } label: {
                Label("Change Password", systemImage: "key")
                    .foregroundStyle(Theme.Colors.textPrimary)
            }
            .accessibilityLabel("Change password (coming soon)")

            Button {
                showingDeleteAccountSheet = true
            } label: {
                Label("Delete Account", systemImage: "person.crop.circle.badge.minus")
                    .foregroundStyle(Theme.Colors.error)
            }
            .accessibilityLabel("Delete your account permanently")
        } header: {
            Text("Account")
        }
    }

    // MARK: - About Section

    private var aboutSection: some View {
        Section {
            HStack {
                Text("Version")
                Spacer()
                Text(appVersion)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .monospacedDigit()
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("App version \(appVersion)")

            if let tosURL = URL(string: AppConstants.termsOfServiceURL) {
                Link(destination: tosURL) {
                    Label("Terms of Service", systemImage: "doc.text")
                        .foregroundStyle(Theme.Colors.textPrimary)
                }
                .accessibilityLabel("View Terms of Service")
            }

            if let ppURL = URL(string: AppConstants.privacyPolicyURL) {
                Link(destination: ppURL) {
                    Label("Privacy Policy", systemImage: "hand.raised")
                        .foregroundStyle(Theme.Colors.textPrimary)
                }
                .accessibilityLabel("View Privacy Policy")
            }
        } header: {
            Text("About")
        }
    }

    // MARK: - Sign Out Section

    private var signOutSection: some View {
        Section {
            Button {
                showingSignOutAlert = true
            } label: {
                Text("Sign Out")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.error)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .accessibilityLabel("Sign out of your account")
        }
    }

    // MARK: - Helpers

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build   = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}

// MARK: - Preview

#Preview {
    SettingsView()
        .environmentObject(
            ProfileViewModel(
                userRepository: MockUserRepository(),
                dogRepository: MockDogRepository(),
                authRepository: MockAuthRepository(),
                reviewRepository: MockReviewRepository(),
                coordinator: AppCoordinator()
            )
        )
        .environmentObject(AppCoordinator())
}
