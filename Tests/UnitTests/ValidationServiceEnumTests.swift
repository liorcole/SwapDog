//
//  ValidationServiceEnumTests.swift
//  SwapDogTests
//
//  Continuation of ValidationServiceTests — covers enum validations, date ranges,
//  swap status, message/review text, ratings, and error descriptions.
//
//  Split from ValidationServiceTests.swift to keep each file under 300 lines.
//  (Original file covered: DisplayName, Bio, Email, Dog Name, Breed, Dog Photos, Dog Age, Dog Size.)
//
//  Convention:
//  - Test functions are named: test_<method>_<scenario>
//  - Force unwraps (!) are allowed in test files per project conventions.
//  - Use XCTest for all tests (consistent with project's existing test suite).
//

import XCTest
@testable import SwapDog

// MARK: - ValidationServiceEnumTests

final class ValidationServiceEnumTests: XCTestCase {

    // =========================================================================
    // MARK: - Energy Level Enum  (firestore.rules: energy_level in ['low','moderate','high'])
    // =========================================================================

    func test_validateEnergyLevel_allValidValues_succeed() {
        for raw in ["low", "moderate", "high"] {
            XCTAssertNoThrow(
                try ValidationService.validateEnergyLevel(raw).get(),
                "'\(raw)' should be a valid energy level"
            )
        }
    }

    func test_validateEnergyLevel_invalidValue_fails() {
        let result = ValidationService.validateEnergyLevel("extreme")
        if case .failure(let error) = result, case .invalidStatus = error { /* pass */ }
        else { XCTFail("Expected .invalidStatus for 'extreme' energy level") }
    }

    // =========================================================================
    // MARK: - Date Range  (firestore.rules: start_date < end_date)
    // =========================================================================

    func test_validateDateRange_validRange_succeeds() {
        let start = Date().addingTimeInterval(60 * 60 * 24)     // tomorrow
        let end   = Date().addingTimeInterval(60 * 60 * 24 * 3) // 3 days from now
        XCTAssertNoThrow(
            try ValidationService.validateDateRange(start: start, end: end).get(),
            "Valid future date range should succeed"
        )
    }

    func test_validateDateRange_endBeforeStart_fails() {
        let start = Date().addingTimeInterval(60 * 60 * 24 * 5)
        let end   = Date().addingTimeInterval(60 * 60 * 24 * 2)
        let result = ValidationService.validateDateRange(start: start, end: end)
        if case .failure(let error) = result, case .invalidDateRange = error { /* pass */ }
        else { XCTFail("Expected .invalidDateRange when end < start") }
    }

    func test_validateDateRange_endEqualsStart_fails() {
        let date = Date().addingTimeInterval(60 * 60 * 24 * 2)
        let result = ValidationService.validateDateRange(start: date, end: date)
        if case .failure(let error) = result, case .invalidDateRange = error { /* pass */ }
        else { XCTFail("Expected .invalidDateRange when end == start") }
    }

    func test_validateDateRange_startInPast_fails() {
        let start = Date().addingTimeInterval(-60 * 60 * 24)   // yesterday
        let end   = Date().addingTimeInterval(60 * 60 * 24)    // tomorrow
        let result = ValidationService.validateDateRange(start: start, end: end)
        if case .failure(let error) = result, case .dateInPast = error { /* pass */ }
        else { XCTFail("Expected .dateInPast when start date is yesterday") }
    }

    func test_validateDateRange_startTooFarOut_fails() {
        let start = Date().addingTimeInterval(60 * 60 * 24 * 366) // 366 days from now
        let end   = Date().addingTimeInterval(60 * 60 * 24 * 370)
        let result = ValidationService.validateDateRange(start: start, end: end)
        if case .failure(let error) = result, case .dateTooFarOut(let days) = error {
            XCTAssertEqual(days, 365)
        } else {
            XCTFail("Expected .dateTooFarOut for start date 366 days out")
        }
    }

    // =========================================================================
    // MARK: - Swap Status  (firestore.rules: status in [...])
    // =========================================================================

    func test_validateSwapStatus_allValidValues_succeed() {
        for raw in ["pending", "accepted", "declined", "completed", "cancelled"] {
            XCTAssertNoThrow(
                try ValidationService.validateSwapStatus(raw).get(),
                "'\(raw)' should be a valid swap status"
            )
        }
    }

    func test_validateSwapStatus_unknownValue_fails() {
        let result = ValidationService.validateSwapStatus("archived")
        if case .failure(let error) = result, case .invalidStatus(let s) = error {
            XCTAssertEqual(s, "archived")
        } else {
            XCTFail("Expected .invalidStatus for 'archived'")
        }
    }

    // =========================================================================
    // MARK: - Message Text  (firestore.rules: text.size() > 0 && text.size() <= 2000)
    // =========================================================================

    func test_validateMessageText_emptyString_fails() {
        let result = ValidationService.validateMessageText("")
        if case .failure(let error) = result, case .emptyField = error { /* pass */ }
        else { XCTFail("Expected .emptyField for empty message") }
    }

