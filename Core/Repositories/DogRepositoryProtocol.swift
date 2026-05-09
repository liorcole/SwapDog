//
//  DogRepositoryProtocol.swift
//  SwapDog
//
//  Contract for Firestore dog-profile operations.
//  Concrete implementation: FirestoreDogRepository (same folder).
//  Test/preview substitute: MockDogRepository (Tests/Mocks/).
//
//  IMPORTANT: No Firestore types appear in this signature.
//

import Foundation

// MARK: - DogRepositoryProtocol

/// Defines the contract for reading and writing `Dog` documents in Firestore.
///
/// Dogs are stored in a subcollection under their owner's user document:
/// `users/{ownerID}/dogs/{dogID}`. The ownerID is passed explicitly so the
/// repository knows which subcollection to target.
protocol DogRepositoryProtocol: AnyObject, Sendable {

    // MARK: CRUD

    /// Writes a new `Dog` document under the specified owner's subcollection.
    ///
    /// - Parameters:
    ///   - dog: The dog to persist. The `id` field is used as the document ID.
    ///   - ownerID: The Firebase UID of the dog's owner.
    /// - Throws: `SwapDogError` if the write fails.
    func addDog(_ dog: Dog, ownerID: String) async throws

    /// Fetches all `Dog` documents owned by a given user.
    ///
    /// - Parameter ownerID: The Firebase UID of the owner.
    /// - Returns: An array of `Dog` values (empty if the owner has no dogs).
    /// - Throws: `SwapDogError` if the query fails.
    func getDogs(ownerID: String) async throws -> [Dog]

    /// Overwrites an existing `Dog` document with new field values.
    ///
    /// - Parameter dog: The updated dog. Both `id` and `ownerID` are used to
    ///   locate the subcollection document.
    /// - Throws: `SwapDogError` if the write fails.
    func updateDog(_ dog: Dog) async throws

    /// Deletes a `Dog` document from the owner's subcollection.
    ///
    /// - Parameters:
    ///   - id: The Firestore document ID of the dog to delete.
    ///   - ownerID: The Firebase UID of the dog's owner.
    /// - Throws: `SwapDogError` if the deletion fails.
    func deleteDog(id: String, ownerID: String) async throws

    // MARK: Media

    /// Uploads a dog photo to Firebase Storage and returns the download URL.
    ///
    /// - Parameters:
    ///   - data: The raw image bytes (JPEG or PNG).
    ///   - dogID: The Firestore document ID of the dog — used to build the storage path.
    /// - Returns: A Firebase Storage download URL string.
    /// - Throws: `SwapDogError.uploadFailed` if the upload does not complete.
    func uploadDogPhoto(data: Data, dogID: String) async throws -> String
}
