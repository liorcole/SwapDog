//
//  RequestDetailActions.swift
//  SwapDog
//
//  Context-sensitive action buttons for RequestDetailView.
//  Extracted to stay within the 300-line file limit.
//
//  Architecture: MVVM-C — View layer (pure display components)
//

import SwiftUI

// MARK: - RequestActionButtons

/// Renders the correct set of action buttons based on direction + status.
struct RequestActionButtons: View {

    let request: SwapRequest
    let direction: SwapDirection

    let onShowAccept: () -> Void
    let onShowDecline: () -> Void
    let onShowCancel: () -> Void
    let onShowComplete: () -> Void
    let onShowReview: () -> Void

    var body: some View {
        Group {
            if direction == .incoming && request.status == .pending {
                incomingPendingActions
            } else if direction == .outgoing && request.status == .pending {
                outgoingCancelAction
            } else if request.status == .accepted && Date() >= request.endDate {
                markCompleteAction
            } else if request.status == .completed {
                leaveReviewAction
            }
        }
        .padding(.top, Theme.Spacing.sm)
    }

    // MARK: - Incoming Pending

    private var incomingPendingActions: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Button(action: onShowDecline) {
                Text("Decline")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.error)
                    .frame(maxWidth: .infinity)
                    .padding(Theme.Spacing.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.CornerRadius.pill)
                            .stroke(Theme.Colors.error)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Decline swap request")

            Button(action: onShowAccept) {
                Text("Accept")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(Theme.Spacing.md)
                    .background(Theme.Colors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Accept swap request")
        }
    }

    // MARK: - Outgoing Pending

    private var outgoingCancelAction: some View {
        Button(action: onShowCancel) {
            Text("Cancel Request")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.error)
                .frame(maxWidth: .infinity)
                .padding(Theme.Spacing.md)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.pill)
                        .stroke(Theme.Colors.error)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Cancel outgoing swap request")
    }

    // MARK: - Mark Complete

    private var markCompleteAction: some View {
        Button(action: onShowComplete) {
            Text("Mark Complete")
                .font(Theme.Typography.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.secondary)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Mark swap as complete")
    }

    // MARK: - Leave Review

    private var leaveReviewAction: some View {
        Button(action: onShowReview) {
            Label("Leave a Review", systemImage: "star.fill")
                .font(Theme.Typography.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.accent)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Leave a review for this swap")
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        RequestActionButtons(
            request: .mock,
            direction: .incoming,
            onShowAccept: {},
            onShowDecline: {},
            onShowCancel: {},
            onShowComplete: {},
            onShowReview: {}
        )

        RequestActionButtons(
            request: {
                var r = SwapRequest.mock
                r.status = .accepted
                r.endDate = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
                return r
            }(),
            direction: .outgoing,
            onShowAccept: {},
            onShowDecline: {},
            onShowCancel: {},
            onShowComplete: {},
            onShowReview: {}
        )
    }
    .padding()
}