    func test_validateMessageText_oneChar_succeeds() {
        XCTAssertNoThrow(
            try ValidationService.validateMessageText("A").get(),
            "Single-character message should be valid"
        )
    }

    func test_validateMessageText_2000Chars_succeeds() {
        let text = String(repeating: "A", count: 2_000)
        XCTAssertNoThrow(
            try ValidationService.validateMessageText(text).get(),
            "2000-character message should be valid (at the limit)"
        )
    }

    func test_validateMessageText_2001Chars_fails() {
        let text = String(repeating: "A", count: 2_001)
        let result = ValidationService.validateMessageText(text)
        if case .failure(let error) = result, case .tooLong(let field, let max) = error {
            XCTAssertEqual(field, "Message")
            XCTAssertEqual(max, 2_000)
        } else {
            XCTFail("Expected .tooLong for 2001-character message")
        }
    }

    // =========================================================================
    // MARK: - Rating  (firestore.rules: rating >= 1 && rating <= 5)
    // =========================================================================

    func test_validateRating_zero_fails() {
        let result = ValidationService.validateRating(0)
        if case .failure(let error) = result,
           case .outOfRange(let field, let min, let max) = error {
            XCTAssertEqual(field, "Rating")
            XCTAssertEqual(min, 1)
            XCTAssertEqual(max, 5)
        } else {
            XCTFail("Expected .outOfRange for rating 0")
        }
    }

    func test_validateRating_one_succeeds() {
        XCTAssertNoThrow(
            try ValidationService.validateRating(1).get(),
            "Rating of 1 should be valid (minimum)"
        )
    }

    func test_validateRating_three_succeeds() {
        XCTAssertNoThrow(
            try ValidationService.validateRating(3).get(),
            "Rating of 3 should be valid (midpoint)"
        )
    }

    func test_validateRating_five_succeeds() {
        XCTAssertNoThrow(
            try ValidationService.validateRating(5).get(),
            "Rating of 5 should be valid (maximum)"
        )
    }

    func test_validateRating_six_fails() {
        let result = ValidationService.validateRating(6)
        if case .failure(let error) = result,
           case .outOfRange(let field, let min, let max) = error {
            XCTAssertEqual(field, "Rating")
            XCTAssertEqual(min, 1)
            XCTAssertEqual(max, 5)
        } else {
            XCTFail("Expected .outOfRange for rating 6")
        }
    }

    func test_validateRating_negative_fails() {
        let result = ValidationService.validateRating(-1)
        if case .failure = result { /* pass */ }
        else { XCTFail("Expected failure for negative rating") }
    }

    // =========================================================================
    // MARK: - Review Text  (firestore.rules: text.size() > 0 && text.size() <= 1000)
    // =========================================================================

    func test_validateReviewText_emptyString_fails() {
        let result = ValidationService.validateReviewText("")
        if case .failure(let error) = result, case .emptyField = error { /* pass */ }
        else { XCTFail("Expected .emptyField for empty review text") }
    }

    func test_validateReviewText_oneChar_succeeds() {
        XCTAssertNoThrow(
            try ValidationService.validateReviewText("A").get(),
            "Single-character review should be valid"
        )
    }

    func test_validateReviewText_1000Chars_succeeds() {
        let text = String(repeating: "A", count: 1_000)
        XCTAssertNoThrow(
            try ValidationService.validateReviewText(text).get(),
            "1000-character review should be valid (at the limit)"
        )
    }

    func test_validateReviewText_1001Chars_fails() {
        let text = String(repeating: "A", count: 1_001)
        let result = ValidationService.validateReviewText(text)
        if case .failure(let error) = result, case .tooLong(let field, let max) = error {
            XCTAssertEqual(field, "Review")
            XCTAssertEqual(max, 1_000)
        } else {
            XCTFail("Expected .tooLong for 1001-character review text")
        }
    }

    // =========================================================================
    // MARK: - Error Message Content
    // =========================================================================

    func test_errorDescription_emptyField_containsFieldName() {
        let error = ValidationError.emptyField("Display name")
        XCTAssertTrue(
            error.errorDescription?.contains("Display name") == true,
            "Error description should contain the field name"
        )
    }

    func test_errorDescription_tooLong_containsMaxValue() {
        let error = ValidationError.tooLong(field: "Bio", max: 500)
        let desc = error.errorDescription ?? ""
        XCTAssertTrue(desc.contains("500"), "Error description should contain the max length")
    }

    func test_errorDescription_outOfRange_containsBounds() {
        let error = ValidationError.outOfRange(field: "Rating", min: 1, max: 5)
        let desc = error.errorDescription ?? ""
        XCTAssertTrue(
            desc.contains("1") && desc.contains("5"),
            "Error description should contain range bounds"
        )
    }

    func test_errorDescription_invalidDateRange_isUserFriendly() {
        let desc = ValidationError.invalidDateRange.errorDescription ?? ""
        XCTAssertFalse(desc.isEmpty,
                       "invalidDateRange should have a non-empty error description")
        XCTAssertFalse(desc.contains("Error"),
                       "Error description should not expose technical 'Error' terminology")
    }
}
