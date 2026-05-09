//
//  SetLocationStepView.swift
//  SwapDog
//
//  Step 4: User sets their home location via CLLocationManager + MapKit.
//  Requests "when in use" permission only — per Apple guidelines (locked decision).
//
//  Architecture layer: Features/Onboarding (View — no business logic)
//

import SwiftUI
import MapKit
import CoreLocation

/// Onboarding step where the user confirms their home location.
///
/// - Requests `whenInUse` location permission on appear.
/// - Shows a MapKit map with a draggable annotation pin.
/// - Reverse-geocodes the pin to a neighbourhood name via `LocationService`.
/// - Stores coordinates and neighbourhood on `OnboardingViewModel`.
struct SetLocationStepView: View {

    // MARK: - Environment

    @EnvironmentObject private var coordinator: OnboardingCoordinator
    @EnvironmentObject private var viewModel: OnboardingViewModel

    // MARK: - Local State

    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060),
        span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
    )
    @State private var pinCoordinate = CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060)
    @State private var neighborhoodName: String = ""
    @State private var addressInput: String = ""
    @State private var isLocating: Bool = false
    @State private var permissionDenied: Bool = false
    @State private var locationError: String?

    // MARK: - Services (created locally; injected in production via DI)
    private let locationService: any LocationServiceProtocol = LocationService()

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                headerText
                mapSection
                addressSearchField
                neighborhoodDisplay
                Spacer(minLength: Theme.Spacing.xl)
                navigationButtons
            }
            .padding(Theme.Spacing.lg)
        }
        .screenBackground()
        .task { await requestLocationOnAppear() }
        .alert("Location Permission Required", isPresented: $permissionDenied) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Continue Without Location", role: .cancel) {
                coordinator.nextStep()
            }
        } message: {
            Text("SwapDog needs your location to show you nearby dog owners. You can change this in Settings.")
        }
    }

    // MARK: - Subviews

    private var headerText: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Set your location")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("We'll show your neighbourhood to potential swap partners — never your exact address.")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var mapSection: some View {
        ZStack {
            Map(
                coordinateRegion: $region,
                annotationItems: [MapPin(coordinate: pinCoordinate)]
            ) { pin in
                MapAnnotation(coordinate: pin.coordinate) {
                    draggablePinView
                }
            }
            .frame(height: 260)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
            .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
            .onTapGesture { location in
                // Allow tapping the map to move the pin
                updatePin(from: location, in: CGSize(width: UIScreen.main.bounds.width - 32, height: 260))
            }

            if isLocating {
                RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .frame(height: 260)
                    .overlay {
                        ProgressView("Finding your location…")
                            .font(Theme.Typography.body)
                    }
            }
        }
    }

    private var draggablePinView: some View {
        VStack(spacing: 0) {
            Image(systemName: "mappin.circle.fill")
                .resizable()
                .frame(width: 36, height: 36)
                .foregroundStyle(Theme.Colors.primary)
                .background(Circle().fill(.white).frame(width: 30, height: 30))
            Image(systemName: "arrowtriangle.down.fill")
                .font(.system(size: 10))
                .foregroundStyle(Theme.Colors.primary)
                .offset(y: -2)
        }
    }

    private var addressSearchField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Label("Or type your address", systemImage: "magnifyingglass")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            HStack {
                TextField("Search address or neighbourhood…", text: $addressInput)
                    .font(Theme.Typography.body)
                    .submitLabel(.search)
                    .onSubmit { geocodeAddress() }

                Button(action: geocodeAddress) {
                    Image(systemName: "arrow.right.circle.fill")
                        .foregroundStyle(Theme.Colors.primary)
                        .font(.title2)
                }
                .buttonStyle(.plain)
            }
            .padding(Theme.Spacing.md)
            .background(Theme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                    .stroke(Theme.Colors.textSecondary.opacity(0.3), lineWidth: 1)
            )

            if let error = locationError {
                Text(error)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.error)
            }
        }
    }

    private var neighborhoodDisplay: some View {
        Group {
            if !neighborhoodName.isEmpty {
                HStack(spacing: Theme.Spacing.sm) {
                    Image(systemName: "location.circle.fill")
                        .foregroundStyle(Theme.Colors.primary)
                    Text("Neighbourhood: **\(neighborhoodName)**")
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.textPrimary)
                }
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.primary.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
            }
        }
        .animation(.easeInOut, value: neighborhoodName)
    }

    private var navigationButtons: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Button {
                confirmLocation()
            } label: {
                Text("Confirm Location")
                    .primaryButtonStyle()
            }

            Button {
                coordinator.previousStep()
            } label: {
                Text("Back")
                    .secondaryButtonStyle()
            }
        }
    }

    // MARK: - Actions

    private func requestLocationOnAppear() async {
        isLocating = true
        locationError = nil

        do {
            let coords = try await locationService.requestCurrentLocation()
            let center = CLLocationCoordinate2D(latitude: coords.latitude, longitude: coords.longitude)
            pinCoordinate = center
            region = MKCoordinateRegion(
                center: center,
                span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
            )
            await reverseGeocode(coords.latitude, coords.longitude)
        } catch SwapDogError.unauthorized {
            permissionDenied = true
        } catch {
            locationError = "Unable to determine your location. You can type your address instead."
        }

        isLocating = false
    }

    private func geocodeAddress() {
        guard !addressInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        locationError = nil

        Task {
            let geocoder = CLGeocoder()
            do {
                let placemarks = try await geocoder.geocodeAddressString(addressInput)
                guard let location = placemarks.first?.location else {
                    locationError = "Address not found. Please try a different search."
                    return
                }
                let center = location.coordinate
                pinCoordinate = center
                region = MKCoordinateRegion(
                    center: center,
                    span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
                )
                await reverseGeocode(center.latitude, center.longitude)
            } catch {
                locationError = "Could not find that address. Please check and try again."
            }
        }
    }

    private func reverseGeocode(_ lat: Double, _ lon: Double) async {
        if let name = try? await locationService.reverseGeocode(latitude: lat, longitude: lon) {
            neighborhoodName = name
        }
    }

    private func confirmLocation() {
        viewModel.latitude = pinCoordinate.latitude
        viewModel.longitude = pinCoordinate.longitude
        viewModel.neighborhood = neighborhoodName.isEmpty ? nil : neighborhoodName
        coordinator.nextStep()
    }

    /// Maps a tap point in the map's local coordinate space to lat/lon.
    ///
    /// This is an approximation based on the visible region.
    private func updatePin(from point: CGPoint, in size: CGSize) {
        let latDelta = region.span.latitudeDelta
        let lonDelta = region.span.longitudeDelta
        let lat = region.center.latitude + (0.5 - Double(point.y / size.height)) * latDelta
        let lon = region.center.longitude + (Double(point.x / size.width) - 0.5) * lonDelta
        let coord = CLLocationCoordinate2D(latitude: lat, longitude: lon)
        pinCoordinate = coord
        Task { await reverseGeocode(lat, lon) }
    }
}

// MARK: - MapPin (Identifiable wrapper)

private struct MapPin: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
}

// MARK: - Preview

#Preview {
    SetLocationStepView()
        .environmentObject(OnboardingCoordinator())
        .environmentObject(OnboardingViewModel(
            userID: "preview_user",
            userEmail: "preview@example.com",
            userRepository: MockUserRepository(),
            dogRepository: MockDogRepository()
        ))
}
