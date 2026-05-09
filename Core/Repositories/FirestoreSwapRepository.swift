//
//  FirestoreSwapRepository.swift
//  SwapDog
//
//  Firestore-backed implementation of SwapRepositoryProtocol.
//
//

import Foundation
import os
import FirebaseFirestore

// MARK: - FirestoreSwapRepository

/// Concrete Firestore implementation of `SwapRepositoryProtocol`.
///
/// Swap requests live in the top-level `swap_requests` collection.
/// Queries filter by requester or recipient UID using Firestore compound queries.
final class FirestoreSwapRepository: SwapRepositoryProtocol {

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "FirestoreSwapRepository"
    )

    private let db = Firestore.firestore()

    // MARK: - SwapRepositoryProtocol

    func createRequest(_ request: SwapRequest) async throws {
        logger.info("createRequest id=\(request.id, privacy: .private)")
        do {
            try await db
                .collection(FirestorePaths.swapRequests)
                .document(request.id)
                .setData(request.firestoreData)
        } catch let error as SwapDogError {
            logger.error("createRequest failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("createRequest unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.networkError
        }
    }

    func getRequestsForUser(userID: String) async throws -> [SwapRequest] {
        logger.info("getRequestsForUser userID=\(userID, privacy: .private)")
        do {
            // Firestore doesn't support OR queries directly in SDK < v10.
            // Use two separate queries and merge the results:
            let requesterSnapshot = try await db
                .collection(FirestorePaths.swapRequests)
                .whereField("requester_id", isEqualTo: userID)
                .whereField("status", in: [SwapStatus.pending.rawValue, SwapStatus.accepted.rawValue])
                .getDocuments()
            let recipientSnapshot = try await db
                .collection(FirestorePaths.swapRequests)
                .whereField("recipient_id", isEqualTo: userID)
                .whereField("status", in: [SwapStatus.pending.rawValue, SwapStatus.accepted.rawValue])
                .getDocuments()
            let all = requesterSnapshot.documents + recipientSnapshot.documents
            return try all.compactMap { try decode(SwapRequest.self, from: $0.data()) }
        } catch let error as SwapDogError {
            logger.error("getRequestsForUser failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("getRequestsForUser unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.networkError
        }
    }

    func updateRequestStatus(id: String, status: SwapStatus) async throws {
        logger.info("updateRequestStatus id=\(id, privacy: .private) status=\(status.rawValue)")
        do {
            try await db
                .collection(FirestorePaths.swapRequests)
                .document(id)
                .updateData(["status": status.rawValue, "updated_at": Date()])
        } catch let error as SwapDogError {
            logger.error("updateRequestStatus failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("updateRequestStatus unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.networkError
        }
    }

    func getSwapHistory(userID: String) async throws -> [SwapRequest] {
        logger.info("getSwapHistory userID=\(userID, privacy: .private)")
        do {
            let terminalStatuses: [String] = [
                SwapStatus.completed.rawValue, SwapStatus.cancelled.rawValue, SwapStatus.declined.rawValue
            ]
            let requesterSnapshot = try await db
                .collection(FirestorePaths.swapRequests)
                .whereField("requester_id", isEqualTo: userID)
                .whereField("status", in: terminalStatuses)
                .order(by: "updated_at", descending: true)
                .getDocuments()
            let recipientSnapshot = try await db
                .collection(FirestorePaths.swapRequests)
                .whereField("recipient_id", isEqualTo: userID)
                .whereField("status", in: terminalStatuses)
                .order(by: "updated_at", descending: true)
                .getDocuments()
            let all = requesterSnapshot.documents + recipientSnapshot.documents
            return try all.compactMap { try decode(SwapRequest.self, from: $0.data()) }
                .sorted { $0.updatedAt > $1.updatedAt }
        } catch let error as SwapDogError {
            logger.error("getSwapHistory failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("getSwapHistory unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.networkError
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
