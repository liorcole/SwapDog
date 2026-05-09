//
//  String+Extensions.swift
//  SwapDog
//
//  String helpers used across the app for validation, formatting, and
//  sanitisation. All methods are pure — no side effects.

import Foundation

extension String {

    // MARK: - Validation

    /// Returns `true` if the string is a syntactically valid email address.
    ///
    /// Uses an RFC 5322 simplified regex. Network reachability and domain
    /// existence checks are performed server-side, not here.
    var isValidEmail: Bool {
        let pattern = #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#
        return range(of: pattern, options: .regularExpression) != nil
    }

    /// Returns `true` if the string meets SwapDog's minimum password requirements:
    /// at least 8 characters, one uppercase letter, one digit.
    var isValidPassword: Bool {
        guard count >= 8 else { return false }
        let hasUppercase = rangeOfCharacter(from: .uppercaseLetters) != nil
        let hasDigit = rangeOfCharacter(from: .decimalDigits) != nil
        return hasUppercase && hasDigit
    }

    /// Returns `true` if the string is non-empty after trimming whitespace.
    var isNotBlank: Bool {
        !trimmed.isEmpty
    }

    // MARK: - Formatting

    /// Returns the string with leading and trailing whitespace removed.
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Returns a capitalised version with leading/trailing whitespace removed.
    var trimmedAndCapitalised: String {
        trimmed.capitalized
    }

    /// Truncates the string to `maxLength` characters, appending `"…"` if needed.
    /// - Parameter maxLength: Maximum number of characters before truncation.
    func truncated(to maxLength: Int) -> String {
        guard count > maxLength else { return self }
        return String(prefix(maxLength)) + "…"
    }

    // MARK: - Sanitisation

    /// Returns the string with all whitespace sequences collapsed to a single space.
    var normalised: String {
        components(separatedBy: .whitespaces)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    /// Returns a slugified version suitable for path segments (lowercase, hyphens).
    var slugified: String {
        lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "-")
    }

    // MARK: - Display Helpers

    /// Returns `"—"` (em dash) if the string is blank, otherwise returns `self`.
    var orDash: String {
        isNotBlank ? self : "—"
    }

    /// Converts the first character to uppercase and the rest to lowercase.
    var sentenceCased: String {
        guard !isEmpty else { return self }
        return prefix(1).uppercased() + dropFirst().lowercased()
    }
}
