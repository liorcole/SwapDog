//
//  User.swift
//  SwapDog
//
//  Represents a registered SwapDog user. Maps to the `users` Firestore collection.
//

import Foundation

// MARK: - User

/// A registered SwapDog user who can post dogs and participate in swaps.
///
/// Stored under `users/{uid}` in Firestore. Dog references are stored as
/// an array of Dog document IDs rather than an embedded subcollection.
struct User: Codable, Identifiable {

    // MARK: Properties

    /// Firebase Authentication UID — also the Firestore document ID.
    let id: String

    /// User's login email address.
    var email: String

    /// Display name shown throughout the app.
    var displayName: String

    /// URL to the user's profile photo in Firebase Storage.
    var profileImageURL: String?

    /// WGS-84 latitude of the user's home area.
    var latitude: Double

    /// WGS-84 longitude of the user's home area.
    var longitude: Double

    /// Human-readable neighbourhood name (e.g. "Upper West Side").
    var neighborhood: String?

    /// Short bio written by the user.
    var bio: String

    /// Date the account was created.
    let joinedDate: Date

    /// Whether the user's identity has been verified by the platform.
    var isVerified: Bool

    /// Average rating across all reviews received (0.0–5.0).
    var rating: Double

    /// Total number of reviews the user has received.
    var reviewCount: Int

    /// IDs of the user's registered `Dog` documents.
    var dogs: [String]

    /// Number of completed swaps the user has participated in.
    var swapCount: Int

    // MARK: CodingKeys

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case displayName       = "display_name"
        case profileImageURL   = "profile_image_url"
        case latitude
        case longitude
        case neighborhood
        case bio
        case joinedDate        = "joined_date"
        case isVerified        = "is_verified"
        case rating
        case reviewCount       = "review_count"
        case dogs
        case swapCount         = "swap_count"
    }

    // MARK: Firestore Serialisation

    /// Dictionary representation suitable for writing to Firestore.
    var firestoreData: [String: Any] {
        var data: [String: Any] = [
            CodingKeys.id.rawValue:           id,
            CodingKeys.email.rawValue:         email,
            CodingKeys.displayName.rawValue:   displayName,
            CodingKeys.latitude.rawValue:      latitude,
            CodingKeys.longitude.rawValue:     longitude,
            CodingKeys.bio.rawValue:           bio,
            CodingKeys.joinedDate.rawValue:    joinedDate,
            CodingKeys.isVerified.rawValue:    isVerified,
            CodingKeys.rating.rawValue:        rating,
            CodingKeys.reviewCount.rawValue:   reviewCount,
            CodingKeys.dogs.rawValue:          dogs,
            CodingKeys.swapCount.rawValue:     swapCount,
        ]
        if let profileImageURL {
            data[CodingKeys.profileImageURL.rawValue] = profileImageURL
        }
        if let neighborhood {
            data[CodingKeys.neighborhood.rawValue] = neighborhood
        }
        return data
    }
}

// MARK: - Mock Data

extension User {
    /// A realistic sample `User` for use in SwiftUI previews and unit tests.
    static var mock: User {
        User(
            id: "usr_mock_001",
            email: "sarah.chen@example.com",
            displayName: "Sarah Chen",
            profileImageURL: "https://storage.googleapis.com/swapdog-dev/users/usr_mock_001/profile.jpg",
            latitude: 40.7831,
            longitude: -73.9712,
            neighborhood: "Upper West Side",
            bio: "Dog lover and remote software engineer. Luna is my best friend and I want to make sure she gets the best care when I'm travelling.",
            joinedDate: ISO8601DateFormatter().date(from: "2024-03-15T10:00:00Z") ?? Date(),
            isVerified: true,
            rating: 4.8,
            reviewCount: 12,
            dogs: ["dog_mock_001"],
            swapCount: 9
        )
    }
}
