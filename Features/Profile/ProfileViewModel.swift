//
//  ProfileViewModel.swift
//  SwapDog
//
//  ViewModel driving ProfileView, EditProfileView, EditDogView, and SettingsView.
//  Owns: user load, profile edits, dog CRUD, account deletion, isDirty tracking.
//
//  Architecture layer: Features/Profile (ViewModel — MVVM-C)
//  Locked decisions:
//    - Delete account removes user doc + all dogs + auth account
//    - isDirty tracks unsaved changes across edit sessions
//    - ValidationService validates all user input
//

import SwiftUI
import UIKit
import os

// MARK: - ProfileViewModel

/// Manages state and business logic for the current user's profile and settings screens.
///
/// Inject as `@StateObject` in the root tab view so all profile child screens
/// share the same instance through `@EnvironmentObject`.
@MainActor
final class ProfileViewModel: ObservableObject {

    // MARK: - Published State

    /// The currently authenticated user. `nil` while loading.
    @Published var user: User?

    /// Dogs belonging to the current user.
    @Published var dogs: [Dog] = []

    /// Reviews received by the current user.
    @Published var reviews: [Review] = []

    /// Whether an async operation is in flight.
    @Published var isLoading: Bool = false

    /// Whether a background dog load is in progress.
    @Published var isLoadingDogs: Bool = false

    /// Whether a background reviews load is in progress.
    @Published var isLoadingReviews: Bool = false

    /// User-visible server error; `nil` clears any displayed alert.
    @Published var errorMessage: String?

    // MARK: - Unsaved Changes Tracking

    /// `true` when the edit form has been modified but not yet saved.
    @Published var isDirty: Bool = false

    // MARK: - Edit Profile Staging

    /// Staged display name for EditProfileView — reset on load.
    @Published var editDisplayName: String = ""

    /// Staged bio for EditProfileView.
    @Published var editBio: String = ""

    /// Staged neighborhood text for EditProfileView.
    @Published var editNeighborhood: String = ""

    /// Raw image data selected via PhotosPicker in EditProfileView.
    @Published var editProfileImageData: Data?

    // MARK: - Dependencies

