//
//  UserDetailViewModel.swift
//  SwapDog
//
//  Loads a user's full profile, their dogs, and lazily fetches reviews on demand.
//  Handles not-found and network errors gracefully.
//
//  Architecture: MVVM-C — ViewModel layer.
//  Calls UserRepositoryProtocol, DogRepositoryProtocol, ReviewRepositoryProtocol.
//  Never imports Firebase directly.
//

import Foundation
import os

// MARK: - UserDetailViewModel

/// Drives `UserDetailView` — loads profile data and lazy-fetches reviews.
///
/// - Call `loadProfile()` via `.task` in the view.
/// - Call `loadReviews()` when the user taps the review count.
@MainActor
final class UserDetailViewModel: ObservableObject {

    // MARK: - Published State

    /// The loaded user profile; `nil` while loading or if not found.
    @Published var user: User?

    /// The user's registered dogs; empty until loaded.
    @Published var dogs: [Dog] = []

    /// Reviews received by this user; populated lazily on demand.
    @Published var reviews: [Review] = []

    /// Whether the initial profile+dogs fetch is in progress.
    @Published var isLoading: Bool = false

    /// Whether reviews are being fetched.
    @Published var isLoadingReviews: Bool = false

    /// User-visible error message; `nil` clears any displayed error.
    @Published var errorMessage: String?

    /// Controls presentation of the ReviewsListView sheet.
    @Published var showReviews: Bool = false

    /// Whether reviews have been fetched at least once (avoids re-fetch on re-open).
    @Published var reviewsFetched: Bool = false

    // MARK: - Dependencies

    private let userID: String
    private let userRepository: any UserRepositoryProtocol
    private let dogRepository: any DogRepositoryProtocol
    private let reviewRepository: any ReviewRepositoryProtocol

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "UserDetailViewModel"
    )

    // MARK: - Init

    /// - Parameters:
    ///   - userID:           Firestore UID of the user to display.
    ///   - userRepository:   Repository for user document reads.
    ///   - dogRepository:    Repository for dog document reads.
    ///   - reviewRepository: Repository for review reads.
    init(
        userID: String,
        userRepository: any UserRepositoryProtocol,
        dogRepository: any DogRepositoryProtocol,
        reviewRepository: any ReviewRepositoryProtocol
    ) {
        self.userID = userID
        self.userRepository = userRepository
        self.dogRepository = dogRepository
        self.reviewRepository = reviewRepository
    }

    // MARK: - Actions

    /// Loads the user profile and their dogs concurrently.
    ///
    /// Safe to call from `.task` — cancellation is propagated automatically.
    func loadProfile() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            async let fetchedUser = userRepository.getUser(id: userID)
            async let fetchedDogs = dogRepository.getDogs(ownerID: userID)

            let (resolvedUser, resolvedDogs) = try await (fetchedUser, fetchedDogs)
            user = resolvedUser
            dogs = resolvedDogs
            logger.info("Loaded profile for user \(self.userID): \(resolvedDogs.count) dog(s)")
        } catch SwapDogError.notFound {
            errorMessage = "This user profile could not be found."
            logger.warning("User not found: \(self.userID)")
        } catch let error as SwapDogError {
            errorMessage = error.errorDescription
            logger.error("Failed to load profile \(self.userID): \(error.localizedDescription)")
        } catch {
            errorMessage = SwapDogError.unknown(error).errorDescription
            logger.error("Unexpected error loading profile \(self.userID): \(error)")
        }
    }

    /// Lazily fetches reviews for this user, then presents the reviews sheet.
    ///
    /// Only hits the network once — subsequent taps reuse cached results.
    func tapReviews() async {
        showReviews = true
        guard !reviewsFetched else { return }

        isLoadingReviews = true
        defer { isLoadingReviews = false }

        do {
            reviews = try await reviewRepository.getReviews(userID: userID)
            reviewsFetched = true
            logger.info("Loaded \(self.reviews.count) review(s) for user \(self.userID)")
        } catch let error as SwapDogError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = SwapDogError.unknown(error).errorDescription
        }
    }

    /// Dismisses any displayed error banner.
    func dismissError() {
        errorMessage = nil
    }

    // MARK: - Computed Helpers

    /// Formatted "Member since [Month Year]" string.
    var memberSinceText: String {
        guard let user else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return "Member since \(formatter.string(from: user.joinedDate))"
    }
}
