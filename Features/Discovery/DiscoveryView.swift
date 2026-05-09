//
//  DiscoveryView.swift
//  SwapDog
//
//  Main discovery feed screen. Displays DogOwnerCards in a scrollable list
//  with four explicit states: loading (shimmer), loaded, empty, and error.
//
//  Support types (ShimmerCardPlaceholder, UserDetailStubView) live in
//  DiscoverySupport.swift to keep this file under 300 lines.
//
//  Architecture layer: Features/Discovery (View)
//  Locked decisions:
//    - Every screen has loading, error, and empty states
//    - Pull-to-refresh triggers a new fetch
//

import SwiftUI

// MARK: - DiscoveryView

/// The primary discovery feed shown on the first tab.
///
/// Receives a fully-constructed `DiscoveryViewModel` so parents can inject
/// mocks for previews/tests without modifying this file.
struct DiscoveryView: View {

    // MARK: - Dependencies

    @ObservedObject var viewModel: DiscoveryViewModel

    // MARK: - Private

    private enum Constants {
        static let shimmerCardCount: Int = 3
        static let horizontalPadding: CGFloat = Theme.Spacing.md
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()
                contentLayer
            }
            .navigationTitle("Discover")
            .navigationBarTitleDisplayMode(.large)
            .toolbar { filterToolbarItem }
        }
        .task {
            await viewModel.initialLoad()
        }
    }

    // MARK: - Content Layer

    @ViewBuilder
    private var contentLayer: some View {
        if viewModel.isLoading && viewModel.nearbyItems.isEmpty {
            loadingView
        } else if let errorMessage = viewModel.errorMessage {
            errorView(message: errorMessage)
        } else if viewModel.isEmpty {
            emptyStateView
        } else {
            feedScrollView
        }
    }

    // MARK: - Loading State

    private var loadingView: some View {
        ScrollView {
            LazyVStack(spacing: Theme.Spacing.md) {
                ForEach(0..<Constants.shimmerCardCount, id: \.self) { _ in
                    ShimmerCardPlaceholder()
                }
            }
            .padding(.horizontal, Constants.horizontalPadding)
            .padding(.top, Theme.Spacing.sm)
        }
        .accessibilityLabel("Loading nearby dog owners")
    }

    // MARK: - Loaded (Feed) State

    private var feedScrollView: some View {
        ScrollView {
            LazyVStack(spacing: Theme.Spacing.md) {
                ForEach(viewModel.nearbyItems) { item in
                    NavigationLink(value: item.user) {
                        DogOwnerCard(
                            user:          item.user,
                            dogs:          item.dogs,
                            distanceMiles: item.distanceMiles
                        )
                    }
                    .buttonStyle(PressScaleButtonStyle())
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                    .animation(Theme.Animation.cardAppear, value: viewModel.nearbyItems.count)
                }
            }
            .padding(.horizontal, Constants.horizontalPadding)
            .padding(.top, Theme.Spacing.sm)
            .padding(.bottom, Theme.Spacing.xxl)
        }
        .refreshable {
            await viewModel.refresh()
        }
        .navigationDestination(for: User.self) { user in
            UserDetailStubView(user: user)
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        EmptyStateView(
            icon: "pawprint.circle",
            title: "No swappers nearby yet",
            subtitle: "Try expanding your search radius or check back later as SwapDog grows.",
            ctaTitle: "Expand Search Radius",
            ctaAction: {
                viewModel.filterState.radiusMiles = min(
                    viewModel.filterState.radiusMiles + 10,
                    AppConstants.maxSearchRadiusKm * 0.621_371
                )
            }
        )
        .refreshable { await viewModel.refresh() }
    }

    // MARK: - Error State

    private func errorView(message: String) -> some View {
        ErrorView(
            type: .network,
            message: message,
            retryAction: { Task { await viewModel.refresh() } }
        )
        .refreshable { await viewModel.refresh() }
    }

    // MARK: - Toolbar

    private var filterToolbarItem: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                // Filter sheet — expanded in a later iteration.
            } label: {
                Image(systemName: "slider.horizontal.3")
                    .accessibilityLabel("Filter discovery results")
            }
            .frame(minWidth: 44, minHeight: 44)
            .tint(Theme.Colors.primary)
        }
    }
}

// MARK: - Previews

#Preview("Loaded") {
    DiscoveryView(viewModel: DiscoveryViewModel(
        userRepository:  MockUserRepository(),
        dogRepository:   MockDogRepository(),
        locationService: MockLocationService()
    ))
}

#Preview("Empty") {
    let repo = MockUserRepository()
    repo.users = []
    DiscoveryView(viewModel: DiscoveryViewModel(
        userRepository:  repo,
        dogRepository:   MockDogRepository(),
        locationService: MockLocationService()
    ))
}

#Preview("Error") {
    let repo = MockUserRepository()
    repo.stubbedError = .networkError
    DiscoveryView(viewModel: DiscoveryViewModel(
        userRepository:  repo,
        dogRepository:   MockDogRepository(),
        locationService: MockLocationService()
    ))
}
