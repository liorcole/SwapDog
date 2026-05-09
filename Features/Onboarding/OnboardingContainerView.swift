//
//  OnboardingContainerView.swift
//  SwapDog
//
//  Root wrapper view for the post-signup onboarding flow.
//  Owns OnboardingCoordinator and OnboardingViewModel; switches on
//  currentStep to render the appropriate child step view.
//
//  Architecture layer: Features/Onboarding (View — no business logic)
//

import SwiftUI

/// Top-level container for the post-signup onboarding flow.
///
/// Instantiates and owns the `OnboardingCoordinator` and `OnboardingViewModel`,
/// then injects both as `@EnvironmentObject` so all child step views can
/// read/mutate shared state without tight coupling.
///
/// When `coordinator.currentStep` reaches `.complete`, this view calls
/// `appCoordinator.transition(to: .authenticated)` to hand off to the
/// authenticated shell.
struct OnboardingContainerView: View {

    // MARK: - Environment

    @EnvironmentObject private var appCoordinator: AppCoordinator

    // MARK: - Owned State

    @StateObject private var coordinator = OnboardingCoordinator()
    @StateObject private var viewModel: OnboardingViewModel

    // MARK: - Init

    /// - Parameters:
    ///   - userID:          Firebase UID of the authenticated user.
    ///   - userEmail:       Email address from Firebase Auth.
    ///   - userRepository:  Injected user repository (production or mock).
    ///   - dogRepository:   Injected dog repository (production or mock).
    init(
        userID: String,
        userEmail: String,
        userRepository: any UserRepositoryProtocol,
        dogRepository: any DogRepositoryProtocol
    ) {
        _viewModel = StateObject(wrappedValue: OnboardingViewModel(
            userID: userID,
            userEmail: userEmail,
            userRepository: userRepository,
            dogRepository: dogRepository
        ))
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            if coordinator.currentStep != .welcome && coordinator.currentStep != .complete {
                progressBar
            }

            stepContent
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .leading).combined(with: .opacity)
                ))
                .animation(.easeInOut(duration: 0.3), value: coordinator.currentStep)
        }
        .loadingOverlay(viewModel.isLoading)
        .alert("Something went wrong", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") { viewModel.errorMessage = nil }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
        .onChange(of: coordinator.currentStep) { _, newStep in
            if newStep == .complete {
                handleCompletion()
            }
        }
        .environmentObject(coordinator)
        .environmentObject(viewModel)
    }

    // MARK: - Subviews

    private var progressBar: some View {
        StepProgressBar(
            currentStep: coordinator.currentStepIndex - 1, // welcome is step 0 (hidden)
            totalSteps: coordinator.visibleStepCount - 1,  // exclude .complete
            stepTitles: ["Profile", "Dog", "Location"]
        )
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.top, Theme.Spacing.md)
        .padding(.bottom, Theme.Spacing.sm)
        .background(Theme.Colors.background)
    }

    @ViewBuilder
    private var stepContent: some View {
        switch coordinator.currentStep {
        case .welcome:
            WelcomeStepView()
        case .createProfile:
            CreateProfileStepView()
        case .addDog:
            AddDogStepView()
        case .setLocation:
            SetLocationStepView()
        case .complete:
            completionView
        }
    }

    private var completionView: some View {
        VStack(spacing: Theme.Spacing.lg) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 100, height: 100)
                .foregroundStyle(Theme.Colors.primary)

            Text("You're all set!")
                .font(Theme.Typography.largeTitle)
                .foregroundStyle(Theme.Colors.textPrimary)

            Text("Getting your profile ready…")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)

            ProgressView()
                .progressViewStyle(.circular)
                .tint(Theme.Colors.primary)
            Spacer()
        }
        .screenBackground()
    }

    // MARK: - Private

    private func handleCompletion() {
        Task {
            do {
                try await viewModel.completeOnboarding()
                appCoordinator.transition(to: .authenticated)
            } catch {
                viewModel.errorMessage = (error as? SwapDogError)?.errorDescription
                    ?? "Failed to save your profile. Please try again."
                // Roll back to last user-facing step so user can retry.
                coordinator.goTo(.setLocation)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    OnboardingContainerView(
        userID: "preview_user",
        userEmail: "preview@example.com",
        userRepository: MockUserRepository(),
        dogRepository: MockDogRepository()
    )
    .environmentObject(AppCoordinator())
}
