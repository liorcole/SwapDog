//
//  DiscoverySupport.swift
//  SwapDog
//
//  Supporting views for DiscoveryView, split out to keep DiscoveryView < 300 lines.
//  Architecture layer: Features/Discovery
//

import SwiftUI

// MARK: - ShimmerCardPlaceholder

/// A skeleton card displayed in the loading state while the Discovery feed fetches data.
struct ShimmerCardPlaceholder: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            // Header row skeleton
            HStack(spacing: Theme.Spacing.sm) {
                Circle()
                    .frame(width: 56, height: 56)
                    .shimmer(active: true)
                VStack(alignment: .leading, spacing: 6) {
                    RoundedRectangle(cornerRadius: 4)
                        .frame(width: 140, height: 16)
                        .shimmer(active: true)
                    RoundedRectangle(cornerRadius: 4)
                        .frame(width: 90, height: 12)
                        .shimmer(active: true)
                }
            }
            // Dog photo row skeleton
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
                        .frame(width: 80, height: 80)
                        .shimmer(active: true)
                }
            }
            // Meta row skeleton
            RoundedRectangle(cornerRadius: 4)
                .frame(width: 180, height: 12)
                .shimmer(active: true)
        }
        .padding(Theme.Spacing.md)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
        .shadow(color: .black.opacity(0.05), radius: 6, x: 0, y: 2)
        .accessibilityHidden(true)
    }
}

// MARK: - UserDetailStubView

/// Placeholder navigation destination for the User Detail screen (Step 7).
struct UserDetailStubView: View {
    let user: User

    var body: some View {
        VStack(spacing: Theme.Spacing.md) {
            Text(user.displayName)
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("User detail coming in Step 7")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .navigationTitle(user.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }
}
