//
//  MockSwapRepository.swift
//  SwapDog
//
//  In-memory mock implementation of SwapRepositoryProtocol.
//  Suitable for unit tests and SwiftUI previews.
//

import Foundation

// MARK: - MockSwapRepository

/// In-memory mock of `SwapRepositoryProtocol` for unit tests and SwiftUI previews.
///
/// Pre-populates `requests` with `[.mock]`.
final class MockSwapRepository: SwapRepositoryProtocol {

    // MARK: - In-Memory Store

    var requests: [SwapRequest] = [.mock]

    /// When set, all methods throw this error.
    var stubbedError: SwapDogError?

    // MARK: - Recorded Calls

    private(set) var createRequestCallCount = 0
    private(set) var getRequestsForUserCallCount = 0
    private(set) var updateRequestStatusCallCount = 0
    private(set) var getSwapHistoryCallCount = 0

    // MARK: - SwapRepositoryProtocol

    func createRequest(_ request: SwapRequest) async throws {
        createRequestCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        requests.append(request)
    }

    func getRequestsForUser(userID: String) async throws -> [SwapRequest] {
        getRequestsForUserCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        let activeStatuses: Set<SwapStatus> = [.pending, .accepted]
        return requests.filter {
            ($0.requesterID == userID || $0.recipientID == userID) &&
            activeStatuses.contains($0.status)
        }
    }

    func updateRequestStatus(id: String, status: SwapStatus) async throws {
        updateRequestStatusCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        guard let index = requests.firstIndex(where: { $0.id == id }) else {
            throw SwapDogError.notFound
        }
        requests[index].status = status
    }

    func getSwapHistory(userID: String) async throws -> [SwapRequest] {
        getSwapHistoryCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        let terminalStatuses: Set<SwapStatus> = [.completed, .cancelled, .declined]
        return requests
            .filter {
                ($0.requesterID == userID || $0.recipientID == userID) &&
                terminalStatuses.contains($0.status)
            }
            .sorted { $0.updatedAt > $1.updatedAt }
    }
}
