//
//  FirebaseAuthRepository.swift
//  SwapDog
//
//  Firebase Authentication–backed implementation of AuthRepositoryProtocol.
//
//  Firebase imports are commented out until GoogleService-Info.plist is added.
//  Every method is stubbed with TODO markers so the compiler keeps the full
//  async/await structure in place.
//
//

import Foundation
import os
import FirebaseAuth
import FirebaseCore

// MARK: - FirebaseAuthRepository

/// Concrete Firebase implementation of `AuthRepositoryProtocol`.
///
/// All Firebase errors are caught internally and re-thrown as `SwapDogError`
/// so the ViewModel layer never imports FirebaseAuth.
final class FirebaseAuthRepository: AuthRepositoryProtocol {

    // MARK: - Private

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.swapdog.app",
        category: "FirebaseAuthRepository"
    )

    // MARK: - AuthRepositoryProtocol

    func signUp(email: String, password: String) async throws -> User {
        logger.info("signUp called for email: \(email, privacy: .private)")
        do {
            let result = try await Auth.auth().createUser(withEmail: email, password: password)
            let firebaseUser = result.user
            return User(
                id: firebaseUser.uid,
                email: email,
                displayName: firebaseUser.displayName ?? "",
                latitude: 0, longitude: 0, bio: "",
                joinedDate: Date(), isVerified: false,
                rating: 0, reviewCount: 0, dogs: [], swapCount: 0
            )
        } catch let error as SwapDogError {
            logger.error("signUp failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("signUp unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.accountCreationFailed(error.localizedDescription)
        }
    }

    func signIn(email: String, password: String) async throws -> User {
        logger.info("signIn called for email: \(email, privacy: .private)")
        do {
            let result = try await Auth.auth().signIn(withEmail: email, password: password)
            let uid = result.user.uid
            // (fetch User from Firestore via UserRepository or return minimal struct)
            throw SwapDogError.unknown(NSError(domain: "FirebaseNotConfigured", code: -1))
        } catch let error as SwapDogError {
            logger.error("signIn failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("signIn unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.unauthorized
        }
    }

    func signOut() throws {
        logger.info("signOut called")
        do {
            try Auth.auth().signOut()
        } catch {
            logger.error("signOut failed: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.unknown(error)
        }
    }

    var currentUserID: String? {
        return Auth.auth().currentUser?.uid
    }

    func authStateChanges() -> AsyncStream<String?> {
        return AsyncStream { continuation in
            let handle = Auth.auth().addStateDidChangeListener { _, user in
                continuation.yield(user?.uid)
            }
            continuation.onTermination = { _ in
                Auth.auth().removeStateDidChangeListener(handle)
            }
        }
    }

    func deleteAccount() async throws {
        logger.info("deleteAccount called")
        do {
            guard let user = Auth.auth().currentUser else {
                throw SwapDogError.unauthorized
            }
            try await user.delete()
        } catch let error as SwapDogError {
            logger.error("deleteAccount failed: \(error.localizedDescription, privacy: .public)")
            throw error
        } catch {
            logger.error("deleteAccount unexpected error: \(error.localizedDescription, privacy: .public)")
            throw SwapDogError.unknown(error)
        }
    }
}
