//
//  ValidationService.swift
//  SwapDog
//
//  Client-side validation that mirrors Firestore security rules exactly.
//  Every limit defined here must stay in sync with firestore.rules.
//
//  Rule:  No force unwraps. No magic strings. Every function < 20 lines.
//

import Foundation

// MARK: - ValidationError

/// Describes every way user-supplied input can fail validation.
///
/// Each case maps 1-to-1 with a validation expression in `firestore.rules`.
/// `errorDescription` returns a user-friendly message suitable for display
/// directly in SwiftUI alert dialogs and form error labels.
enum ValidationError: LocalizedError, Equatable {

    // General field errors
    case emptyField(String)
    case tooLong(field: String, max: Int)
    case tooShort(field: String, min: Int)

    // Format / value errors
    case invalidFormat(String)
    case outOfRange(field: String, min: Int, max: Int)
    case tooManyItems(field: String, max: Int)

    // Date errors
    case invalidDateRange        // end ≤ start
    case dateInPast              // start date is before today
    case dateTooFarOut(maxDays: Int)  // start date is too far in the future

    // Status errors
    case invalidStatus(String)

    // MARK: LocalizedError

    var errorDescription: String? {
        switch self {
        case .emptyField(let field):
            return "\(field) cannot be empty."
        case .tooLong(let field, let max):
            return "\(field) must be \(max) characters or fewer."
        case .tooShort(let field, let min):
            return "\(field) must be at least \(min) character\(min == 1 ? "" : "s")."
        case .invalidFormat(let field):
            return "\(field) is not in a valid format."
        case .outOfRange(let field, let min, let max):
            return "\(field) must be between \(min) and \(max)."
        case .tooManyItems(let field, let max):
            return "You can only add up to \(max) \(field)."
        case .invalidDateRange:
            return "End date must be after the start date."
        case .dateInPast:
            return "Start date must be today or in the future."
        case .dateTooFarOut(let maxDays):
            return "Start date cannot be more than \(maxDays) days from now."
        case .invalidStatus(let status):
            return "'\(status)' is not a recognised status."
        }
    }
}

// MARK: - Validation Limits
//
private enum Limits {
    // users/{userId} — validateUser()
    static let displayNameMin: Int = 1          // display_name.size() > 0
    static let displayNameMax: Int = 50         // display_name.size() <= 50
    static let bioMax: Int = 500                // bio.size() <= 500

    // users/{userId}/dogs/{dogId} — validateDog()
    static let dogNameMin: Int = 1              // name.size() > 0
    static let dogNameMax: Int = 50             // name.size() <= 50
    static let breedMin: Int = 1               // breed.size() > 0
    static let dogPhotosMax: Int = 5           // photos.size() <= 5

    // conversations/{convId}/messages/{msgId} — validateMessage()
    static let messageMin: Int = 1             // text.size() > 0
    static let messageMax: Int = 2_000         // text.size() <= 2000

    // reviews/{reviewId} — validateReview()
    static let ratingMin: Int = 1              // rating >= 1
    static let ratingMax: Int = 5              // rating <= 5
    static let reviewTextMin: Int = 1          // text.size() > 0
    static let reviewTextMax: Int = 1_000      // text.size() <= 1000

    // swap_requests — validateSwapRequest()
    static let maxSwapDaysOut: Int = 365       // future guard; no Firestore equivalent, client-only UX guard
}

// MARK: - Valid Enum Raw Values

private enum ValidRawValues {
    static let dogAge: Set<String> = ["puppy", "young", "adult", "senior"]
    static let dogSize: Set<String> = ["small", "medium", "large", "extra_large"]
    static let energyLevel: Set<String> = ["low", "moderate", "high"]
    static let swapStatus: Set<String> = ["pending", "accepted", "declined", "completed", "cancelled"]
}

// MARK: - ValidationService

/// Stateless service that mirrors all Firestore security rule validations.
///
/// Call each function before writing to Firestore. A `.failure` result
/// means the Firestore write would be rejected by the server rules.
///
/// Example:
/// ```swift
/// switch ValidationService.validateDisplayName(name) {
/// case .success:
///     // safe to write
/// case .failure(let error):
///     viewModel.displayError(error.localizedDescription)
/// }
/// ```
enum ValidationService {

    // MARK: - User Validation

