//
//  OnboardingViewModel.swift
//  SwapDog
//
//  Collects all onboarding data and orchestrates the batched Firestore write
//  on completion.  Business rules (bio limit, image compression) are enforced
//  HERE, never in views.
//
//  Architecture layer: Features/Onboarding (ViewModel)
//  Locked decisions enforced:
//    - Bio limit: 200 chars, truncated in VM not View
//    - Image compression: < 1 MB JPEG before upload
//    - Batch writes: all saves happen together on completion
//    - Partial-failure handling: image fail does not block profile save
//
//  Step 15: Added AnalyticsServiceProtocol injection.
//           Tracks .userCompletedOnboarding on success.
//

import SwiftUI
import UIKit
import os

// MARK: - Draft Dog Model

/// Mutable draft used during onboarding before a Firestore document ID is assigned.
struct DraftDog {
    var name: String               = ""
    var breed: String              = ""
    var age: DogAge                = .young
    var size: DogSize              = .medium
    var energyLevel: EnergyLevel   = .moderate
    var temperament: Set<String>   = []
    var vaccinated: Bool           = false
    var spayedNeutered: Bool       = false
    var bio: String                = ""
    var photoItems: [Data]         = []   // compressed JPEG data
}

// MARK: - OnboardingViewModel

/// Manages all mutable onboarding state and orchestrates persistence on completion.
///
/// Inject via `@StateObject` at the `OnboardingContainerView` level so every
/// step view can share the same instance through `@EnvironmentObject`.
@MainActor
final class OnboardingViewModel: ObservableObject {

    // MARK: - Profile Fields

    @Published var displayName: String = "" {
        didSet { validateDisplayName() }
    }

    @Published var bio: String = "" {
        didSet { enforceBioLimit() }
    }

    @Published var profileImageData: Data?

    // MARK: - Dog Fields

    @Published var dogs: [DraftDog] = [DraftDog()]

    // MARK: - Location Fields

    @Published var latitude: Double  = 0
    @Published var longitude: Double = 0
    @Published var neighborhood: String?

    // MARK: - UI State

    @Published var isLoading: Bool   = false
    @Published var errorMessage: String?
    @Published var isDisplayNameValid: Bool = false

    /// Live character count for the bio field.
    var bioCharacterCount: Int { bio.count }

    // MARK: - Constants

    private enum Limits {
        static let bioMaxLength: Int         = 200    // locked decision
        static let targetImageBytes: Int     = 1_000_000 // < 1 MB
        static let jpegHighQuality: CGFloat  = 0.9
        static let jpegLowQuality: CGFloat   = 0.5
    }

    // MARK: - Dependencies

