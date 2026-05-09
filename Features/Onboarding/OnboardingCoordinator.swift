//
//  OnboardingCoordinator.swift
//  SwapDog
//
//  Coordinator (C layer) for the post-signup onboarding flow.
//  Owns step sequencing and exposes a progress value for the progress bar.
//
//  Architecture layer: Features/Onboarding (Coordinator)
//

import SwiftUI

// MARK: - Step Enum

/// Ordered steps in the post-signup onboarding flow.
///
/// `CaseIterable` lets the coordinator derive `progress` automatically.
/// `Int` raw values define the natural ordering for comparison.
enum OnboardingStep: Int, CaseIterable {
    case welcome       = 0
    case createProfile = 1
    case addDog        = 2
    case setLocation   = 3
    case complete      = 4

    /// Human-readable title used in accessibility and progress labels.
    var title: String {
        switch self {
        case .welcome:       return "Welcome"
        case .createProfile: return "Your Profile"
        case .addDog:        return "Your Dog"
        case .setLocation:   return "Location"
        case .complete:      return "Done"
        }
    }
}

// MARK: - Coordinator

/// Controls the linear step progression of the onboarding flow.
///
/// Inject as an `@EnvironmentObject` or `@StateObject` at the root of the
/// onboarding screen hierarchy so all child step views can call `nextStep()`
/// and `previousStep()` without tight coupling.
@MainActor
final class OnboardingCoordinator: ObservableObject {

    // MARK: - Published State

    /// The currently visible onboarding step.
    @Published private(set) var currentStep: OnboardingStep = .welcome

    // MARK: - Computed Properties

    /// A value in [0, 1] representing overall flow completion.
    ///
    /// Calculated as `currentStep.rawValue / (totalSteps - 1)`.
    /// Returns `1.0` when the user reaches `.complete`.
    var progress: Double {
        let total = Double(OnboardingStep.allCases.count - 1)
        guard total > 0 else { return 0 }
        return Double(currentStep.rawValue) / total
    }

    /// 0-based index of the current step for use with `StepProgressBar`.
    var currentStepIndex: Int { currentStep.rawValue }

    /// Total number of visible steps (excludes the `.complete` terminus).
    var visibleStepCount: Int { OnboardingStep.allCases.count - 1 }

    /// `true` when the user is on the first step and cannot go back.
    var isFirstStep: Bool { currentStep == .welcome }

    /// `true` when the final user-facing step is active.
    var isLastStep: Bool { currentStep == .setLocation }

    // MARK: - Navigation

    /// Advances to the next step.  No-op if already at `.complete`.
    func nextStep() {
        let nextRaw = currentStep.rawValue + 1
        guard let next = OnboardingStep(rawValue: nextRaw) else { return }
        withAnimation(.easeInOut(duration: 0.3)) {
            currentStep = next
        }
    }

    /// Moves back to the previous step.  No-op on `.welcome`.
    func previousStep() {
        let prevRaw = currentStep.rawValue - 1
        guard let previous = OnboardingStep(rawValue: prevRaw) else { return }
        withAnimation(.easeInOut(duration: 0.3)) {
            currentStep = previous
        }
    }

    /// Jumps directly to a specific step (e.g. to recover from a partial failure).
    ///
    /// - Parameter step: The target step.
    func goTo(_ step: OnboardingStep) {
        withAnimation(.easeInOut(duration: 0.3)) {
            currentStep = step
        }
    }
}
