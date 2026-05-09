//
//  FirestorePaths.swift
//  SwapDog
//
//  Single source of truth for all Firestore collection and document paths.
//  Using this enum eliminates magic strings from every repository implementation.
//

import Foundation

// MARK: - FirestorePaths

/// Typed constants for every Firestore collection and subcollection path.
///
/// All repository implementations MUST use these constants rather than
/// hard-coding path strings. This ensures consistent paths and makes
/// renames a single-line change.
///
/// Example usage:
/// ```swift
/// db.collection(FirestorePaths.users).document(userID)
/// db.collection(FirestorePaths.userDogs(ownerID: ownerID))
/// ```
enum FirestorePaths {

    // MARK: - Top-Level Collections

    /// Root collection for `User` documents: `users`
    static let users = "users"

    /// Root collection for `SwapRequest` documents: `swap_requests`
    static let swapRequests = "swap_requests"

    /// Root collection for `Conversation` documents: `conversations`
    static let conversations = "conversations"

    /// Root collection for `Review` documents: `reviews`
    static let reviews = "reviews"

    // MARK: - Subcollections

    /// Subcollection of `Dog` documents under a user: `users/{ownerID}/dogs`
    static func userDogs(ownerID: String) -> String {
        "\(users)/\(ownerID)/dogs"
    }

    /// Subcollection of `Message` documents under a conversation:
    /// `conversations/{conversationID}/messages`
    static func messages(conversationID: String) -> String {
        "\(conversations)/\(conversationID)/messages"
    }

    // MARK: - Storage Paths

    /// Firebase Storage path for a user's profile image: `users/{userID}/profile`
    static func profileImagePath(userID: String) -> String {
        "users/\(userID)/profile"
    }

    /// Firebase Storage path for a dog's photo: `dogs/{dogID}/photos/{photoName}`
    static func dogPhotoPath(dogID: String, photoName: String) -> String {
        "dogs/\(dogID)/photos/\(photoName)"
    }
}
