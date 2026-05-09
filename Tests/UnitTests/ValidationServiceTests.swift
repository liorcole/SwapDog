//
//  ValidationServiceTests.swift
//  SwapDogTests
//
//  Comprehensive boundary tests for ValidationService.
//  Every test case maps to a corresponding expression in firestore.rules.
//
//  Convention:
//  - Test functions are named: test_<method>_<scenario>
//  - Force unwraps (!) are allowed in test files per project conventions.
//  - Use XCTest for all tests (consistent with project's existing test suite).
//

import XCTest
@testable import SwapDog

// MARK: - ValidationServiceTests

final class ValidationServiceTests: XCTestCase {

    // =========================================================================
    // MARK: - Display Name  (firestore.rules: display_name.size() > 0 && <= 50)
    // =========================================================================

    func test_validateDisplayName_emptyString_fails() {
        let result = ValidationService.validateDisplayName("")
        if case .failure(let error) = result {
            if case .emptyField(let field) = error {
                XCTAssertEqual(field, "Display name")
            } else {
                XCTFail("Expected .emptyField, got \(error)")
            }
        } else {
            XCTFail("Expected failure for empty display name")
        }
    }

    func test_validateDisplayName_whitespaceOnly_fails() {
        let result = ValidationService.validateDisplayName("   ")
        if case .failure(let error) = result, case .emptyField = error {
            // pass
        } else {
            XCTFail("Expected .emptyField for whitespace-only display name")
        }
    }

    func test_validateDisplayName_oneChar_succeeds() {
        XCTAssertNoThrow(
            try ValidationService.validateDisplayName("A").get(),
            "Single-character display name should be valid"
        )
    }

    func test_validateDisplayName_50Chars_succeeds() {
        let name = String(repeating: "A", count: 50)
        XCTAssertNoThrow(
            try ValidationService.validateDisplayName(name).get(),
            "50-character display name should be valid (at the limit)"
        )
    }

    func test_validateDisplayName_51Chars_fails() {
        let name = String(repeating: "A", count: 51)
        let result = ValidationService.validateDisplayName(name)
        if case .failure(let error) = result {
            if case .tooLong(let field, let max) = error {
                XCTAssertEqual(field, "Display name")
                XCTAssertEqual(max, 50)
            } else {
                XCTFail("Expected .tooLong, got \(error)")
            }
        } else {
            XCTFail("Expected failure for 51-character display name")
        }
    }

    // =========================================================================
    // MARK: - Bio  (firestore.rules: bio is string && bio.size() <= 500)
    // =========================================================================

    func test_validateBio_emptyString_succeeds() {
        // Empty bio is valid — firestore.rules only checks bio is string and length.
        XCTAssertNoThrow(
            try ValidationService.validateBio("").get(),
            "Empty bio should be valid"
        )
    }

    func test_validateBio_500Chars_succeeds() {
        let bio = String(repeating: "A", count: 500)
        XCTAssertNoThrow(
            try ValidationService.validateBio(bio).get(),
            "500-character bio should be valid (at the limit)"
        )
    }

    func test_validateBio_501Chars_fails() {
        let bio = String(repeating: "A", count: 501)
        let result = ValidationService.validateBio(bio)
        if case .failure(let error) = result {
            if case .tooLong(let field, let max) = error {
                XCTAssertEqual(field, "Bio")
                XCTAssertEqual(max, 500)
            } else {
                XCTFail("Expected .tooLong, got \(error)")
            }
        } else {
            XCTFail("Expected failure for 501-character bio")
        }
    }

    // =========================================================================
    // MARK: - Email  (firestore.rules: email is string && email.size() > 0)
    // =========================================================================

    func test_validateEmail_emptyString_fails() {
        let result = ValidationService.validateEmail("")
        if case .failure(let error) = result, case .emptyField = error { /* pass */ }
        else { XCTFail("Expected .emptyField for empty email") }
    }

    func test_validateEmail_validAddress_succeeds() {
        XCTAssertNoThrow(
            try ValidationService.validateEmail("lior@swapdog.com").get()
        )
    }

    func test_validateEmail_missingAtSign_fails() {
        let result = ValidationService.validateEmail("notanemail.com")
        if case .failure(let error) = result, case .invalidFormat = error { /* pass */ }
        else { XCTFail("Expected .invalidFormat for email missing '@'") }
    }

    func test_validateEmail_missingDomain_fails() {
        let result = ValidationService.validateEmail("user@")
        if case .failure(let error) = result, case .invalidFormat = error { /* pass */ }
        else { XCTFail("Expected .invalidFormat for email missing domain") }
    }

    // =========================================================================
    // MARK: - Dog Name  (firestore.rules: name.size() > 0 && name.size() <= 50)
    // =========================================================================

