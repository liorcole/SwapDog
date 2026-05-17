//
//  FirestoreUserRepository.swift
//  SwapDog
//
//  Firestore-backed implementation of UserRepositoryProtocol.
//
//

import Foundation
import os
import FirebaseAuth
import FirebaseFirestore
import FirebaseStorage

// MARK: - FirestoreUserRepository

/// Concrete Firestore implementation of `UserRepositoryProtocol`.
///
/// Uses `FirestorePaths` for all collection references and maps Firebase
/// errors to `SwapDogError` before propagating to callers.
final class FirestoreUserRepository: UserRepositoryProtocol {

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "FirestoreUserRepository"
    )

    private let db = Firestore.firestore()
    private let storage = Storage.storage()

    // MARK: - UserRepositoryProtocol

    func createUser(_ user: User) async throws {
        logger.info("createUser id=\(user.id)")
        do {
            try await db
                .collection(FirestorePaths.users)
                .document(user.id)
                .setData(user.firestoreData)
        } catch let error as SwapDogError {
            logger.error("createUser failed: \(error.localizedDescription)")
            throw error
        } catch {
            logger.error("createUser unexpected error: \(error.localizedDescription)")
            throw SwapDogError.networkError
        }
    }

    func getUser(id: String) async throws -> User {
        logger.info("getUser id=\(id)")
        do {
            let snapshot = try await db
                .collection(FirestorePaths.users)
                .document(id)
                .getDocument()
            guard snapshot.exists, let data = snapshot.data() else {
                throw SwapDogError.notFound
            }
            return try decode(User.self, from: data)
        } catch let error as SwapDogError {
            logger.error("getUser failed: \(error.localizedDescription)")
            throw error
        } catch {
            logger.error("getUser unexpected error: \(error.localizedDescription)")
            throw SwapDogError.decodingError
        }
    }

    func updateUser(_ user: User) async throws {
        logger.info("updateUser id=\(user.id)")
        do {
            try await db
                .collection(FirestorePaths.users)
                .document(user.id)
                .updateData(user.firestoreData)
        } catch let error as SwapDogError {
            logger.error("updateUser failed: \(error.localizedDescription)")
            throw error
        } catch {
            logger.error("updateUser unexpected error: \(error.localizedDescription)")
            throw SwapDogError.networkError
        }
    }

    func getNearbyUsers(latitude: Double, longitude: Double, radiusMiles: Double) async throws -> [User] {
        logger.info("getNearbyUsers lat=\(latitude) lon=\(longitude) radius=\(radiusMiles)")
        do {
            // Geo-queries require GeoFirestore or a bounding-box approximation.
            // Approximate bounding box approach:
            let latDelta = radiusMiles / 69.0
            let lonDelta = radiusMiles / (69.0 * cos(latitude * .pi / 180))
            let snapshot = try await db.collection(FirestorePaths.users)
                .whereField("latitude", isGreaterThan: latitude - latDelta)
                .whereField("latitude", isLessThan: latitude + latDelta)
                .getDocuments()
            return try snapshot.documents.compactMap { try decode(User.self, from: $0.data()) }
        } catch let error as SwapDogError {
            logger.error("getNearbyUsers failed: \(error.localizedDescription)")
            throw error
        } catch {
            logger.error("getNearbyUsers unexpected error: \(error.localizedDescription)")
            throw SwapDogError.networkError
        }
    }

    func uploadProfileImage(data: Data) async throws -> String {
        guard let userID = currentUserID() else {
            throw SwapDogError.unauthorized
        }
        logger.info("uploadProfileImage userID=\(userID) bytes=\(data.count)")
        do {
            let path = FirestorePaths.profileImagePath(userID: userID)
            let ref = storage.reference().child(path)
            _ = try await ref.putDataAsync(data)
            let url = try await ref.downloadURL()
            return url.absoluteString
        } catch let error as SwapDogError {
            logger.error("uploadProfileImage failed: \(error.localizedDescription)")
            throw error
        } catch {
            logger.error("uploadProfileImage unexpected error: \(error.localizedDescription)")
            throw SwapDogError.uploadFailed
        }
    }

    // MARK: - Private Helpers

    private func currentUserID() -> String? {
        return Auth.auth().currentUser?.uid
    }

    /// Decodes a Firestore data dictionary into a Codable type.
    private func decode<T: Decodable>(_ type: T.Type, from data: [String: Any]) throws -> T {
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return try decoder.decode(type, from: jsonData)
    }
}
