//
//  ReviewsListView.swift
//  SwapDog
//
//  Sheet displaying all reviews for a user, sorted newest first.
//  Empty state shown when no reviews are available.
//
//  Architecture: MVVM-C — View layer.
//  Receives reviews and isLoading from its parent's ViewModel.
//

import SwiftUI

// MARK: - ReviewsListView

/// Presents a scrollable list of reviews for a user.
///
/// Designed to be presented as a `.sheet()` from `UserDetailView`.
/// Reviews must be pre-sorted (newest first) by the caller.
struct ReviewsListView: View {

    // MARK: - Inputs

    /// Reviews to display — caller sorts newest first.
    let reviews: [Review]

    /// The name of the user being reviewed (for the navigation title).
    let userName: String

    /// Whether a network fetch for reviews is still in progress.
    var isLoading: Bool = false

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - Body

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    loadingView
                } else if reviews.isEmpty {
                    emptyStateView
                } else {
                    reviewsList
                }
            }
            .navigationTitle("Reviews")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityLabel("Close reviews")
                }
            }
        }
    }

    // MARK: - Reviews List

    private var reviewsList: some View {
        ScrollView {
            LazyVStack(spacing: Theme.Spacing.md) {
                ForEach(reviews) { review in
                    ReviewRowView(review: review)
                        .cardStyle()
                }
            }
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.md)
        }
        .screenBackground()
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        EmptyStateView(
            icon: "star",
            title: "No reviews yet",
            subtitle: "Complete your first swap to get reviewed!"
        )
    }

    // MARK: - Loading

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.lg) {
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(1.2)
            Text("Loading reviews…")
                .font(Theme.Typography.subheadline)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .screenBackground()
    }
}

// MARK: - ReviewRowView

/// Single row in the reviews list.
private struct ReviewRowView: View {

    let review: Review

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            // Reviewer header
            HStack(spacing: Theme.Spacing.sm) {
                CachedAsyncImage(
                    urlString: nil,
                    cornerRadius: Theme.CornerRadius.pill,
                    size: CGSize(width: 40, height: 40)
                )
                .frame(width: 40, height: 40)
                .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Anonymous")
                        .font(Theme.Typography.headline)
                        .foregroundStyle(Theme.Colors.textPrimary)

                    StarRatingView(rating: Double(review.rating), starSize: 13)
                }

                Spacer()

                Text(review.createdAt.relativeTimeString)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }

            // Review text
            Text(review.text)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(review.rating) stars. \(review.text). \(review.createdAt.relativeTimeString)"
        )
    }
}

// MARK: - Preview

#Preview("ReviewsListView — With Reviews") {
    ReviewsListView(
        reviews: [
            Review(
                id: "r1",
                reviewerID: "u2",
                revieweeID: "u1",
                swapRequestID: "s1",
                rating: 5,
                text: "Amazing dog sitter! Luna was so happy.",
                createdAt: Date().addingTimeInterval(-86400)
            ),
            Review(
                id: "r2",
                reviewerID: "u3",
                revieweeID: "u1",
                swapRequestID: "s2",
                rating: 4,
                text: "Great experience, very communicative. Would swap again!",
                createdAt: Date().addingTimeInterval(-604800)
            )
        ],
        userName: "Sarah Chen"
    )
}

#Preview("ReviewsListView — Empty") {
    ReviewsListView(reviews: [], userName: "New User")
}

#Preview("ReviewsListView — Loading") {
    ReviewsListView(reviews: [], userName: "Sarah Chen", isLoading: true)
}
