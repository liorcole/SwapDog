//
//  SwapRepositoryProtocol.swift
//  SwapDog
//
//  Contract for Firestore swap-request operations.
//  Concrete implementation: FirestoreSwapRepository (same folder).
//  Test/preview substitute: MockSwapRepository (Tests/Mocks/).
//
//  IMPORTANT: No Firestore types appear in this signature.
//

import Foundation

// MARK: - SwapRepositoryProtocol

/// Defines the contract for creating and managing `SwapRequest` documents.
///
/// Swap requests live in the top-level `swap_requests` collection and are
/// queried by either the requester or recipient UID.
protocol SwapRepositoryProtocol: AnyObject, Sendable {

    // MARK: Create

    /// Writes a new `SwapRequest` document to Firestore.
    ///
    /// - Parameter request: The request to persist. The `id` field is the document ID.
    /// - Throws: `SwapDogError` if the write fails.
    func createRequest(_ request: SwapRequest) async throws

    // MARK: Queries

    /// Fetches all swap requests where the given user is either the requester
    /// or the recipient and the request is not yet completed or cancelled.
    ///
    /// - Parameter userID: The Firebase UID to filter by.
    /// - Returns: An array of matching `SwapRequest` values.
    /// - Throws: `SwapDogError` if the query fails.
    func getRequestsForUser(userID: String) async throws -> [SwapRequest]

    // MARK: Update

    /// Transitions a swap request to a new lifecycle status.
    ///
    /// - Parameters:
    ///   - id: The Firestore document ID of the swap request.
    ///   - status: The new `SwapStatus` to apply.
    /// - Throws: `SwapDogError` if the document does not exist or the write fails.
    func updateRequestStatus(id: String, status: SwapStatus) async throws

    // MARK: History

    /// Fetches all completed or cancelled swap requests involving the given user.
    ///
    /// - Parameter userID: The Firebase UID to filter by.
    /// - Returns: Past `SwapRequest` values, newest first.
    /// - Throws: `SwapDogError` if the query fails.
    func getSwapHistory(userID: String) async throws -> [SwapRequest]
}
