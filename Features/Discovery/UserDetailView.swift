//
//  UserDetailView.swift
//  SwapDog
//
//  Full user profile detail view driven by UserDetailViewModel.
//  Companion subviews live in UserDetailSubviews.swift (same folder).
//
//  Architecture: MVVM-C — View layer.
//

import SwiftUI

// MARK: - UserDetailView

/// Full-screen detail for a SwapDog user profile.
///
/// Navigation flow:
///   Discovery → UserDetailView → DogDetailView
///   UserDetailView → ReviewsListView (sheet)
struct UserDetailView: View {

    // MARK: - ViewModel

    @StateObject private var viewModel: UserDetailViewModel

    // MARK: - Navigation

    @State private var selectedDog: Dog?
    @State private var showDogDetail: Bool = false

    // MARK: - Callbacks

    var onMessage: (() -> Void)?
    var onRequestSwap: (() -> Void)?

    // MARK: - Init

    init(
        viewModel: UserDetailViewModel,
        onMessage: (() -> Void)? = nil,
        onRequestSwap: (() -> Void)? = nil
    ) {
        _viewModel = StateObject(wrappedValue: viewModel)
        self.onMessage = onMessage
        self.onRequestSwap = onRequestSwap
    }

    // MARK: - Body

    var body: some View {
        content
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.loadProfile() }
            .sheet(isPresented: $viewModel.showReviews) {
                ReviewsListView(
                    reviews: viewModel.reviews,
                    userName: viewModel.user?.displayName ?? "",
                    isLoading: viewModel.isLoadingReviews
                )
            }
            .navigationDestination(isPresented: $showDogDetail) {
                if let dog = selectedDog {
                    DogDetailView(dog: dog, owner: viewModel.user ?? .mock)
                }
            }
            .alert("Error", isPresented: .constant(
                viewModel.errorMessage != nil && viewModel.user != nil
            )) {
                Button("OK") { viewModel.dismissError() }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
    }

    // MARK: - Content Switch

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            ProfileLoadingView()
        } else if let error = viewModel.errorMessage, viewModel.user == nil {
            ProfileErrorView(message: error) {
                Task { await viewModel.loadProfile() }
            }
        } else if let user = viewModel.user {
            profileScrollView(user: user)
        } else {
            ProfileLoadingView()
        }
    }

    // MARK: - Profile Scroll View

    private func profileScrollView(user: User) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                UserProfileHeader(
                    user: user,
                    memberSinceText: viewModel.memberSinceText
                )
                UserRatingRow(user: user) {
                    Task { await viewModel.tapReviews() }
                }
                UserStatsRow(swapCount: user.swapCount, dogCount: user.dogs.count)
                Divider().padding(.horizontal, Theme.Spacing.md)

                if !user.bio.isEmpty {
                    UserBioSection(bio: user.bio)
                }
                if !viewModel.dogs.isEmpty {
                    UserDogsSection(dogs: viewModel.dogs) { dog in
                        selectedDog = dog
                        showDogDetail = true
                    }
                }
            }
            .padding(.bottom, 120)
        }
        .screenBackground()
        .safeAreaInset(edge: .bottom) {
            UserDetailCTABar(userName: user.displayName, onRequestSwap: onRequestSwap, onMessage: onMessage)
        }
    }
}

// MARK: - Preview

#Preview("UserDetailView — Loaded") {
    NavigationStack {
        UserDetailView(
            viewModel: UserDetailViewModel(
                userID: User.mock.id,
                userRepository: MockUserRepository(),
                dogRepository: MockDogRepository(),
                reviewRepository: MockReviewRepository()
            )
        )
    }
}

#Preview("UserDetailView — Not Found") {
    let mockRepo = MockUserRepository()
    mockRepo.stubbedError = .notFound
    NavigationStack {
        UserDetailView(
            viewModel: UserDetailViewModel(
                userID: "invalid",
                userRepository: mockRepo,
                dogRepository: MockDogRepository(),
                reviewRepository: MockReviewRepository()
            )
        )
    }
}
