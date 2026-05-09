//
//  UserDetailSubviews.swift
//  SwapDog
//
//  Companion subview components for UserDetailView.
//  Kept separate to honour the < 300 line rule per file.
//
//  Architecture: MVVM-C — View layer (pure display components).
//

import SwiftUI

// MARK: - UserProfileHeader

/// Large profile photo, verified badge, name, location, and join date.
struct UserProfileHeader: View {

    let user: User
    let memberSinceText: String

    var body: some View {
        VStack(spacing: Theme.Spacing.md) {
            ZStack(alignment: .bottomTrailing) {
                CachedAsyncImage(
                    urlString: user.profileImageURL,
                    cornerRadius: Theme.CornerRadius.pill,
                    size: CGSize(width: 104, height: 104)
                )
                .frame(width: 104, height: 104)
                .accessibilityHidden(true)

                if user.isVerified {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(Theme.Colors.primary)
                        .background(Theme.Colors.surface.clipShape(Circle()))
                        .offset(x: 4, y: 4)
                        .accessibilityLabel("Verified user")
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, Theme.Spacing.lg)

            VStack(spacing: Theme.Spacing.xs) {
                Text(user.displayName)
                    .font(Theme.Typography.title)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.center)

                if let neighborhood = user.neighborhood {
                    Label(neighborhood, systemImage: "mappin.and.ellipse")
                        .font(Theme.Typography.subheadline)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .accessibilityLabel("Location: \(neighborhood)")
                }

                Text(memberSinceText)
                    .font(Theme.Typography.footnote)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
        .padding(.horizontal, Theme.Spacing.md)
    }
}

// MARK: - UserRatingRow

/// Star rating + tappable review count.
struct UserRatingRow: View {

    let user: User
    let onTapReviews: () -> Void

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            StarRatingView(rating: user.rating, starSize: 18)

            Button(action: onTapReviews) {
                Text("(\(user.reviewCount) reviews)")
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.primary)
                    .underline()
                    .frame(minHeight: 44)
            }
            .accessibilityLabel("Read \(user.reviewCount) reviews")
            .accessibilityHint("Opens the reviews sheet")
        }
        .padding(.horizontal, Theme.Spacing.md)
    }
}

// MARK: - UserStatsRow

/// Swap count and dog count stats in a card.
struct UserStatsRow: View {

    let swapCount: Int
    let dogCount: Int

    var body: some View {
        HStack(spacing: 0) {
            StatCell(value: "\(swapCount)", label: "Swaps")
            Divider().frame(height: 36)
            StatCell(value: "\(dogCount)", label: dogCount == 1 ? "Dog" : "Dogs")
        }
        .frame(maxWidth: .infinity)
        .cardStyle()
        .padding(.horizontal, Theme.Spacing.md)
    }
}

// MARK: - StatCell

/// Single value+label pair used in `UserStatsRow`.
struct StatCell: View {

    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text(label)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label)")
    }
}

// MARK: - UserBioSection

/// "About" heading with bio text.
struct UserBioSection: View {

    let bio: String

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("About")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            Text(bio)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Theme.Spacing.md)
    }
}

// MARK: - UserDogsSection

/// Horizontal scroll of tappable mini dog cards.
struct UserDogsSection: View {

    let dogs: [Dog]
    let onSelectDog: (Dog) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Dogs")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
                .padding(.horizontal, Theme.Spacing.md)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.md) {
                    ForEach(dogs) { dog in
                        DogMiniCard(dog: dog)
                            .onTapGesture { onSelectDog(dog) }
                            .accessibilityLabel("View \(dog.name)'s profile")
                            .accessibilityAddTraits(.isButton)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                }
                .padding(.horizontal, Theme.Spacing.md)
            }
        }
    }
}

// MARK: - DogMiniCard

/// Compact card showing a dog thumbnail, name, and breed.
struct DogMiniCard: View {

    let dog: Dog

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            CachedAsyncImage(
                urlString: dog.photos.first,
                cornerRadius: Theme.CornerRadius.md,
                size: CGSize(width: 120, height: 100)
            )
            .frame(width: 120, height: 100)

            Text(dog.name)
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            Text(dog.breed)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .lineLimit(1)
        }
        .frame(width: 120)
        .cardStyle(padding: Theme.Spacing.sm)
    }
}

// MARK: - UserDetailCTABar

/// Sticky bottom bar with "Request a Swap" primary CTA and "Message" secondary button.
struct UserDetailCTABar: View {

    let userName: String
    var onRequestSwap: (() -> Void)?
    var onMessage: (() -> Void)?

    var body: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Button { onRequestSwap?() } label: {
                Text("Request a Swap")
                    .primaryButtonStyle()
            }
            .accessibilityLabel("Request a swap with \(userName)")

            Button { onMessage?() } label: {
                Text("Message")
                    .secondaryButtonStyle()
            }
            .accessibilityLabel("Send \(userName) a message")
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.bottom, Theme.Spacing.md)
        .background(.regularMaterial)
    }
}

// MARK: - ProfileLoadingView

/// Full-screen loading spinner shown while the user profile is being fetched.
struct ProfileLoadingView: View {

    var body: some View {
        VStack(spacing: Theme.Spacing.lg) {
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(1.2)
            Text("Loading profile…")
                .font(Theme.Typography.subheadline)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .screenBackground()
    }
}

// MARK: - ProfileErrorView

/// Full-screen error state with a retry action.
struct ProfileErrorView: View {

    let message: String
    let onRetry: () -> Void

    var body: some View {
        ContentUnavailableView {
            Label("Profile Not Found", systemImage: "person.slash")
        } description: {
            Text(message)
        } actions: {
            Button("Try Again", action: onRetry)
                .buttonStyle(.borderedProminent)
                .tint(Theme.Colors.primary)
        }
    }
}
