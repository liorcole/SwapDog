//
//  AuthRepositoryProtocol.swift
//  SwapDog
//
//  Contract for Firebase Authentication operations.
//  Concrete implementation: FirebaseAuthRepository (same folder).
//  Test/preview substitute: MockAuthRepository (Tests/Mocks/).
//
//  IMPORTANT: No Firebase types appear in this signature.
//  All parameters and return types are Foundation primitives or app models.
//

import Foundation

// MARK: - AuthRepositoryProtocol

/// Defines the contract for user authentication operations.
///
/// The protocol abstracts Firebase Auth so ViewModels and Services
/// never import FirebaseAuth directly. Swap the concrete type in
/// `DependencyContainer` to replace the backend or inject mocks.
protocol AuthRepositoryProtocol: AnyObject, Sendable {

    // MARK: Sign-Up / Sign-In

    /// Creates a new Firebase Auth account and returns the new `User`.
    ///
    /// - Parameters:
    ///   - email: The user's email address.
    ///   - password: The plaintext password (never stored by the app).
    /// - Returns: A freshly-created `User` value seeded with the Auth UID.
    /// - Throws: `SwapDogError` if the email is already in use or the password is too weak.
    func signUp(email: String, password: String) async throws -> User

    /// Signs in with an existing Firebase Auth account.
    ///
    /// - Parameters:
    ///   - email: The registered email address.
    ///   - password: The account password.
    /// - Returns: The authenticated `User`.
    /// - Throws: `SwapDogError.unauthorized` if credentials are wrong.
    func signIn(email: String, password: String) async throws -> User

    // MARK: Sign-Out

    /// Signs the current user out of Firebase Auth.
    ///
    /// - Throws: `SwapDogError` if the sign-out fails (rare).
    func signOut() throws

    // MARK: Current User

    /// The Firebase UID of the currently signed-in user, or `nil` if signed out.
    var currentUserID: String? { get }

    // MARK: Auth State Stream

    /// Emits the current user's UID whenever auth state changes.
    ///
    /// Yields `nil` when the user signs out, and a non-nil UID when they sign in.
    /// The stream never completes — it stays active for the app lifetime.
    ///
    /// - Returns: An `AsyncStream` of optional UID strings.
    func authStateChanges() -> AsyncStream<String?>

    // MARK: Account Management

    /// Permanently deletes the current user's Firebase Auth account.
    ///
    /// - Throws: `SwapDogError.unauthorized` if re-authentication is required.
    func deleteAccount() async throws
}
