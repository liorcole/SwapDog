//
//  DogDetailView.swift
//  SwapDog
//
//  Full-screen dog profile detail view.
//  Companion subviews live in DogDetailSubviews.swift (same folder).
//
//  Architecture: MVVM-C — View layer (display only; data passed in from parent).
//

import SwiftUI

// MARK: - DogDetailView

/// Full-screen detail view for a single dog profile.
///
/// Photo carousel adapts to 0, 1, or many photos.
/// Energy level renders as a 3-bar indicator.
/// Special needs callout appears only when `dog.specialNeeds` is non-nil.
struct DogDetailView: View {

    // MARK: - Inputs

    let dog: Dog
    let owner: User
    var onViewOwnerProfile: (() -> Void)? = nil

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                PhotoCarousel(photoURLs: dog.photos, cornerRadius: 0, aspectRatio: 4 / 3)
                    .frame(maxWidth: .infinity)

                VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                    DogHeaderSection(dog: dog)
                    Divider()
                    EnergySection(level: dog.energyLevel)
                    TemperamentSection(tags: dog.temperament)

                    if let needs = dog.specialNeeds, !needs.isEmpty {
                        SpecialNeedsCallout(text: needs)
                    }

                    Divider()
                    HealthSection(vaccinated: dog.vaccinated, spayedNeutered: dog.spayedNeutered)
                    Divider()
                    OwnerMiniCard(owner: owner, onViewProfile: onViewOwnerProfile)
                }
                .padding(Theme.Spacing.md)
            }
        }
        .navigationTitle(dog.name)
        .navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }
}

// MARK: - Preview

#Preview("DogDetailView — Full Data") {
    NavigationStack {
        DogDetailView(dog: .mock, owner: .mock)
    }
}

#Preview("DogDetailView — Special Needs, No Photos") {
    NavigationStack {
        DogDetailView(
            dog: Dog(
                id: "dog_sn",
                ownerID: "usr_mock_001",
                name: "Biscuit",
                breed: "Dachshund",
                age: .adult,
                size: .small,
                energyLevel: .low,
                temperament: ["Calm", "Gentle"],
                specialNeeds: "Needs daily insulin injection. Medication in fridge.",
                vaccinated: true,
                spayedNeutered: false,
                photos: [],
                bio: "Sweet senior dachshund."
            ),
            owner: .mock
        )
    }
}