    /// Validates `display_name` — mirrors `users/{userId}` validateUser() in firestore.rules.
    /// - Parameter name: The display name string to validate.
    static func validateDisplayName(_ name: String) -> Result<Void, ValidationError> {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            return .failure(.emptyField("Display name"))
        }
        if trimmed.count > Limits.displayNameMax {
            return .failure(.tooLong(field: "Display name", max: Limits.displayNameMax))
        }
        return .success(())
    }

    /// Validates `bio` — mirrors `users/{userId}` validateUser() in firestore.rules.
    /// An empty bio is allowed (the Firestore rule only checks `bio is string`).
    /// - Parameter bio: The bio string to validate.
    static func validateBio(_ bio: String) -> Result<Void, ValidationError> {
        if bio.count > Limits.bioMax {
            return .failure(.tooLong(field: "Bio", max: Limits.bioMax))
        }
        return .success(())
    }

    /// Validates `email` format — mirrors `email is string && email.size() > 0` in firestore.rules.
    /// - Parameter email: The email address string to validate.
    static func validateEmail(_ email: String) -> Result<Void, ValidationError> {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            return .failure(.emptyField("Email"))
        }
        // Basic structural check — must contain '@' and a '.' after it.
        let parts = trimmed.split(separator: "@")
        guard parts.count == 2, let domain = parts.last, domain.contains(".") else {
            return .failure(.invalidFormat("Email"))
        }
        return .success(())
    }

    // MARK: - Dog Validation

    /// Validates `name` — mirrors `dogs/{dogId}` validateDog() in firestore.rules.
    /// - Parameter name: The dog's name string to validate.
    static func validateDogName(_ name: String) -> Result<Void, ValidationError> {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            return .failure(.emptyField("Dog name"))
        }
        if trimmed.count > Limits.dogNameMax {
            return .failure(.tooLong(field: "Dog name", max: Limits.dogNameMax))
        }
        return .success(())
    }

    /// Validates `breed` — mirrors `dogs/{dogId}` validateDog() in firestore.rules.
    /// - Parameter breed: The breed description string to validate.
    static func validateBreed(_ breed: String) -> Result<Void, ValidationError> {
        let trimmed = breed.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            return .failure(.emptyField("Breed"))
        }
        return .success(())
    }

    /// Validates `photos` array length — mirrors `photos.size() <= 5` in firestore.rules.
    /// - Parameter photos: The array of photo URL strings to validate.
    static func validateDogPhotos(_ photos: [String]) -> Result<Void, ValidationError> {
        if photos.count > Limits.dogPhotosMax {
            return .failure(.tooManyItems(field: "photos", max: Limits.dogPhotosMax))
        }
        return .success(())
    }

    /// Validates `age` raw value — mirrors `age in [...]` in firestore.rules.
    /// - Parameter ageRawValue: The raw string value of a `DogAge`.
    static func validateDogAge(_ ageRawValue: String) -> Result<Void, ValidationError> {
        guard ValidRawValues.dogAge.contains(ageRawValue) else {
            return .failure(.invalidStatus("Dog age '\(ageRawValue)'"))
        }
        return .success(())
    }

    /// Validates `size` raw value — mirrors `size in [...]` in firestore.rules.
    /// - Parameter sizeRawValue: The raw string value of a `DogSize`.
    static func validateDogSize(_ sizeRawValue: String) -> Result<Void, ValidationError> {
        guard ValidRawValues.dogSize.contains(sizeRawValue) else {
            return .failure(.invalidStatus("Dog size '\(sizeRawValue)'"))
        }
        return .success(())
    }

    /// Validates `energy_level` raw value — mirrors `energy_level in [...]` in firestore.rules.
    /// - Parameter levelRawValue: The raw string value of an `EnergyLevel`.
    static func validateEnergyLevel(_ levelRawValue: String) -> Result<Void, ValidationError> {
        guard ValidRawValues.energyLevel.contains(levelRawValue) else {
            return .failure(.invalidStatus("Energy level '\(levelRawValue)'"))
        }
        return .success(())
    }

    // MARK: - SwapRequest Validation

    /// Validates the date range — mirrors `start_date < end_date` in firestore.rules.
    ///
    /// Also applies client-only UX guards (not past, not too far out) that
    /// are outside the scope of Firestore rules but necessary for a good UX.
    ///
    /// - Parameters:
    ///   - start: The proposed start date/time.
    ///   - end:   The proposed end date/time.
    /// - Returns: `.success` if valid; `.failure` with the specific `ValidationError` otherwise.
    static func validateDateRange(start: Date, end: Date) -> Result<Void, ValidationError> {
        if start >= end {
            return .failure(.invalidDateRange)
        }
        let now = Date()
        let startOfToday = Calendar.current.startOfDay(for: now)
        if start < startOfToday {
            return .failure(.dateInPast)
        }
        let maxDate = Calendar.current.date(
            byAdding: .day,
            value: Limits.maxSwapDaysOut,
            to: now
        ) ?? now
        if start > maxDate {
            return .failure(.dateTooFarOut(maxDays: Limits.maxSwapDaysOut))
        }
        return .success(())
    }

    /// Validates `status` raw value — mirrors `status in [...]` in firestore.rules.
    /// - Parameter statusRawValue: The raw string value of a `SwapStatus`.
    static func validateSwapStatus(_ statusRawValue: String) -> Result<Void, ValidationError> {
        guard ValidRawValues.swapStatus.contains(statusRawValue) else {
            return .failure(.invalidStatus(statusRawValue))
        }
        return .success(())
    }

    // MARK: - Message Validation

    /// Validates `text` — mirrors `validateMessage()` in firestore.rules.
    /// - Parameter text: The message body string to validate.
    static func validateMessageText(_ text: String) -> Result<Void, ValidationError> {
        if text.isEmpty {
            return .failure(.emptyField("Message"))
        }
        if text.count > Limits.messageMax {
            return .failure(.tooLong(field: "Message", max: Limits.messageMax))
        }
        return .success(())
    }

    // MARK: - Review Validation

    /// Validates `rating` — mirrors `rating >= 1 && rating <= 5` in firestore.rules.
    /// - Parameter rating: The integer star rating to validate.
    static func validateRating(_ rating: Int) -> Result<Void, ValidationError> {
        if rating < Limits.ratingMin || rating > Limits.ratingMax {
            return .failure(.outOfRange(field: "Rating", min: Limits.ratingMin, max: Limits.ratingMax))
        }
        return .success(())
    }

    /// Validates `text` — mirrors `text.size() > 0 && text.size() <= 1000` in firestore.rules.
    /// - Parameter text: The written review text to validate.
    static func validateReviewText(_ text: String) -> Result<Void, ValidationError> {
        if text.isEmpty {
            return .failure(.emptyField("Review"))
        }
        if text.count > Limits.reviewTextMax {
            return .failure(.tooLong(field: "Review", max: Limits.reviewTextMax))
        }
        return .success(())
    }
}