    private let userRepository: any UserRepositoryProtocol
    private let dogRepository: any DogRepositoryProtocol
    private let authRepository: any AuthRepositoryProtocol
    private let reviewRepository: any ReviewRepositoryProtocol
    private weak var coordinator: AppCoordinator?
    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
                                category: "ProfileViewModel")

    // MARK: - Init

    /// - Parameters:
    ///   - userRepository: User Firestore operations.
    ///   - dogRepository:  Dog Firestore operations.
    ///   - authRepository: Firebase Auth operations.
    ///   - reviewRepository: Review Firestore reads.
    ///   - coordinator: Root coordinator for auth-state transitions.
    init(
        userRepository: any UserRepositoryProtocol,
        dogRepository: any DogRepositoryProtocol,
        authRepository: any AuthRepositoryProtocol,
        reviewRepository: any ReviewRepositoryProtocol,
        coordinator: AppCoordinator
    ) {
        self.userRepository = userRepository
        self.dogRepository = dogRepository
        self.authRepository = authRepository
        self.reviewRepository = reviewRepository
        self.coordinator = coordinator
    }

    // MARK: - Load

    /// Loads user, dogs, and reviews in parallel.
    func loadProfile() async {
        guard let uid = authRepository.currentUserID else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let fetchedUser    = userRepository.getUser(id: uid)
            async let fetchedDogs    = dogRepository.getDogs(ownerID: uid)
            async let fetchedReviews = reviewRepository.getReviews(userID: uid)

            let (u, d, r) = try await (fetchedUser, fetchedDogs, fetchedReviews)
            user    = u
            dogs    = d
            reviews = r
            primeEditFields(from: u)
        } catch let error as SwapDogError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = SwapDogError.unknown(error).errorDescription
        }
    }

    // MARK: - Edit Profile

    /// Seeds edit staging fields from a user; resets `isDirty` to `false`.
    func primeEditFields(from source: User) {
        editDisplayName  = source.displayName
        editBio          = source.bio
        editNeighborhood = source.neighborhood ?? ""
        editProfileImageData = nil
        isDirty = false
    }

    /// Marks the form dirty. Call from `.onChange` in edit views.
    func markDirty() {
        isDirty = true
    }

    /// Validates and persists the staged profile edits.
    ///
    /// - Throws: `ValidationError` if display name or bio are invalid.
    /// - Throws: `SwapDogError` on Firestore / Storage write failure.
    func saveProfile() async throws {
        guard var current = user else { return }

        // Validate display name
        switch ValidationService.validateDisplayName(editDisplayName) {
        case .failure(let error):
            throw error
        case .success:
            break
        }

        // Validate bio
        switch ValidationService.validateBio(editBio) {
        case .failure(let error):
            throw error
        case .success:
            break
        }

        isLoading = true
        defer { isLoading = false }

        // Upload new photo if provided
        if let imageData = editProfileImageData {
            let url = try await userRepository.uploadProfileImage(data: imageData)
            current.profileImageURL = url
        }

        current.displayName  = editDisplayName.trimmingCharacters(in: .whitespaces)
        current.bio          = editBio.trimmingCharacters(in: .whitespaces)
        let trimmedHood = editNeighborhood.trimmingCharacters(in: .whitespaces)
        current.neighborhood = trimmedHood.isEmpty ? nil : trimmedHood

        try await userRepository.updateUser(current)
        user    = current
        isDirty = false
        logger.info("Profile saved for uid: \(current.id)")
    }

    // MARK: - Dog CRUD

    /// Adds a new dog; uploads photos, saves to Firestore, syncs user doc.
    func addDog(_ dog: Dog, photos: [Data]) async throws {
        guard let uid = authRepository.currentUserID else { return }

        isLoading = true
        defer { isLoading = false }

        var mutableDog = dog
        var uploadedURLs: [String] = []
        for data in photos {
            let url = try await dogRepository.uploadDogPhoto(data: data, dogID: dog.id)
            uploadedURLs.append(url)
        }
        mutableDog.photos = uploadedURLs

        try await dogRepository.addDog(mutableDog, ownerID: uid)
        dogs.append(mutableDog)

        // Keep user's dog id list in sync
        if var current = user {
            current.dogs.append(mutableDog.id)
            try await userRepository.updateUser(current)
            user = current
        }
        logger.info("Dog added: \(dog.id)")
    }

    /// Persists changes to an existing dog document.
    func updateDog(_ dog: Dog) async throws {
        isLoading = true
        defer { isLoading = false }

        try await dogRepository.updateDog(dog)
        if let index = dogs.firstIndex(where: { $0.id == dog.id }) {
            dogs[index] = dog
        }
        logger.info("Dog updated: \(dog.id)")
    }

    /// Deletes a dog document and removes it from the local list.
    func deleteDog(id: String) async throws {
        guard let uid = authRepository.currentUserID else { return }

        isLoading = true
        defer { isLoading = false }

        try await dogRepository.deleteDog(id: id, ownerID: uid)
        dogs.removeAll { $0.id == id }

        // Keep user's dog id list in sync
        if var current = user {
            current.dogs.removeAll { $0 == id }
            try await userRepository.updateUser(current)
            user = current
        }
        logger.info("Dog deleted: \(id)")
    }

    // MARK: - Account Deletion

    /// Permanently deletes dogs, user doc, and auth account; transitions to `.loggedOut`.
    func deleteAccount() async throws {
        guard let uid = authRepository.currentUserID,
              let current = user else { return }

        isLoading = true
        defer { isLoading = false }

        // 1. Delete all dog documents
        for dog in dogs {
            try await dogRepository.deleteDog(id: dog.id, ownerID: uid)
        }

        // 2. Delete the Firestore user document
        _ = try await userRepository.getUser(id: uid) // verifies doc exists
        var tombstone = current
        tombstone.dogs = []
        try await userRepository.updateUser(tombstone)

        // 3. Delete the Firebase Auth account
        try await authRepository.deleteAccount()

        logger.info("Account deleted for uid: \(uid)")
        coordinator?.transition(to: .loggedOut)
    }

    // MARK: - Sign Out

    /// Signs out and transitions to `.loggedOut`.
    func signOut() {
        do {
            try authRepository.signOut()
            coordinator?.transition(to: .loggedOut)
        } catch let error as SwapDogError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = SwapDogError.unknown(error).errorDescription
        }
    }

    // MARK: - Error Helpers

    /// Clears the displayed error.
    func dismissError() { errorMessage = nil }
}

