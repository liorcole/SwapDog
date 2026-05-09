//
//  SwapDogError.swift
//  SwapDog
//
//  Domain-level error type for the entire SwapDog app.
//  All repository and service layers catch low-level errors and re-throw
//  as SwapDogError so ViewModels deal with a single, predictable error type.
//

import Foundation

// MARK: - SwapDogError

/// Represents every failure mode in the SwapDog domain.
///
/// Repository implementations map Firebase, network, and codec errors
/// onto these cases before propagating them to callers. This keeps
/// Firestore-specific error types out of the ViewModel layer.
///
/// Conforms to `LocalizedError` so SwiftUI `.alert(error:)` works
/// out of the box.
enum SwapDogError: LocalizedError {

    // MARK: Cases

    /// A network request could not be completed (no connectivity, timeout, etc.).
    case networkError

    /// The requested resource does not exist in the remote data store.
    case notFound

    /// The current user is not authorised to perform the requested operation.
    case unauthorized

    /// A model type could not be serialised to the wire format.
    case encodingError

    /// A server response could not be deserialised into a model type.
    case decodingError

    /// Required fields are missing or have invalid values.
    case invalidData

    /// A file upload to Firebase Storage failed.
    case uploadFailed

    /// The operation was blocked because the rate limit was exceeded.
    case rateLimitExceeded

    /// The user account could not be created (e.g. email already in use).
    case accountCreationFailed(String)

    /// A wrapping case for unexpected errors not mapped to a specific case.
    case unknown(Error)

    // MARK: - LocalizedError

    /// A user-facing description of the error suitable for display in an alert.
    var errorDescription: String? {
        switch self {
        case .networkError:
            return "Unable to connect. Please check your internet connection and try again."
        case .notFound:
            return "The requested item could not be found. It may have been deleted."
        case .unauthorized:
            return "You don't have permission to perform this action. Please sign in again."
        case .encodingError:
            return "There was a problem preparing your data. Please try again."
        case .decodingError:
            return "There was a problem reading data from the server. Please try again later."
        case .invalidData:
            return "Some required information is missing or invalid. Please check your input."
        case .uploadFailed:
            return "The image upload failed. Please check your connection and try again."
        case .rateLimitExceeded:
            return "Too many requests. Please wait a moment before trying again."
        case .accountCreationFailed(let reason):
            return "Could not create your account: \(reason)"
        case .unknown(let error):
            return "An unexpected error occurred: \(error.localizedDescription)"
        }
    }

    /// A failure reason suitable for logging (more technical than errorDescription).
    var failureReason: String? {
        switch self {
        case .networkError:         return "Network connectivity failure"
        case .notFound:             return "Document not found in Firestore"
        case .unauthorized:         return "Firebase Auth permission denied"
        case .encodingError:        return "JSONEncoder / Firestore serialisation failure"
        case .decodingError:        return "JSONDecoder / Firestore deserialisation failure"
        case .invalidData:          return "Missing or malformed required fields"
        case .uploadFailed:         return "Firebase Storage upload error"
        case .rateLimitExceeded:    return "Firebase quota exceeded"
        case .accountCreationFailed(let r): return "Auth account creation error: \(r)"
        case .unknown(let e):       return e.localizedDescription
        }
    }
}

// MARK: - Equatable (convenience for unit tests)

extension SwapDogError: Equatable {
    static func == (lhs: SwapDogError, rhs: SwapDogError) -> Bool {
        switch (lhs, rhs) {
        case (.networkError,      .networkError):      return true
        case (.notFound,          .notFound):          return true
        case (.unauthorized,      .unauthorized):      return true
        case (.encodingError,     .encodingError):     return true
        case (.decodingError,     .decodingError):     return true
        case (.invalidData,       .invalidData):       return true
        case (.uploadFailed,      .uploadFailed):      return true
        case (.rateLimitExceeded, .rateLimitExceeded): return true
        case (.accountCreationFailed(let l), .accountCreationFailed(let r)): return l == r
        case (.unknown, .unknown):                     return true
        default:                                       return false
        }
    }
}
