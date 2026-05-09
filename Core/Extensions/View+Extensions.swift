//
//  View+Extensions.swift
//  SwapDog
//
//  Reusable SwiftUI view modifiers and convenience extensions.
//  Keep each extension focused — structural mods here, animation helpers elsewhere.

import SwiftUI

// MARK: - Card Style

extension View {

    /// Applies the SwapDog standard card appearance: white surface, corner radius, subtle shadow.
    /// - Parameters:
    ///   - cornerRadius: Corner rounding. Defaults to `Theme.CornerRadius.md`.
    ///   - padding: Internal padding. Defaults to `Theme.Spacing.md`.
    func cardStyle(
        cornerRadius: CGFloat = Theme.CornerRadius.md,
        padding: CGFloat = Theme.Spacing.md
    ) -> some View {
        self
            .padding(padding)
            .background(Theme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
    }

    // MARK: - Primary Button Style

    /// Applies the SwapDog primary button appearance: orange fill, white text, full-width.
    func primaryButtonStyle() -> some View {
        self
            .font(Theme.Typography.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.md)
            .background(Theme.Colors.primary)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill, style: .continuous))
    }

    // MARK: - Secondary Button Style

    /// Applies the SwapDog secondary (outline) button appearance.
    func secondaryButtonStyle() -> some View {
        self
            .font(Theme.Typography.headline)
            .foregroundStyle(Theme.Colors.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.md)
            .background(Theme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.pill, style: .continuous)
                    .stroke(Theme.Colors.primary, lineWidth: 1.5)
            )
    }

    // MARK: - Screen Background

    /// Fills the view's background with the app background color and ignores safe area.
    func screenBackground() -> some View {
        self.background(Theme.Colors.background.ignoresSafeArea())
    }

    // MARK: - Hide Keyboard

    /// Dismisses the software keyboard when tapping outside a text field.
    func hideKeyboardOnTap() -> some View {
        self.onTapGesture {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil, from: nil, for: nil
            )
        }
    }

    // MARK: - Conditional Modifier

    /// Applies a modifier only when `condition` is `true`.
    ///
    /// Usage: `.if(isLoading) { $0.redacted(reason: .placeholder) }`
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// MARK: - Loading Overlay

extension View {

    /// Overlays a semi-transparent loading spinner when `isLoading` is `true`.
    func loadingOverlay(_ isLoading: Bool) -> some View {
        self.overlay {
            if isLoading {
                ZStack {
                    Theme.Colors.overlayBackground.ignoresSafeArea()
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                        .scaleEffect(1.5)
                }
            }
        }
    }
}

// MARK: - Animations

extension View {

    /// Applies a scale-down press effect to buttons via a `ButtonStyle`-compatible approach.
    ///
    /// Usage: `.buttonStyle(ScaleButtonStyle())`
    func animatedPress() -> some View {
        self.buttonStyle(PressScaleButtonStyle())
    }

    /// Applies a fade-in + rise-up card appear transition.
    ///
    /// Use on cards/rows when they first appear in a LazyVStack.
    func cardAppearTransition() -> some View {
        self
            .transition(.opacity.combined(with: .move(edge: .bottom)))
            .animation(Theme.Animation.cardAppear, value: true)
    }
}

// MARK: - PressScaleButtonStyle

/// A ButtonStyle that scales down 0.96× on press and back to 1.0 on release.
struct PressScaleButtonStyle: ButtonStyle {

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(Theme.Animation.buttonPress, value: configuration.isPressed)
    }
}

// MARK: - Dynamic Type Safety Cap

extension View {

    /// Caps Dynamic Type at `.accessibility3` (XXL).
    ///
    /// Apply to container views that have been verified not to break at XXL.
    /// Use on scroll views, cards, and forms — not on individual text elements.
    func dynamicTypeCapped() -> some View {
        self.dynamicTypeSize(...DynamicTypeSize.accessibility3)
    }
}
