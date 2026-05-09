//
//  ShimmerModifier.swift
//  SwapDog
//
//  Reusable shimmer/skeleton loading ViewModifier.
//  Apply via `.shimmer(active: true)` on any View.
//
//  Architecture layer: DesignSystem/Modifiers
//  Locked decisions:
//    - ShimmerModifier is reusable across the app
//

import SwiftUI

// MARK: - ShimmerModifier

/// Overlays an animated left-to-right gradient shimmer when `active` is `true`.
///
/// Usage:
/// ```swift
/// Rectangle()
///     .frame(height: 20)
///     .shimmer(active: isLoading)
/// ```
///
/// When `active` is `false` the modifier is a no-op — safe to leave on any view permanently.
struct ShimmerModifier: ViewModifier {

    // MARK: - Configuration

    /// Whether the shimmer animation is currently running.
    let active: Bool

    // MARK: - Private State

    @State private var phase: CGFloat = -1

    // MARK: - Animation

    private static let animation = Animation
        .linear(duration: 1.2)
        .repeatForever(autoreverses: false)

    // MARK: - Body

    func body(content: Content) -> some View {
        content
            .overlay {
                if active {
                    shimmerOverlay
                }
            }
            .onAppear {
                if active {
                    withAnimation(Self.animation) {
                        phase = 1
                    }
                }
            }
            .onChange(of: active) { _, newValue in
                if newValue {
                    phase = -1
                    withAnimation(Self.animation) {
                        phase = 1
                    }
                }
            }
    }

    // MARK: - Private

    private var shimmerOverlay: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let gradient = LinearGradient(
                stops: [
                    .init(color: .clear,                   location: 0),
                    .init(color: shimmerHighlight,         location: 0.4),
                    .init(color: shimmerHighlight,         location: 0.6),
                    .init(color: .clear,                   location: 1),
                ],
                startPoint: .leading,
                endPoint:   .trailing
            )

            Rectangle()
                .fill(shimmerBase)
            Rectangle()
                .fill(gradient)
                .frame(width: width * 2)
                .offset(x: width * phase)
        }
        .clipped()
        .allowsHitTesting(false)
    }

    private var shimmerBase: Color {
        Theme.Colors.shimmerBase
    }

    private var shimmerHighlight: Color {
        Theme.Colors.shimmerHighlight
    }
}

// MARK: - View Extension

extension View {

    /// Applies a sliding shimmer overlay while `active` is `true`.
    ///
    /// - Parameter active: When `true` the shimmer animation plays. Pass `false` to show
    ///   the real content without any overlay (no-op).
    func shimmer(active: Bool) -> some View {
        modifier(ShimmerModifier(active: active))
    }
}

// MARK: - Preview

#Preview("Shimmer active") {
    VStack(spacing: Theme.Spacing.md) {
        RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
            .frame(height: 120)
            .shimmer(active: true)

        RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
            .frame(height: 16)
            .shimmer(active: true)

        RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
            .frame(height: 16)
            .frame(maxWidth: 200, alignment: .leading)
            .shimmer(active: true)
    }
    .padding()
}
