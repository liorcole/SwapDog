//
//  MockLocationService.swift
//  SwapDog
//
//  In-memory mock implementation of LocationServiceProtocol.
//  Suitable for unit tests and SwiftUI previews.
//
//  Architecture layer: Tests/Mocks
//  Locked decision: LocationService is protocol-based and mockable
//

import Foundation

// MARK: - MockLocationService

/// In-memory mock of `LocationServiceProtocol` for unit tests and SwiftUI previews.
///
/// Returns a configurable fixed location (default: Upper West Side, NYC).
/// Set `stubbedError` to simulate permission denial or network failure.
final class MockLocationService: LocationServiceProtocol {

    // MARK: - Configuration

    /// Latitude returned by `requestCurrentLocation`. Defaults to UWS, NYC.
    var stubbedLatitude: Double = 40.7831

    /// Longitude returned by `requestCurrentLocation`. Defaults to UWS, NYC.
    var stubbedLongitude: Double = -73.9712

    /// When set, `requestCurrentLocation` throws this error.
    var stubbedError: SwapDogError?

    /// String returned by `reverseGeocode`. Defaults to a neighbourhood name.
    var stubbedNeighborhood: String? = "Upper West Side"

    // MARK: - Recorded Calls

    private(set) var requestCurrentLocationCallCount = 0
    private(set) var reverseGeocodeCallCount         = 0

    // MARK: - LocationServiceProtocol

    func requestCurrentLocation() async throws -> (latitude: Double, longitude: Double) {
        requestCurrentLocationCallCount += 1
        try await Task.sleep(for: .milliseconds(50))
        if let error = stubbedError { throw error }
        return (stubbedLatitude, stubbedLongitude)
    }

    func reverseGeocode(latitude: Double, longitude: Double) async throws -> String? {
        reverseGeocodeCallCount += 1
        try await Task.sleep(for: .milliseconds(50))
        if let error = stubbedError { throw error }
        return stubbedNeighborhood
    }
}
