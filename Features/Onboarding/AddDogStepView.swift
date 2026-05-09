//
//  AddDogStepView.swift
//  SwapDog
//
//  Step 3: User adds one or more dogs during onboarding.
//  Individual dog fields are rendered by DogFormView (same folder).
//
//  Architecture layer: Features/Onboarding (View — no business logic)
//

import SwiftUI

/// Onboarding step where the user registers their dog(s).
///
/// Supports adding multiple dogs via "Add Another Dog"; each dog's fields
/// are handled by the embedded `DogFormView`.  All input binding and
/// business logic lives in `OnboardingViewModel`.
struct AddDogStepView: View {

    // MARK: - Environment

    @EnvironmentObject private var coordinator: OnboardingCoordinator
    @EnvironmentObject private var viewModel: OnboardingViewModel

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                headerText

                ForEach(viewModel.dogs.indices, id: \.self) { index in
                    DogFormView(index: index, isOnly: viewModel.dogs.count == 1)
                        .environmentObject(viewModel)
                        .cardStyle()
                }

                addAnotherDogButton
                Spacer(minLength: Theme.Spacing.xl)
                navigationButtons
            }
            .padding(Theme.Spacing.lg)
        }
        .screenBackground()
        .hideKeyboardOnTap()
    }

    // MARK: - Header

    private var headerText: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Tell us about your dog")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("This info helps matches find the perfect swap partner.")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Add Another Dog

    private var addAnotherDogButton: some View {
        Button {
            viewModel.addAnotherDog()
        } label: {
            Label("Add Another Dog", systemImage: "plus.circle.fill")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.primary)
                .frame(maxWidth: .infinity)
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.primary.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill, style: .continuous))
        }
        .disabled(viewModel.dogs.count >= AppConstants.maxDogsPerUser)
        .opacity(viewModel.dogs.count >= AppConstants.maxDogsPerUser ? 0.5 : 1)
    }

    // MARK: - Navigation

    private var navigationButtons: some View {
        let canProceed = viewModel.dogs.allSatisfy {
            !$0.name.trimmingCharacters(in: .whitespaces).isEmpty
        }

        return VStack(spacing: Theme.Spacing.sm) {
            Button {
                coordinator.nextStep()
            } label: {
                Text("Next: Set Location")
                    .primaryButtonStyle()
            }
            .disabled(!canProceed)
            .opacity(canProceed ? 1 : 0.5)

            Button {
                coordinator.previousStep()
            } label: {
                Text("Back")
                    .secondaryButtonStyle()
            }
        }
    }
}

// MARK: - Preview

#Preview {
    AddDogStepView()
        .environmentObject(OnboardingCoordinator())
        .environmentObject(OnboardingViewModel(
            userID: "preview_user",
            userEmail: "preview@example.com",
            userRepository: MockUserRepository(),
            dogRepository: MockDogRepository()
        ))
}
