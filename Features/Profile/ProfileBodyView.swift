//
//  ProfileBodyView.swift
//  SwapDog
//
//  Scrollable body content for ProfileView: header, stats, dogs, reviews.
//  Extracted to keep ProfileView under 300 lines.
//
//  Architecture layer: Features/Profile (View — no business logic)
//

import SwiftUI

// MARK: - ProfileBodyView

/// Scrollable profile content: avatar/bio header, stats, dogs list, reviews preview.
///
/// Receives the loaded `User` value from its parent (`ProfileView`) and
/// delegates delete confirmation to the parent's alert state.
struct ProfileBodyView: View {

    // MARK: - Inputs

    let user: User
    let onEditProfile: () -> Void

    // MARK: - Environment

    @EnvironmentObject private var viewModel: ProfileViewModel

    // MARK: - Local State

    @State private var dogToDelete:          Dog?
    @State private var showingDeleteDogAlert = false
    @State private var showingReviews        = false

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                profileHeader
                statsSection
                dogsSection
                reviewsSection
            }
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.bottom, Theme.Spacing.xl)
        }
        .screenBackground()
        .refreshable { await viewModel.loadProfile() }
        .alert("Delete Dog?", isPresented: $showingDeleteDogAlert, presenting: dogToDelete) { dog in
            Button("Delete \(dog.name)", role: .destructive) {
                Task { await performDeleteDog(dog) }
            }
            Button("Cancel", role: .cancel) {}
        } message: { _ in
            Text("This cannot be undone.")
        }
        .sheet(isPresented: $showingReviews) {
            ReviewsListView(
                reviews: viewModel.reviews,
                userName: user.displayName,
                isLoading: viewModel.isLoadingReviews
            )
        }
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        VStack(spacing: Theme.Spacing.md) {
            CachedAsyncImage(
                urlString: user.profileImageURL,
                cornerRadius: Theme.CornerRadius.pill,
                size: CGSize(width: 100, height: 100)
            )
            .frame(width: 100, height: 100)
            .accessibilityLabel("\(user.displayName)'s profile photo")

            VStack(spacing: Theme.Spacing.xs) {
                HStack(spacing: Theme.Spacing.xs) {
                    Text(user.displayName)
                        .font(Theme.Typography.title2)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    if user.isVerified {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(Theme.Colors.primary)
                            .accessibilityLabel("Verified user")
                    }
                }
                if let hood = user.neighborhood {
                    Label(hood, systemImage: "mappin")
                        .font(Theme.Typography.subheadline)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                if !user.bio.isEmpty {
                    Text(user.bio)
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .multilineTextAlignment(.center)
                        .padding(.top, Theme.Spacing.xs)
                }
            }

            Button(action: onEditProfile) {
                Text("Edit Profile").secondaryButtonStyle()
            }
            .frame(maxWidth: 200)
            .accessibilityLabel("Edit your profile")
        }
        .padding(.top, Theme.Spacing.md)
    }

    // MARK: - Stats

    private var statsSection: some View {
        HStack(spacing: 0) {
            statCell(value: "\(user.swapCount)", label: "Swaps")
            Divider().frame(height: 40)
            statCell(
                value: user.reviewCount > 0 ? String(format: "%.1f", user.rating) : "—",
                label: "Rating"
            )
            Divider().frame(height: 40)
            statCell(value: memberSinceText(user.joinedDate), label: "Member")
        }
        .cardStyle()
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(user.swapCount) swaps, rating \(String(format: "%.1f", user.rating)), " +
            "member since \(memberSinceText(user.joinedDate))"
        )
    }

    private func statCell(value: String, label: String) -> some View {
        VStack(spacing: Theme.Spacing.xs) {
            Text(value)
                .font(Theme.Typography.title3)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text(label)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func memberSinceText(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "MMM yy"
        return fmt.string(from: date)
    }

    // MARK: - Dogs

    private var dogsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack {
                Text("My Dogs")
                    .font(Theme.Typography.title3)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Spacer()
                NavigationLink {
                    // Add Dog is handled through EditDogView with a blank dog
                    Text("Add Dog — TODO connect to AddDogView")
                } label: {
                    Label("Add", systemImage: "plus")
                        .font(Theme.Typography.subheadline)
                        .foregroundStyle(Theme.Colors.primary)
                }
                .disabled(viewModel.dogs.count >= AppConstants.maxDogsPerUser)
                .accessibilityLabel("Add a dog")
            }

            if viewModel.isLoadingDogs {
                shimmerPlaceholders(count: 2, height: 72)
            } else if viewModel.dogs.isEmpty {
                EmptyStateView(
                    icon: "pawprint",
                    title: "No dogs yet",
                    subtitle: "Add your first dog to start swapping!"
                )
            } else {
                ForEach(viewModel.dogs) { dog in
                    NavigationLink {
                        EditDogView(dog: dog).environmentObject(viewModel)
                    } label: {
                        ProfileDogRowView(dog: dog)
                    }
                    .buttonStyle(.plain)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            dogToDelete = dog
                            showingDeleteDogAlert = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Reviews

    private var reviewsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack {
                Text("My Reviews")
                    .font(Theme.Typography.title3)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Spacer()
                if !viewModel.reviews.isEmpty {
                    Button("See All") { showingReviews = true }
                        .font(Theme.Typography.subheadline)
                        .foregroundStyle(Theme.Colors.primary)
                        .accessibilityLabel("See all reviews")
                }
            }

            if viewModel.isLoadingReviews {
                shimmerPlaceholders(count: 2, height: 60)
            } else if viewModel.reviews.isEmpty {
                EmptyStateView(
                    icon: "star",
                    title: "No reviews yet",
                    subtitle: "Complete a swap to get your first review!"
                )
            } else {
                ForEach(viewModel.reviews.prefix(3)) { review in
                    HStack(spacing: Theme.Spacing.sm) {
                        StarRatingView(rating: Double(review.rating), starSize: 14)
                        Text(review.text)
                            .font(Theme.Typography.subheadline)
                            .foregroundStyle(Theme.Colors.textPrimary)
                            .lineLimit(2)
                    }
                    .cardStyle()
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("\(review.rating) stars. \(review.text)")
                }
            }
        }
    }

    // MARK: - Helpers

    private func shimmerPlaceholders(count: Int, height: CGFloat) -> some View {
        ForEach(0..<count, id: \.self) { _ in
            RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                .fill(Theme.Colors.textSecondary.opacity(0.1))
                .frame(height: height)
                .shimmer(active: true)
        }
    }

    private func performDeleteDog(_ dog: Dog) async {
        do {
            try await viewModel.deleteDog(id: dog.id)
        } catch let error as SwapDogError {
            viewModel.errorMessage = error.errorDescription
        } catch {
            viewModel.errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Preview

#Preview {
    let vm = ProfileViewModel(
        userRepository: MockUserRepository(),
        dogRepository: MockDogRepository(),
        authRepository: MockAuthRepository(),
        reviewRepository: MockReviewRepository(),
        coordinator: AppCoordinator()
    )
    vm.user = .mock
    vm.dogs = [.mock]
    NavigationStack {
        ProfileBodyView(user: .mock, onEditProfile: {})
            .environmentObject(vm)
    }
}
