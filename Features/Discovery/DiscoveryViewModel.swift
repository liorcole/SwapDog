//
//  DiscoveryViewModel.swift
//  SwapDog
//
//  Fetches nearby dog owners, sorts by proximity, and manages all
//  discovery feed state.  Business logic lives here, not in the View.
//
//  Architecture layer: Features/Discovery (ViewModel)
//  Locked decisions enforced:
//    - LocationService is protocol-based and injected (mockable)
//    - Every screen has loading, error, and empty states
//    - Pull-to-refresh triggers a new fetch
//

import Foundation
import os

// MARK: - Filter State

/// Configurable filters applied to the nearby-user query.
struct DiscoveryFilterState: Equatable {
    /// Search radius in miles. Default is 10 mi per locked engineering decision.
    var radiusMiles: Double = 10
}

// MARK: - NearbyUserItem

/// Combines a `User` with their dogs and computed distance for display in the feed.
struct NearbyUserItem: Identifiable {
    let user: User
    let dogs: [Dog]
    /// Distance from the current user's location in miles.
    let distanceMiles: Double

    var id: String { user.id }
}

// MARK: - DiscoveryViewModel

/// Manages the state of the Discovery feed.
///
/// Inject via `@StateObject` in the parent tab view and pass down through
/// `@ObservedObject` to `DiscoveryView`.
@MainActor
final class DiscoveryViewModel: ObservableObject {

    // MARK: - Published State

    /// Nearby users sorted by ascending distance, populated after a successful fetch.
    @Published private(set) var nearbyItems: [NearbyUserItem] = []

    /// `true` while an async fetch is in progress.
    @Published private(set) var isLoading: Bool = false

    /// Non-nil when the most recent fetch failed.
    @Published private(set) var errorMessage: String?

    /// The user tapped by the consumer, intended for navigation.
    @Published var selectedUser: User?

    /// Current filter configuration; changing `radiusMiles` triggers a refetch.
    @Published var filterState: DiscoveryFilterState = DiscoveryFilterState() {
        didSet {
            guard oldValue != filterState else { return }
            Task { await loadNearbyUsers() }
        }
    }

    // MARK: - Computed Convenience

    /// `true` when the feed has loaded and contains no results.
    var isEmpty: Bool { !isLoading && errorMessage == nil && nearbyItems.isEmpty }

    // MARK: - Dependencies

    private let userRepository: any UserRepositoryProtocol
    private let dogRepository: any DogRepositoryProtocol
    private let locationService: any LocationServiceProtocol
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "DiscoveryViewModel"
    )

    // MARK: - Private State

    /// The resolved device location. Cached until the radius filter changes.
    private var currentLocation: (latitude: Double, longitude: Double)?

    // MARK: - Init

    /// Creates a new `DiscoveryViewModel`.
    ///
    /// - Parameters:
    ///   - userRepository:   Provides the `getNearbyUsers` geo-query.
    ///   - dogRepository:    Fetches the dogs owned by each nearby user.
    ///   - locationService:  Resolves the device's current GPS coordinates.
    init(
        userRepository: any UserRepositoryProtocol,
        dogRepository: any DogRepositoryProtocol,
        locationService: any LocationServiceProtocol
    ) {
        self.userRepository  = userRepository
        self.dogRepository   = dogRepository
        self.locationService = locationService
    }

    // MARK: - Public API

    /// Fetches nearby users for the first time.  Call from `.task {}` in the view.
    func initialLoad() async {
        guard nearbyItems.isEmpty && !isLoading else { return }
        await loadNearbyUsers()
    }

    /// Refreshes the feed.  Bound to `.refreshable {}` in `DiscoveryView`.
    func refresh() async {
        currentLocation = nil   // force a fresh GPS fix on pull-to-refresh
        await loadNearbyUsers()
    }

    // MARK: - Private: Data Loading

    /// Resolves location → queries nearby users → fetches their dogs → sorts & publishes.
    private func loadNearbyUsers() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            // 1. Resolve current location (uses cache unless cleared).
            let location = try await resolveLocation()

            // 2. Query nearby users.
            let users = try await userRepository.getNearbyUsers(
                latitude:     location.latitude,
                longitude:    location.longitude,
                radiusMiles:  filterState.radiusMiles
            )
            logger.info("getNearbyUsers returned \(users.count) results")

            // 3. Fetch dogs for each user concurrently.
            let items = try await buildNearbyItems(
                users:    users,
                location: location
            )

            // 4. Publish sorted results.
            nearbyItems = items.sorted { $0.distanceMiles < $1.distanceMiles }

        } catch let error as SwapDogError {
            handleError(error)
        } catch {
            handleError(.unknown(error))
        }
    }

    /// Fetches dogs for all users concurrently and constructs `NearbyUserItem` values.
    private func buildNearbyItems(
        users:    [User],
        location: (latitude: Double, longitude: Double)
    ) async throws -> [NearbyUserItem] {
        // Use a task group to fetch dog lists concurrently.
        try await withThrowingTaskGroup(of: NearbyUserItem.self) { group in
            for user in users {
                group.addTask { [dogRepository] in
                    let dogs = (try? await dogRepository.getDogs(ownerID: user.id)) ?? []
                    let distance = Self.distanceInMiles(
                        from: location,
                        to:   (user.latitude, user.longitude)
                    )
                    return NearbyUserItem(user: user, dogs: dogs, distanceMiles: distance)
                }
            }

            var items: [NearbyUserItem] = []
            for try await item in group {
                items.append(item)
            }
            return items
        }
    }

    /// Returns the cached location or requests a fresh GPS fix.
    private func resolveLocation() async throws -> (latitude: Double, longitude: Double) {
        if let cached = currentLocation { return cached }
        let location = try await locationService.requestCurrentLocation()
        currentLocation = location
        return location
    }

    private func handleError(_ error: SwapDogError) {
        logger.error("Discovery fetch failed: \(error.localizedDescription)")
        errorMessage = error.errorDescription
    }

    // MARK: - Private: Haversine Distance

    /// Computes the great-circle distance between two WGS-84 coordinates in miles.
    private static func distanceInMiles(
        from: (latitude: Double, longitude: Double),
        to:   (latitude: Double, longitude: Double)
    ) -> Double {
        let earthRadiusMiles = 3_958.8
        let dLat = (to.latitude  - from.latitude)  * .pi / 180
        let dLon = (to.longitude - from.longitude) * .pi / 180
        let lat1 = from.latitude * .pi / 180
        let lat2 = to.latitude   * .pi / 180

        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return earthRadiusMiles * c
    }
}
