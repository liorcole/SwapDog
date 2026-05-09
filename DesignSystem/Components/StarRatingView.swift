//
//  StarRatingView.swift
//  SwapDog
//
//  Renders a row of filled, half-filled, and empty stars for a given Double rating.
//  Supports 0.0–5.0 with half-star precision.
//
//  Architecture layer: DesignSystem/Components (pure UI, no business logic)
//

import SwiftUI

// MARK: - StarRatingView

/// Displays a 5-star rating indicator with half-star support.
///
/// Pass a `Double` from 0.0 to 5.0. Each position renders as:
/// - Filled star   (star.fill)                   for full integer values
/// - Half star     (star.leadinghalf.filled)      for .25–.74 fractions
/// - Empty star    (star)                         otherwise
///
/// VoiceOver announces the numeric value, e.g. "4.5 out of 5 stars".
struct StarRatingView: View {

    // MARK: - Inputs

    /// Rating value in the range 0.0–5.0.
    let rating: Double

    /// Size of each star glyph. Defaults to 16 pt.
    var starSize: CGFloat = 16

    /// Spacing between stars. Defaults to 2 pt.
    var spacing: CGFloat = 2

    // MARK: - Constants

    private let totalStars = 5

    // MARK: - Body

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(0..<totalStars, id: \.self) { index in
                starImage(for: index)
                    .font(.system(size: starSize))
                    .foregroundStyle(fillColor(for: index))
            }
        }
        .accessibilityElement()
        .accessibilityLabel(accessibilityLabel)
    }

    // MARK: - Star Image

    /// Returns the appropriate SF Symbol for star at `index`.
    private func starImage(for index: Int) -> Image {
        let threshold = Double(index + 1)
        let half = Double(index) + 0.5

        if rating >= threshold {
            return Image(systemName: "star.fill")
        } else if rating >= half {
            return Image(systemName: "star.leadinghalf.filled")
        } else {
            return Image(systemName: "star")
        }
    }

    /// Fill color for the star at `index`.
    private func fillColor(for index: Int) -> Color {
        let threshold = Double(index) + 0.5
        return rating >= threshold ? Theme.Colors.accent : Theme.Colors.textSecondary.opacity(0.3)
    }

    // MARK: - Accessibility

    private var accessibilityLabel: String {
        let formatted = rating.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", rating)
            : String(format: "%.1f", rating)
        return "\(formatted) out of 5 stars"
    }
}

// MARK: - Preview

#Preview("StarRatingView — Values") {
    VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
        ForEach([0.0, 1.0, 2.5, 3.7, 4.8, 5.0], id: \.self) { value in
            HStack {
                StarRatingView(rating: value)
                Text(String(format: "%.1f", value))
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
    }
    .padding()
}
