//
//  FirestoreDogRepository.swift
//  SwapDog
//
//  Firestore-backed implementation of DogRepositoryProtocol.
//
//

import Foundation
import os
import FirebaseFirestore
import FirebaseStorage

// MARK: - FirestoreDogRepository

/// Concrete Firestore implementation of `DogRepositoryProtocol`.
///
/// Dogs are stored in a per-owner subcollection: `users/{ownerID}/dogs/{dogID}`.
/// All paths are resolved via `FirestorePaths` — no magic strings.
final class FirestoreDogRepository: DogRepositoryProtocol {

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "FirestoreDogRepository"
    )

    private let db = Firestore.firestore()
    private let storage = Storage.storage()

    // MARK: - DogRepositoryProtocol

    func addDog(_ dog: Dog, ownerID: String) async throws {
        logger.info("addDog id=\(dog.id, privacy: .private) ownerID=\(ownerID, privacy: .private)")
        do {
            try await db
                .collection(FirestorePaths.userDogs(ownerID: ownerID))
                .document(dog.id)
                .setData(dog.firestoreData)
        } catch let error as SwapDogError {
            logger.error("addDog failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("addDog unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.networkError
        }
    }

    func getDogs(ownerID: String) async throws -> [Dog] {
        logger.info("getDogs ownerID=\(ownerID, privacy: .private)")
        do {
            let snapshot = try await db
                .collection(FirestorePaths.userDogs(ownerID: ownerID))
                .getDocuments()
            return try snapshot.documents.compactMap { try decode(Dog.self, from: $0.data()) }
        } catch let error as SwapDogError {
            logger.error("getDogs failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("getDogs unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.networkError
        }
    }

    func updateDog(_ dog: Dog) async throws {
        logger.info("updateDog id=\(dog.id, privacy: .private) ownerID=\(dog.ownerID, privacy: .private)")
        do {
            try await db
                .collection(FirestorePaths.userDogs(ownerID: dog.ownerID))
                .document(dog.id)
                .updateData(dog.firestoreData)
        } catch let error as SwapDogError {
            logger.error("updateDog failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("updateDog unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.networkError
        }
    }

    func deleteDog(id: String, ownerID: String) async throws {
        logger.info("deleteDog id=\(id, privacy: .private) ownerID=\(ownerID, privacy: .private)")
        do {
            try await db
                .collection(FirestorePaths.userDogs(ownerID: ownerID))
                .document(id)
                .delete()
        } catch let error as SwapDogError {
            logger.error("deleteDog failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("deleteDog unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.networkError
        }
    }

    func uploadDogPhoto(data: Data, dogID: String) async throws -> String {
        logger.info("uploadDogPhoto dogID=\(dogID, privacy: .private) bytes=\(data.count)")
        do {
            let photoName = UUID().uuidString + ".jpg"
            let path = FirestorePaths.dogPhotoPath(dogID: dogID, photoName: photoName)
            let ref = storage.reference().child(path)
            _ = try await ref.putDataAsync(data)
            let url = try await ref.downloadURL()
            return url.absoluteString
        } catch let error as SwapDogError {
            logger.error("uploadDogPhoto failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("uploadDogPhoto unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.uploadFailed
        }
    }

    // MARK: - Private Helpers

    private func decode<T: Decodable>(_ type: T.Type, from data: [String: Any]) throws -> T {
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return try decoder.decode(type, from: jsonData)
    }
}
