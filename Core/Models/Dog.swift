//
//  Dog.swift
//  SwapDog
//
//  Represents a dog registered on the SwapDog platform.
//  Maps to the `dogs` Firestore collection.
//

import Foundation

// MARK: - Supporting Enums

/// Broad life-stage categorisation for a dog.
enum DogAge: String, Codable, CaseIterable {
    case puppy  = "puppy"   // 0–1 year
    case young  = "young"   // 1–3 years
    case adult  = "adult"   // 3–8 years
    case senior = "senior"  // 8+ years
}

/// Approximate size category for a dog, each mapped to a human-readable weight range.
enum DogSize: String, Codable, CaseIterable {
    case small      = "small"
    case medium     = "medium"
    case large      = "large"
    case extraLarge = "extra_large"

    /// Descriptive weight range for display in the UI.
    var weightRange: String {
        switch self {
        case .small:      return "Under 25 lbs"
        case .medium:     return "25–50 lbs"
        case .large:      return "50–90 lbs"
        case .extraLarge: return "Over 90 lbs"
        }
    }
}

/// Generalised energy / exercise requirement of a dog.
enum EnergyLevel: String, Codable, CaseIterable {
    case low      = "low"
    case moderate = "moderate"
    case high     = "high"
}

// MARK: - Dog

/// A dog registered on the SwapDog platform.
///
/// Stored under `dogs/{dogID}` in Firestore.
/// Photo URLs point to Firebase Storage objects.
struct Dog: Codable, Identifiable {

    // MARK: Properties

    /// Unique Firestore document ID for this dog.
    let id: String

    /// Firestore UID of the owner (`users/{ownerID}`).
    let ownerID: String

    /// The dog's given name.
    var name: String

    /// Breed description (free text, e.g. "Golden Retriever mix").
    var breed: String

    /// Approximate life-stage of the dog.
    var age: DogAge

    /// Approximate size category.
    var size: DogSize

    /// General activity / exercise level.
    var energyLevel: EnergyLevel

    /// Personality tags chosen by the owner (e.g. ["friendly", "good with kids"]).
    var temperament: [String]

    /// Any special care requirements (medication, allergies, etc.).
    var specialNeeds: String?

    /// Whether the dog is up to date on core vaccinations.
    var vaccinated: Bool

    /// Whether the dog has been spayed or neutered.
    var spayedNeutered: Bool

    /// Firebase Storage download URLs for the dog's photos.
    var photos: [String]

    /// Free-form description of the dog written by the owner.
    var bio: String

    // MARK: CodingKeys

    enum CodingKeys: String, CodingKey {
        case id
        case ownerID          = "owner_id"
        case name
        case breed
        case age
        case size
        case energyLevel      = "energy_level"
        case temperament
        case specialNeeds     = "special_needs"
        case vaccinated
        case spayedNeutered   = "spayed_neutered"
        case photos
        case bio
    }

    // MARK: Firestore Serialisation

    /// Dictionary representation suitable for writing to Firestore.
    var firestoreData: [String: Any] {
        var data: [String: Any] = [
            CodingKeys.id.rawValue:            id,
            CodingKeys.ownerID.rawValue:       ownerID,
            CodingKeys.name.rawValue:          name,
            CodingKeys.breed.rawValue:         breed,
            CodingKeys.age.rawValue:           age.rawValue,
            CodingKeys.size.rawValue:          size.rawValue,
            CodingKeys.energyLevel.rawValue:   energyLevel.rawValue,
            CodingKeys.temperament.rawValue:   temperament,
            CodingKeys.vaccinated.rawValue:    vaccinated,
            CodingKeys.spayedNeutered.rawValue: spayedNeutered,
            CodingKeys.photos.rawValue:        photos,
            CodingKeys.bio.rawValue:           bio,
        ]
        if let specialNeeds {
            data[CodingKeys.specialNeeds.rawValue] = specialNeeds
        }
        return data
    }
}

// MARK: - Mock Data

extension Dog {
    /// A realistic sample `Dog` for use in SwiftUI previews and unit tests.
    static var mock: Dog {
        Dog(
            id: "dog_mock_001",
            ownerID: "usr_mock_001",
            name: "Luna",
            breed: "Golden Retriever",
            age: .young,
            size: .large,
            energyLevel: .high,
            temperament: ["friendly", "playful", "good with kids", "good with other dogs"],
            specialNeeds: nil,
            vaccinated: true,
            spayedNeutered: true,
            photos: [
                "https://storage.googleapis.com/swapdog-dev/dogs/dog_mock_001/photo_01.jpg",
                "https://storage.googleapis.com/swapdog-dev/dogs/dog_mock_001/photo_02.jpg"
            ],
            bio: "Luna is a 2-year-old Golden who loves fetch, swimming, and snuggling on the couch. She's great with kids and other dogs but has a lot of energy — perfect for an active household!"
        )
    }
}