    func test_validateDogName_emptyString_fails() {
        let result = ValidationService.validateDogName("")
        if case .failure(let error) = result, case .emptyField(let f) = error {
            XCTAssertEqual(f, "Dog name")
        } else {
            XCTFail("Expected .emptyField for empty dog name")
        }
    }

    func test_validateDogName_whitespaceOnly_fails() {
        let result = ValidationService.validateDogName("   ")
        if case .failure(let error) = result, case .emptyField = error { /* pass */ }
        else { XCTFail("Expected .emptyField for whitespace-only dog name") }
    }

    func test_validateDogName_validName_succeeds() {
        XCTAssertNoThrow(
            try ValidationService.validateDogName("Luna").get()
        )
    }

    func test_validateDogName_50Chars_succeeds() {
        let name = String(repeating: "A", count: 50)
        XCTAssertNoThrow(
            try ValidationService.validateDogName(name).get(),
            "50-character dog name should be valid"
        )
    }

    func test_validateDogName_51Chars_fails() {
        let name = String(repeating: "A", count: 51)
        let result = ValidationService.validateDogName(name)
        if case .failure(let error) = result, case .tooLong(let field, let max) = error {
            XCTAssertEqual(field, "Dog name")
            XCTAssertEqual(max, 50)
        } else {
            XCTFail("Expected .tooLong for 51-character dog name")
        }
    }

    // =========================================================================
    // MARK: - Breed  (firestore.rules: breed.size() > 0)
    // =========================================================================

    func test_validateBreed_emptyString_fails() {
        let result = ValidationService.validateBreed("")
        if case .failure(let error) = result, case .emptyField = error { /* pass */ }
        else { XCTFail("Expected .emptyField for empty breed") }
    }

    func test_validateBreed_validBreed_succeeds() {
        XCTAssertNoThrow(
            try ValidationService.validateBreed("Golden Retriever").get()
        )
    }

    // =========================================================================
    // MARK: - Dog Photos  (firestore.rules: photos.size() <= 5)
    // =========================================================================

    func test_validateDogPhotos_emptyArray_succeeds() {
        // 0 photos is valid — the rule only checks photos.size() <= 5
        XCTAssertNoThrow(
            try ValidationService.validateDogPhotos([]).get(),
            "Empty photos array should be valid"
        )
    }

    func test_validateDogPhotos_onePhoto_succeeds() {
        let photos = ["https://example.com/photo1.jpg"]
        XCTAssertNoThrow(
            try ValidationService.validateDogPhotos(photos).get()
        )
    }

    func test_validateDogPhotos_fivePhotos_succeeds() {
        let photos = (1...5).map { "https://example.com/photo\($0).jpg" }
        XCTAssertNoThrow(
            try ValidationService.validateDogPhotos(photos).get(),
            "5 photos should be valid (at the limit)"
        )
    }

    func test_validateDogPhotos_sixPhotos_fails() {
        let photos = (1...6).map { "https://example.com/photo\($0).jpg" }
        let result = ValidationService.validateDogPhotos(photos)
        if case .failure(let error) = result, case .tooManyItems(let field, let max) = error {
            XCTAssertEqual(field, "photos")
            XCTAssertEqual(max, 5)
        } else {
            XCTFail("Expected .tooManyItems for 6 photos")
        }
    }

    // =========================================================================
    // MARK: - Dog Age Enum  (firestore.rules: age in ['puppy','young','adult','senior'])
    // =========================================================================

    func test_validateDogAge_allValidValues_succeed() {
        for raw in ["puppy", "young", "adult", "senior"] {
            XCTAssertNoThrow(
                try ValidationService.validateDogAge(raw).get(),
                "'\(raw)' should be a valid dog age"
            )
        }
    }

    func test_validateDogAge_invalidValue_fails() {
        let result = ValidationService.validateDogAge("ancient")
        if case .failure(let error) = result, case .invalidStatus = error { /* pass */ }
        else { XCTFail("Expected .invalidStatus for unknown dog age 'ancient'") }
    }

    // =========================================================================
    // MARK: - Dog Size Enum  (firestore.rules: size in ['small','medium','large','extra_large'])
    // =========================================================================

    func test_validateDogSize_allValidValues_succeed() {
        for raw in ["small", "medium", "large", "extra_large"] {
            XCTAssertNoThrow(
                try ValidationService.validateDogSize(raw).get(),
                "'\(raw)' should be a valid dog size"
            )
        }
    }

    func test_validateDogSize_camelCaseExtraLarge_fails() {
        // The raw value in Dog.swift is "extra_large" (snake_case), not "extraLarge".
        // This test guards against using the wrong casing in callers.
        let result = ValidationService.validateDogSize("extraLarge")
        if case .failure(let error) = result, case .invalidStatus = error { /* pass */ }
        else { XCTFail("Expected .invalidStatus for camelCase 'extraLarge'") }
    }

    // =========================================================================
}
