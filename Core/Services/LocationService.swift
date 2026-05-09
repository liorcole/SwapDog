//
//  LocationService.swift
//  SwapDog
//
//  Wraps CLLocationManager in a Swift Concurrency-friendly interface.
//  Requests "when in use" authorisation only, per Apple guidelines and
//  the locked decision in the engineering contract.
//
//  Architecture layer: Core/Services
//

import CoreLocation
import Foundation
import os

// MARK: - Protocol

/// Contract for location acquisition and reverse geocoding.
///
/// Conforming types must be `Sendable` so they can be injected into
/// `@MainActor` ViewModels without a data-race warning.
protocol LocationServiceProtocol: AnyObject, Sendable {

    /// Requests the device's current GPS location.
    ///
    /// - Returns: A tuple of (latitude, longitude) in WGS-84 decimal degrees.
    /// - Throws: `SwapDogError.unauthorized` if permission is denied.
    ///           `SwapDogError.networkError` if a location fix cannot be obtained.
    func requestCurrentLocation() async throws -> (latitude: Double, longitude: Double)

    /// Reverse geocodes a coordinate pair into a human-readable neighbourhood string.
    ///
    /// - Parameters:
    ///   - latitude:  WGS-84 latitude.
    ///   - longitude: WGS-84 longitude.
    /// - Returns: A neighbourhood / locality string, or `nil` if unavailable.
    /// - Throws: `SwapDogError.networkError` if the reverse geocoding request fails.
    func reverseGeocode(latitude: Double, longitude: Double) async throws -> String?
}

// MARK: - Implementation

/// Production implementation of `LocationServiceProtocol`.
///
/// Uses `CLLocationManager` for GPS fixes and `CLGeocoder` for reverse geocoding.
/// Location permission is requested for **in-use only** (`.whenInUse`), which
/// satisfies Apple's privacy guidelines and the locked engineering decisions.
///
/// Thread safety: `CLLocationManager` must be created and used on the main thread.
/// The continuation-based wrappers marshal back to callers via `@MainActor`.
final class LocationService: NSObject, LocationServiceProtocol, CLLocationManagerDelegate, @unchecked Sendable {

    // MARK: - Private State

    private let manager = CLLocationManager()
    private let geocoder = CLGeocoder()
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "LocationService"
    )

    /// Cached last-known location to avoid redundant GPS fixes.
    private var cachedLocation: CLLocation?

    /// Pending continuations waiting for a location fix.
    private var locationContinuations: [CheckedContinuation<CLLocation, Error>] = []

    /// Pending continuation waiting for an authorisation decision.
    private var authContinuation: CheckedContinuation<CLAuthorizationStatus, Never>?

    // MARK: - Init

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    // MARK: - LocationServiceProtocol

    func requestCurrentLocation() async throws -> (latitude: Double, longitude: Double) {
        // Return cached location if fresh enough (within 5 minutes).
        if let cached = cachedLocation,
           Date().timeIntervalSince(cached.timestamp) < 300 {
            return (cached.coordinate.latitude, cached.coordinate.longitude)
        }

        let status = manager.authorizationStatus

        switch status {
        case .notDetermined:
            let resolved = await requestAuthorisation()
            guard resolved == .authorizedWhenInUse || resolved == .authorizedAlways else {
                throw SwapDogError.unauthorized
            }
        case .denied, .restricted:
            throw SwapDogError.unauthorized
        case .authorizedWhenInUse, .authorizedAlways:
            break
        @unknown default:
            throw SwapDogError.unauthorized
        }

        let location: CLLocation = try await withCheckedThrowingContinuation { continuation in
            locationContinuations.append(continuation)
            manager.requestLocation()
        }

        cachedLocation = location
        return (location.coordinate.latitude, location.coordinate.longitude)
    }

    func reverseGeocode(latitude: Double, longitude: Double) async throws -> String? {
        let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)

        do {
            let placemarks = try await geocoder.reverseGeocodeLocation(location)
            guard let placemark = placemarks.first else { return nil }
            // Prefer subLocality (neighbourhood) then locality (city).
            return placemark.subLocality ?? placemark.locality
        } catch {
            logger.error("Reverse geocoding failed: \(error.localizedDescription)")
            throw SwapDogError.networkError
        }
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        logger.info("Location fix: \(location.coordinate.latitude), \(location.coordinate.longitude)")
        cachedLocation = location
        locationContinuations.forEach { $0.resume(returning: location) }
        locationContinuations.removeAll()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        logger.error("CLLocationManager error: \(error.localizedDescription)")
        locationContinuations.forEach { $0.resume(throwing: SwapDogError.networkError) }
        locationContinuations.removeAll()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        logger.info("Location authorisation changed: \(status.rawValue)")
        authContinuation?.resume(returning: status)
        authContinuation = nil
    }

    // MARK: - Private

    private func requestAuthorisation() async -> CLAuthorizationStatus {
        await withCheckedContinuation { continuation in
            authContinuation = continuation
            manager.requestWhenInUseAuthorization()
        }
    }
}
