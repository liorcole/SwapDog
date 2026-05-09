//
//  ProfileDogRowView.swift
//  SwapDog
//
//  Single dog row used in the "My Dogs" section of ProfileView.
//
//  Architecture layer: Features/Profile (View — no business logic)
//

import SwiftUI

// MARK: - ProfileDogRowView

/// A list row showing a dog's photo, name, breed, age, and size for the Profile screen.
struct ProfileDogRowView: View {

    // MARK: - Inputs

    let dog: Dog

    // MARK: - Body

    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            CachedAsyncImage(
                urlString: dog.photos.first,
                cornerRadius: Theme.CornerRadius.sm,
                size: CGSize(width: 56, height: 56)
            )
            .frame(width: 56, height: 56)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text(dog.name)
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text("\(dog.breed) · \(dog.age.rawValue.capitalized) · \(dog.size.weightRange)")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundStyle(Theme.Colors.textSecondary)
                .accessibilityHidden(true)
        }
        .cardStyle()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(dog.name), \(dog.breed), tap to edit")
    }
}

// MARK: - Preview

#Preview {
    ProfileDogRowView(dog: .mock)
        .padding()
}
