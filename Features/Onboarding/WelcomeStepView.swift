//
//  WelcomeStepView.swift
//  SwapDog
//
//  First step of the onboarding flow.
//  Full-screen illustration placeholder, headline, 3 value props, CTA.
//
//  Architecture layer: Features/Onboarding (View — no business logic)
//

import SwiftUI

/// Welcome screen — the entry point for post-signup onboarding.
///
/// Displays a paw-print illustration placeholder, the app title, three
/// value-proposition bullets, and a "Get Started" button that advances
/// the `OnboardingCoordinator` to the next step.
struct WelcomeStepView: View {

    // MARK: - Environment

    @EnvironmentObject private var coordinator: OnboardingCoordinator

    // MARK: - Content

    private enum ValueProp: CaseIterable {
        case trusted, trade, community

        var icon: String {
            switch self {
            case .trusted:   return "pawprint.circle.fill"
            case .trade:     return "arrow.triangle.2.circlepath.circle.fill"
            case .community: return "heart.circle.fill"
            }
        }

        var text: String {
            switch self {
            case .trusted:   return "Find trusted dog owners nearby"
            case .trade:     return "Trade sits — no money changes hands"
            case .community: return "Build a community of dog lovers"
            }
        }
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            illustrationSection
            Spacer()
            headlineSection
            Spacer()
            valuePropsSection
            Spacer(minLength: Theme.Spacing.xl)
            getStartedButton
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.bottom, Theme.Spacing.xxl)
        }
        .screenBackground()
    }

    // MARK: - Subviews

    private var illustrationSection: some View {
        VStack(spacing: Theme.Spacing.md) {
            Image(systemName: "pawprint.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 120, height: 120)
                .foregroundStyle(Theme.Colors.primary)
                .padding(Theme.Spacing.xl)
                .background(
                    Circle()
                        .fill(Theme.Colors.primary.opacity(0.1))
                )
        }
    }

    private var headlineSection: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Text("Welcome to SwapDog")
                .font(Theme.Typography.largeTitle)
                .foregroundStyle(Theme.Colors.textPrimary)
                .multilineTextAlignment(.center)

            Text("The peer-to-peer dog-sitting exchange")
                .font(Theme.Typography.subheadline)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, Theme.Spacing.lg)
    }

    private var valuePropsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            ForEach(ValueProp.allCases, id: \.text) { prop in
                valuePropRow(icon: prop.icon, text: prop.text)
            }
        }
        .padding(.horizontal, Theme.Spacing.lg)
    }

    private func valuePropRow(icon: String, text: String) -> some View {
        HStack(spacing: Theme.Spacing.md) {
            Image(systemName: icon)
                .resizable()
                .scaledToFit()
                .frame(width: 28, height: 28)
                .foregroundStyle(Theme.Colors.primary)

            Text(text)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
        }
    }

    private var getStartedButton: some View {
        Button {
            coordinator.nextStep()
        } label: {
            Text("Get Started")
                .primaryButtonStyle()
        }
        .accessibilityLabel("Get Started with SwapDog onboarding")
    }
}

// MARK: - Preview

#Preview {
    WelcomeStepView()
        .environmentObject(OnboardingCoordinator())
}
