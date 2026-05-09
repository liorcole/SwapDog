//
//  WriteReviewView.swift
//  SwapDog
//
//  Allows a user to leave a 1-5 star review with optional text after
//  marking a swap as complete.
//
//  Architecture: MVVM-C — View layer (no business logic)
//

import SwiftUI

// MARK: - WriteReviewView

/// A sheet presented after marking a swap complete, for leaving a review.
///
/// The parent is responsible for calling `viewModel.submitReview` or
/// providing callbacks via `onSubmit`.
struct WriteReviewView: View {

    // MARK: - Inputs

    let otherUserName: String
    var onSubmit: (Int, String) async -> Void
    var onDismiss: () -> Void

    // MARK: - Local State

    @State private var selectedRating: Int = 0
    @State private var reviewText: String = ""
    @State private var isSubmitting: Bool = false
    @State private var errorMessage: String?

    // MARK: - Constants

    private let maxReviewLength: Int = 1_000

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                    headerSection
                    starRatingSection
                    textSection
                    submitButton
                }
                .padding(Theme.Spacing.md)
            }
            .background(Theme.Colors.background.ignoresSafeArea())
            .navigationTitle("Leave a Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Skip") { onDismiss() }
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
            }
            .alert("Error", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text("How was your swap with \(otherUserName)?")
                .font(Theme.Typography.title3)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("Your honest review helps the SwapDog community.")
                .font(Theme.Typography.subheadline)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    // MARK: - Star Rating

    private var starRatingSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Your rating")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .textCase(.uppercase)

            HStack(spacing: Theme.Spacing.sm) {
                ForEach(1...5, id: \.self) { star in
                    Button(action: { selectedRating = star }) {
                        Image(systemName: star <= selectedRating ? "star.fill" : "star")
                            .font(.system(size: 36))
                            .foregroundStyle(
                                star <= selectedRating
                                    ? Theme.Colors.accent
                                    : Theme.Colors.textSecondary.opacity(0.4)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(star) star\(star == 1 ? "" : "s")")
                    .accessibilityAddTraits(star == selectedRating ? .isSelected : [])
                }
                Spacer()
            }
        }
    }

    // MARK: - Text Field

    private var textSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("Write a review")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .textCase(.uppercase)
                Spacer()
                Text("\(reviewText.count)/\(maxReviewLength)")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(
                        reviewText.count >= maxReviewLength
                            ? Theme.Colors.error
                            : Theme.Colors.textSecondary
                    )
            }

            TextEditor(text: $reviewText)
                .frame(minHeight: 120)
                .padding(Theme.Spacing.sm)
                .background(Theme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
                        .stroke(Theme.Colors.fieldBorder)
                )
                .onChange(of: reviewText) { _, newValue in
                    if newValue.count > maxReviewLength {
                        reviewText = String(newValue.prefix(maxReviewLength))
                    }
                }
        }
    }

    // MARK: - Submit Button

    private var submitButton: some View {
        Button(action: submitReview) {
            Group {
                if isSubmitting {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Submit Review")
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(Theme.Spacing.md)
            .background(
                isFormValid
                    ? Theme.Colors.primary
                    : Theme.Colors.primary.opacity(0.4)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill))
        }
        .disabled(!isFormValid || isSubmitting)
        .accessibilityLabel("Submit review")
    }

    // MARK: - Computed

    private var isFormValid: Bool {
        selectedRating > 0
    }

    // MARK: - Actions

    private func submitReview() {
        guard isFormValid else { return }
        isSubmitting = true
        Task {
            await onSubmit(selectedRating, reviewText)
            isSubmitting = false
        }
    }
}

// MARK: - Preview

#Preview {
    WriteReviewView(
        otherUserName: "Alex Kim",
        onSubmit: { _, _ in },
        onDismiss: {}
    )
}