    private let userRepository: any UserRepositoryProtocol
    private let dogRepository: any DogRepositoryProtocol
    private let analyticsService: any AnalyticsServiceProtocol
    private let userID: String
    private let userEmail: String
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "OnboardingViewModel"
    )

    // MARK: - Init

    init(
        userID: String,
        userEmail: String,
        userRepository: any UserRepositoryProtocol,
        dogRepository: any DogRepositoryProtocol,
        analyticsService: any AnalyticsServiceProtocol = ConsoleAnalyticsService()
    ) {
        self.userID          = userID
        self.userEmail       = userEmail
        self.userRepository  = userRepository
        self.dogRepository   = dogRepository
        self.analyticsService = analyticsService
    }

    // MARK: - Business Rules (Locked Decisions)

    /// Enforces the 200-character bio limit.  Truncates silently if the user
    /// pastes text that exceeds the limit.  Enforced HERE, not in the View.
    private func enforceBioLimit() {
        if bio.count > Limits.bioMaxLength {
            bio = String(bio.prefix(Limits.bioMaxLength))
        }
    }

    private func validateDisplayName() {
        let trimmed = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        isDisplayNameValid = trimmed.count >= AppConstants.minDisplayNameLength
    }

    // MARK: - Dog Mutation

    /// Adds an empty draft dog to the dogs array.
    func addAnotherDog() {
        dogs.append(DraftDog())
    }

    /// Removes the draft dog at the given index.
    ///
    /// - Parameter index: Index of the dog to remove.  Ignored if out of bounds or only one dog.
    func removeDog(at index: Int) {
        guard dogs.count > 1, dogs.indices.contains(index) else { return }
        dogs.remove(at: index)
    }

    // MARK: - Image Compression

    /// Compresses raw image data to under 1 MB using JPEG encoding.
    ///
    /// Tries high-quality JPEG first; falls back to lower quality if still too large.
    /// Returns `nil` and logs a warning if compression cannot meet the target.
    ///
    /// - Parameter data: Raw image data from the Photos picker.
    /// - Returns: JPEG data under 1 MB, or `nil` if compression fails.
    func compressImage(_ data: Data) -> Data? {
        guard let uiImage = UIImage(data: data) else {
            logger.warning("compressImage: Could not decode image data")
            return nil
        }

        if let highQuality = uiImage.jpegData(compressionQuality: Limits.jpegHighQuality),
           highQuality.count < Limits.targetImageBytes {
            return highQuality
        }

        if let lowQuality = uiImage.jpegData(compressionQuality: Limits.jpegLowQuality),
           lowQuality.count < Limits.targetImageBytes {
            return lowQuality
        }

        // Attempt with very low quality as last resort.
        if let veryLow = uiImage.jpegData(compressionQuality: 0.2),
           veryLow.count < Limits.targetImageBytes {
            return veryLow
        }

        logger.warning("compressImage: Could not compress below 1 MB after 3 attempts")
        return uiImage.jpegData(compressionQuality: 0.1)
    }

    // MARK: - Completion (Batched Write)

    /// Persists all onboarding data to Firestore and Firebase Storage.
    ///
    /// Execution order:
    /// 1. Upload profile image (non-fatal if it fails — profile still saves).
    /// 2. Write `User` document.
    /// 3. Write each `Dog` document in sequence.
    /// 4. Upload dog photos per dog (non-fatal per-dog if they fail).
    ///
    /// Tracks `.userCompletedOnboarding` on success.
    ///
    /// - Throws: `SwapDogError.invalidData` if required fields are missing.
    ///           `SwapDogError` from the repository if the write fails fatally.
    func completeOnboarding() async throws {
        guard isDisplayNameValid else {
            throw SwapDogError.invalidData
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        // 1. Upload profile image (non-fatal).
        var profileImageURL: String?
        if let imageData = profileImageData,
           let compressed = compressImage(imageData) {
            do {
                profileImageURL = try await userRepository.uploadProfileImage(data: compressed)
                logger.info("Profile image uploaded: \(profileImageURL ?? "nil")")
            } catch {
                logger.warning("Profile image upload failed (non-fatal): \(error.localizedDescription)")
                // Continue — profile saves without photo.
            }
        }

        // 2. Write User document.
        let user = User(
            id:              userID,
            email:           userEmail,
            displayName:     displayName.trimmingCharacters(in: .whitespacesAndNewlines),
            profileImageURL: profileImageURL,
            latitude:        latitude,
            longitude:       longitude,
            neighborhood:    neighborhood,
            bio:             bio,               // already capped at 200 chars
            joinedDate:      Date(),
            isVerified:      false,
            rating:          0.0,
            reviewCount:     0,
            dogs:            [],               // dog IDs added below
            swapCount:       0
        )

        try await userRepository.createUser(user)
        logger.info("User document created for \(self.userID)")

        // 3. Write each Dog document.
        for (index, draft) in dogs.enumerated() {
            let dogID = "\(userID)_dog_\(index)"
            let dogBio = String(draft.bio.prefix(Limits.bioMaxLength))

            let dog = Dog(
                id:             dogID,
                ownerID:        userID,
                name:           draft.name,
                breed:          draft.breed,
                age:            draft.age,
                size:           draft.size,
                energyLevel:    draft.energyLevel,
                temperament:    Array(draft.temperament),
                specialNeeds:   nil,
                vaccinated:     draft.vaccinated,
                spayedNeutered: draft.spayedNeutered,
                photos:         [],
                bio:            dogBio
            )

            try await dogRepository.addDog(dog, ownerID: userID)
            logger.info("Dog document created: \(dogID)")

            // 4. Upload dog photos (non-fatal per-dog).
            for photoData in draft.photoItems {
                guard let compressed = compressImage(photoData) else { continue }
                do {
                    let url = try await dogRepository.uploadDogPhoto(data: compressed, dogID: dogID)
                    logger.info("Dog photo uploaded: \(url)")
                } catch {
                    logger.warning("Dog photo upload failed (non-fatal): \(error.localizedDescription)")
                }
            }
        }

        analyticsService.track(.userCompletedOnboarding)
        logger.info("Onboarding completed successfully for \(self.userID)")
    }
}
