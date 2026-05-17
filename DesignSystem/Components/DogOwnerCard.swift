//
//  DogOwnerCard.swift
//  SwapDog
//
//  Card component displayed in the Discovery feed.
//  Shows owner photo, name, dog photos, breed/age, distance, rating, and swap count.
//
//  Architecture layer: DesignSystem/Components
//  Locked decisions:
//    - All images use CachedAsyncImage
//    - VoiceOver labels on all interactive elements
//    - Tap targets >= 44×44 pt
//

import SwiftUI

// MARK: - DogOwnerCard

/// A discovery feed card presenting a dog owner and their dogs.
///
/// Designed for display inside a `LazyVStack`. Tapping the card navigates
/// to the owner's detail view (handled by the parent `DiscoveryView`).
///
/// Accessibility: The card produces a single combined `accessibilityLabel`
/// so VoiceOver reads it as one meaningful sentence.
struct DogOwnerCard: View {

    // MARK: - Input

    /// The owner whose profile is shown.
    let user: User

    /// The owner's registered dogs. The first dog's photos are shown in the card.
    let dogs: [Dog]

    /// Pre-computed distance from the current user's location in miles.
    let distanceMiles: Double

    // MARK: - Private Constants

    private enum Layout {
        static let profilePhotoSize: CGFloat    = 56
        static let dogPhotoSize: CGFloat        = 80
        static let dogPhotoCornerRadius: CGFloat = Theme.CornerRadius.sm
        static let swapBadgeMinWidth: CGFloat   = 44
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            headerRow
            dogScrollRow
            metaRow
        }
        .padding(Theme.Spacing.md)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
        .shadow(color: .black.opacity(0.07), radius: 8, x: 0, y: 3)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(cardAccessibilityLabel)
        .accessibilityAddTraits(.isButton)
        .dynamicTypeSize(...DynamicTypeSize.accessibility3)
    }

    // MARK: - Sub-views

    /// Top row: profile photo, name, neighborhood, swap badge.
    private var headerRow: some View {
        HStack(spacing: Theme.Spacing.sm) {
            profilePhoto
            ownerInfo
            Spacer()
            swapBadge
        }
    }

    private var profilePhoto: some View {
        CachedAsyncImage(urlString: user.profileImageURL ?? "")
            .frame(width: Layout.profilePhotoSize, height: Layout.profilePhotoSize)
            .clipShape(Circle())
            .overlay(
                Circle()
                    .stroke(Theme.Colors.primary.opacity(0.25), lineWidth: 2)
            )
    }

    private var ownerInfo: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: Theme.Spacing.xs) {
                Text(user.displayName)
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .lineLimit(1)

                if user.isVerified {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Colors.secondary)
                        .accessibilityLabel("Verified")
                }
            }

            if let neighborhood = user.neighborhood, !neighborhood.isEmpty {
                Text(neighborhood)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .lineLimit(1)
            }

            distanceBadge
        }
    }

    private var distanceBadge: some View {
        Label {
            Text(formattedDistance)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
        } icon: {
            Image(systemName: "location.fill")
                .font(.system(size: 10))
                .foregroundStyle(Theme.Colors.primary)
        }
    }

    private var swapBadge: some View {
        VStack(spacing: 2) {
            Text("\(user.swapCount)")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.primary)

            Text("swaps")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(minWidth: Layout.swapBadgeMinWidth)
        .padding(.vertical, Theme.Spacing.xs)
        .padding(.horizontal, Theme.Spacing.sm)
        .background(Theme.Colors.primary.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
    }

    /// Horizontal scroll of the first dog's photos (or a placeholder).
    private var dogScrollRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.sm) {
                if dogs.isEmpty {
                    dogPhotoPlaceholder
                } else {
                    ForEach(dogPhotos, id: \.self) { urlString in
                        CachedAsyncImage(urlString: urlString)
                            .frame(width: Layout.dogPhotoSize, height: Layout.dogPhotoSize)
                            .clipShape(
                                RoundedRectangle(
                                    cornerRadius: Layout.dogPhotoCornerRadius,
                                    style: .continuous
                                )
                            )
                    }
                }
            }
            .padding(.horizontal, 1) // prevents clipping shadow
        }
    }

    private var dogPhotoPlaceholder: some View {
        RoundedRectangle(cornerRadius: Layout.dogPhotoCornerRadius, style: .continuous)
            .fill(Theme.Colors.shimmerBase)
            .frame(width: Layout.dogPhotoSize, height: Layout.dogPhotoSize)
            .overlay(
                Image(systemName: "pawprint")
                    .font(.system(size: 24))
                    .foregroundStyle(Theme.Colors.textSecondary.opacity(0.5))
            )
    }

    /// Bottom row: dog info summary + star rating.
    private var metaRow: some View {
        HStack {
            dogInfoSummary
            Spacer()
            starRatingView
        }
    }

    private var dogInfoSummary: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let firstDog = dogs.first {
                Text(firstDog.name)
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.textPrimary)

                Text("\(firstDog.breed) · \(firstDog.age.displayName)")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .lineLimit(1)
            }

            if dogs.count > 1 {
                Text("+ \(dogs.count - 1) more dog\(dogs.count > 2 ? "s" : "")")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.primary)
            }
        }
    }

    private var starRatingView: some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { star in
                Image(systemName: starImageName(for: star))
                    .font(.system(size: 13))
                    .foregroundStyle(starColor(for: star))
            }

            Text(String(format: "%.1f", user.rating))
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)

            if user.reviewCount > 0 {
                Text("(\(user.reviewCount))")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
    }

    // MARK: - Helpers

    /// All photo URLs collected across the dogs to display in the scroll row.
    private var dogPhotos: [String] {
        dogs.flatMap(\.photos)
    }

    /// Distance formatted to one decimal place.
    private var formattedDistance: String {
        String(format: "%.1f mi away", distanceMiles)
    }

    /// VoiceOver label summarising the card for blind users.
    private var cardAccessibilityLabel: String {
        let dogCount = dogs.count
        let dogWord = dogCount == 1 ? "dog" : "dogs"
        let ratingText = String(format: "%.1f", user.rating)
        return "Dog owner \(user.displayName), \(formattedDistance), rated \(ratingText) stars, \(dogCount) \(dogWord)"
    }

    private func starImageName(for position: Int) -> String {
        let filled = Int(user.rating.rounded())
        if position <= filled { return "star.fill" }
        if position == filled + 1 && user.rating - Double(filled) >= 0.5 { return "star.leadinghalf.filled" }
        return "star"
    }

    private func starColor(for position: Int) -> Color {
        position <= Int(user.rating.rounded()) ? Theme.Colors.accent : Theme.Colors.separator
    }
}

// MARK: - DogAge Display Name

private extension DogAge {
    var displayName: String {
        switch self {
        case .puppy:  return "Puppy"
        case .young:  return "Young"
        case .adult:  return "Adult"
        case .senior: return "Senior"
        }
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: Theme.Spacing.md) {
            DogOwnerCard(user: .mock, dogs: [.mock], distanceMiles: 0.8)
            DogOwnerCard(user: .mock, dogs: [], distanceMiles: 2.3)
        }
        .padding(Theme.Spacing.md)
    }
    .background(Theme.Colors.background)
}
