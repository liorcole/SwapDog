//
//  SplashView.swift
//  SwapDog
//
//  Launch screen shown while the app checks the persisted auth state
//  via AppCoordinator / authStateChanges().
//
//  Architecture: MVVM-C — View layer.
//  Business logic: NONE. Navigation decisions delegated to AppCoordinator.
//

import SwiftUI

// MARK: - SplashView

/// Displays the SwapDog branding while resolving the user's auth state.
///
/// On appearance, listens to the auth state stream from the repository.
/// Once a state is determined the coordinator transitions to the correct
/// root screen (auth or main app), replacing this view.
struct SplashView: View {

    // MARK: - Dependencies

    @EnvironmentObject private var coordinator: AppCoordinator
    @EnvironmentObject private var container: DependencyContainer

    // MARK: - State

    /// Controls the logo pulsing animation.
    @State private var isAnimating: Bool = false

    // MARK: - Body

    var body: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()

            VStack(spacing: Theme.Spacing.lg) {
                Spacer()

                logoSection

                Text("SwapDog")
                    .font(Theme.Typography.largeTitle)
                    .foregroundStyle(Theme.Colors.primary)
                    .accessibilityAddTraits(.isHeader)

                Text("Dog sitting, reimagined.")
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.textSecondary)

                Spacer()

                ProgressView()
                    .tint(Theme.Colors.primary)
                    .scaleEffect(1.2)
                    .padding(.bottom, Theme.Spacing.xxl)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
            Task {
                await resolveAuthState()
            }
        }
    }

    // MARK: - Subviews

    private var logoSection: some View {
        Text("🐾")
            .font(.system(size: 80))
            .scaleEffect(isAnimating ? 1.05 : 0.95)
            .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true),
                       value: isAnimating)
    }

    // MARK: - Auth State Resolution

    /// Reads the first emission from the auth state stream and transitions the coordinator.
    ///
    /// This is the only place the view interacts with app state — purely by
    /// calling `coordinator.transition(to:)`, which is the coordinator's
    /// responsibility.
    private func resolveAuthState() async {
        let stream = container.authRepository.authStateChanges()
        for await uid in stream {
            if uid != nil {
                coordinator.transition(to: .authenticated)
            } else {
                coordinator.transition(to: .loggedOut)
            }
            // Only consume the first value — the stream is infinite.
            break
        }
    }
}
