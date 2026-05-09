//
//  ChipView.swift
//  SwapDog
//
//  Single display-only chip / tag pill component.
//  Distinct from ChipSelectionView (multi-select input).
//
//  Architecture layer: DesignSystem/Components (pure UI, no business logic)
//

import SwiftUI

// MARK: - ChipView

/// A non-interactive pill-shaped tag for displaying a single label.
///
/// Optionally renders an SF Symbol icon before the text label.
/// Provide `onTap` to make the chip tappable (adds button semantics).
///
/// Default background is `Theme.Colors.surface` with a subtle border.
struct ChipView: View {

    // MARK: - Inputs

    /// Text displayed inside the chip.
    let text: String

    /// Optional SF Symbol name rendered before the text.
    var icon: String? = nil

    /// Background fill color. Defaults to `Theme.Colors.surface`.
    var backgroundColor: Color = Theme.Colors.surface

    /// Foreground (text + icon) color. Defaults to `Theme.Colors.textPrimary`.
    var foregroundColor: Color = Theme.Colors.textPrimary

    /// Optional tap handler. When provided the chip becomes tappable.
    var onTap: (() -> Void)? = nil

    // MARK: - Body

    var body: some View {
        Group {
            if let onTap {
                Button(action: onTap) { label }
                    .buttonStyle(.plain)
            } else {
                label
            }
        }
        .accessibilityLabel(text)
    }

    // MARK: - Label

    private var label: some View {
        HStack(spacing: Theme.Spacing.xs) {
            if let icon {
                Image(systemName: icon)
                    .font(Theme.Typography.caption)
            }
            Text(text)
                .font(Theme.Typography.subheadline)
        }
        .foregroundStyle(foregroundColor)
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.sm)
        .background(backgroundColor)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(Theme.Colors.textSecondary.opacity(0.25), lineWidth: 1)
        )
    }
}

// MARK: - Preview

#Preview("ChipView — Variants") {
    VStack(alignment: .leading, spacing: Theme.Spacing.md) {
        Text("Default (display only)").font(Theme.Typography.footnote)
        ChipView(text: "Friendly")

        Text("With icon").font(Theme.Typography.footnote)
        ChipView(text: "Vaccinated", icon: "checkmark")

        Text("Custom background").font(Theme.Typography.footnote)
        ChipView(
            text: "High Energy",
            icon: "bolt.fill",
            backgroundColor: Theme.Colors.accent.opacity(0.2),
            foregroundColor: Theme.Colors.textPrimary
        )

        Text("Tappable chip").font(Theme.Typography.footnote)
        ChipView(text: "Tap me", icon: "hand.tap") {
            // action
        }
    }
    .padding()
}
