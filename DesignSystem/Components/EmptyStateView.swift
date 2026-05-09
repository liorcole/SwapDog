//
//  EmptyStateView.swift
//  SwapDog
//
//  Reusable full-screen (or inline) empty state component.
//  Displays an SF Symbol illustration placeholder, title, subtitle,
//  and an optional call-to-action button.
//
//  Architecture layer: DesignSystem/Components (pure UI, no business logic)
//  Locked decisions:
//    - icon is an SF Symbol name string
//    - CTA button is optional; shown only when ctaTitle and ctaAction are provided
//    - All tap targets >= 44x44 pt
//    - VoiceOver reads icon as hidden; title+subtitle+CTA are announced
//

import SwiftUI

// MARK: - EmptyStateView

/// A configurable empty state view with illustration, title, subtitle, and optional CTA.
///
/// Usage:
/// ```swift
/// EmptyStateView(
///     icon: "tray",
///     title: "No requests yet",
///     subtitle: "When someone sends you a swap request it will appear here.",
///     ctaTitle: "Browse Nearby Dogs",
///     ctaAction: { coordinator.showDiscovery() }
/// )
/// ```
struct EmptyStateView: View {

    // MARK: - Inputs

    /// SF Symbol name for the illustration placeholder.
    let icon: String

    /// Short, bold heading.
    let title: String

    /// Supporting detail text.
    let subtitle: String

    /// Label for the call-to-action button. If `nil`, no button is rendered.
    var ctaTitle: String? = nil

    /// Action invoked when the CTA button is tapped. If `nil`, no button is rendered.
    var ctaAction: (() -> Void)? = nil

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                Spacer(minLength: Theme.Spacing.xxl)
                illustrationView
                textStack
                if let title = ctaTitle, let action = ctaAction {
                    ctaButton(title: title, action: action)
                }
                Spacer(minLength: Theme.Spacing.xxl)
            }
            .padding(.horizontal, Theme.Spacing.xl)
            .frame(maxWidth: .infinity)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(combinedAccessibilityLabel)
    }

    // MARK: - Subviews

    private var illustrationView: some View {
        Image(systemName: icon)
            .font(.system(size: 72, weight: .thin))
            .foregroundStyle(Theme.Colors.primary.opacity(0.45))
            .accessibilityHidden(true)
    }

    private var textStack: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Text(title)
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)
                .multilineTextAlignment(.center)

            Text(subtitle)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func ctaButton(title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .primaryButtonStyle()
        }
        .frame(maxWidth: 280)
        .frame(minHeight: 44)
        .accessibilityLabel(title)
        .animation(Theme.Animation.buttonPress, value: true)
    }

    // MARK: - Helpers

    private var combinedAccessibilityLabel: String {
        var parts = [title, subtitle]
        if let cta = ctaTitle { parts.append("Double tap to \(cta).") }
        return parts.joined(separator: ". ")
    }
}

// MARK: - Previews

#Preview("With CTA") {
    EmptyStateView(
        icon: "tray",
        title: "No incoming requests",
        subtitle: "When someone sends you a swap request it will appear here.",
        ctaTitle: "Browse Nearby Dogs",
        ctaAction: {}
    )
    .background(Theme.Colors.background)
}

#Preview("Without CTA") {
    EmptyStateView(
        icon: "pawprint.circle",
        title: "No swappers nearby yet",
        subtitle: "Try expanding your search radius or check back later as SwapDog grows."
    )
    .background(Theme.Colors.background)
}

#Preview("Messages Empty") {
    EmptyStateView(
        icon: "bubble.left.and.bubble.right",
        title: "No messages yet",
        subtitle: "Find a swapper to connect with!",
        ctaTitle: "Find Nearby Owners",
        ctaAction: {}
    )
    .background(Theme.Colors.background)
}

#Preview("Dark Mode") {
    EmptyStateView(
        icon: "star",
        title: "No reviews yet",
        subtitle: "Complete your first swap to get your first review!"
    )
    .background(Theme.Colors.background)
    .preferredColorScheme(.dark)
}
