//
//  StepProgressBar.swift
//  SwapDog
//
//  Reusable step-progress indicator for multi-step flows.
//  Displays filled / empty dots with animated transitions.
//
//  Architecture layer: DesignSystem/Components (pure UI, no business logic)
//

import SwiftUI

/// A row of step indicator dots for multi-step onboarding and wizard flows.
///
/// Displays one dot per step; the current and all preceding steps are filled
/// using the primary brand colour.  Transitions animate via `.spring()`.
///
/// - Parameters:
///   - currentStep:  0-based index of the active step.
///   - totalSteps:   Total number of steps in the flow.
///   - stepTitles:   Optional per-step labels displayed below each dot.
public struct StepProgressBar: View {

    // MARK: - Inputs

    let currentStep: Int
    let totalSteps: Int
    var stepTitles: [String] = []

    // MARK: - Layout Constants

    private enum Metrics {
        static let dotSize: CGFloat       = 10
        static let activeDotSize: CGFloat = 14
        static let connectorHeight: CGFloat = 2
        static let labelSpacing: CGFloat  = 6
    }

    // MARK: - Body

    public var body: some View {
        VStack(spacing: Metrics.labelSpacing) {
            dotsRow
            if !stepTitles.isEmpty {
                labelsRow
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(currentStep + 1) of \(totalSteps)")
    }

    // MARK: - Subviews

    private var dotsRow: some View {
        HStack(spacing: 0) {
            ForEach(0..<totalSteps, id: \.self) { index in
                dot(for: index)
                if index < totalSteps - 1 {
                    connector(after: index)
                }
            }
        }
    }

    private func dot(for index: Int) -> some View {
        let isActive    = index == currentStep
        let isCompleted = index < currentStep
        let isFilled    = isActive || isCompleted
        let size: CGFloat = isActive ? Metrics.activeDotSize : Metrics.dotSize

        return Circle()
            .fill(isFilled ? Theme.Colors.primary : Theme.Colors.textSecondary.opacity(0.3))
            .frame(width: size, height: size)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentStep)
    }

    private func connector(after index: Int) -> some View {
        let isCompleted = index < currentStep
        return Rectangle()
            .fill(isCompleted ? Theme.Colors.primary : Theme.Colors.textSecondary.opacity(0.3))
            .frame(height: Metrics.connectorHeight)
            .frame(maxWidth: .infinity)
            .animation(.easeInOut(duration: 0.25), value: currentStep)
    }

    private var labelsRow: some View {
        HStack(spacing: 0) {
            ForEach(Array(stepTitles.prefix(totalSteps).enumerated()), id: \.offset) { index, title in
                Text(title)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(
                        index == currentStep ? Theme.Colors.primary : Theme.Colors.textSecondary
                    )
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: Theme.Spacing.xl) {
        StepProgressBar(currentStep: 0, totalSteps: 4)
        StepProgressBar(currentStep: 2, totalSteps: 4)
        StepProgressBar(
            currentStep: 1,
            totalSteps: 4,
            stepTitles: ["Welcome", "Profile", "Dog", "Location"]
        )
    }
    .padding()
}
