//
//  UserRepositoryProtocol.swift
//  SwapDog
//
//  Contract for Firestore user-profile operations.
//  Concrete implementation: FirestoreUserRepository (same folder).
//  Test/preview substitute: MockUserRepository (Tests/Mocks/).
//
//  IMPORTANT: No Firestore types appear in this signature.
//

import Foundation

// MARK: - UserRepositoryProtocol

/// Defines the contract for reading and writing `User` documents in Firestore.
///
/// Geo-query helpers use raw latitude/longitude so the protocol stays
/// independent of MapKit or CoreLocation — callers decode coordinates from
/// whichever location framework they use.
protocol UserRepositoryProtocol: AnyObject, Sendable {

    // MARK: CRUD

    /// Writes a new `User` document to Firestore.
    ///
    /// - Parameter user: The user to persist. The `id` field is used as the document ID.
    /// - Throws: `SwapDogError` if the write fails or a document with that ID already exists.
    func createUser(_ user: User) async throws

    /// Fetches a single `User` by their Firebase UID.
    ///
    /// - Parameter id: The Firebase Auth UID / Firestore document ID.
    /// - Returns: The matching `User`.
    /// - Throws: `SwapDogError.notFound` if the document does not exist.
    func getUser(id: String) async throws -> User

    /// Overwrites an existing `User` document with new field values.
    ///
    /// - Parameter user: The updated user. The `id` field identifies the document.
    /// - Throws: `SwapDogError` if the write fails.
    func updateUser(_ user: User) async throws

    // MARK: Discovery

    /// Returns users whose home coordinates fall within a radius of a given point.
    ///
    /// - Parameters:
    ///   - latitude: WGS-84 latitude of the search centre.
    ///   - longitude: WGS-84 longitude of the search centre.
    ///   - radiusMiles: Search radius in miles.
    /// - Returns: Users within the radius, sorted by distance ascending.
    /// - Throws: `SwapDogError` if the query fails.
    func getNearbyUsers(latitude: Double, longitude: Double, radiusMiles: Double) async throws -> [User]

    // MARK: Media

    /// Uploads a profile image to Firebase Storage and returns the download URL.
    ///
    /// - Parameter data: The raw image bytes (JPEG or PNG).
    /// - Returns: A Firebase Storage download URL string.
    /// - Throws: `SwapDogError.uploadFailed` if the upload does not complete.
    func uploadProfileImage(data: Data) async throws -> String
}
