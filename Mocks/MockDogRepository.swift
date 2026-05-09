//
//  MockDogRepository.swift
//  SwapDog
//
//  In-memory mock implementation of DogRepositoryProtocol.
//  Suitable for unit tests and SwiftUI previews.
//

import Foundation

// MARK: - MockDogRepository

/// In-memory mock of `DogRepositoryProtocol` for unit tests and SwiftUI previews.
///
/// Pre-populates `dogs` with `[.mock]`.
final class MockDogRepository: DogRepositoryProtocol {

    // MARK: - In-Memory Store

    var dogs: [Dog] = [.mock]

    /// When set, all methods throw this error.
    var stubbedError: SwapDogError?

    /// Return value for `uploadDogPhoto`. Override in tests.
    var stubbedDogPhotoURL = "https://storage.googleapis.com/swapdog-dev/mock/dog_photo.jpg"

    // MARK: - Recorded Calls

    private(set) var addDogCallCount = 0
    private(set) var getDogsCallCount = 0
    private(set) var updateDogCallCount = 0
    private(set) var deleteDogCallCount = 0
    private(set) var uploadDogPhotoCallCount = 0

    // MARK: - DogRepositoryProtocol

    func addDog(_ dog: Dog, ownerID: String) async throws {
        addDogCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        dogs.append(dog)
    }

    func getDogs(ownerID: String) async throws -> [Dog] {
        getDogsCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        return dogs.filter { $0.ownerID == ownerID }
    }

    func updateDog(_ dog: Dog) async throws {
        updateDogCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        guard let index = dogs.firstIndex(where: { $0.id == dog.id }) else {
            throw SwapDogError.notFound
        }
        dogs[index] = dog
    }

    func deleteDog(id: String, ownerID: String) async throws {
        deleteDogCallCount += 1
        try await Task.sleep(for: .milliseconds(100))
        if let error = stubbedError { throw error }
        dogs.removeAll { $0.id == id && $0.ownerID == ownerID }
    }

    func uploadDogPhoto(data: Data, dogID: String) async throws -> String {
        uploadDogPhotoCallCount += 1
        try await Task.sleep(for: .milliseconds(200))
        if let error = stubbedError { throw error }
        return stubbedDogPhotoURL
    }
}
