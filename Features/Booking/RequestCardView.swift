//
//  RequestCardView.swift
//  SwapDog
//
//  Reusable card that displays a single swap request with direction-aware
//  action buttons and a coloured status pill.
//
//  Architecture: MVVM-C — View layer (pure display, no business logic)
//

import SwiftUI

// MARK: - SwapDirection

/// Whether the request is incoming (current user is recipient) or outgoing.
enum SwapDirection {
    case incoming
    case outgoing
}

// MARK: - RequestCardView

/// A card representing one swap request in the Requests list.
///
/// Incoming cards show Accept / Decline buttons for pending requests.
/// Outgoing cards show a status pill and a Cancel button for pending requests.
struct RequestCardView: View {

    // MARK: - Inputs

    let request: SwapRequest
    let direction: SwapDirection
    let otherUserName: String
    let otherUserImageURL: String?
    let dogNames: String

    /// Called when the user taps "Accept" (incoming pending only).
    var onAccept: (() -> Void)?
    /// Called when the user taps "Decline" (incoming pending only).
    var onDecline: (() -> Void)?
    /// Called when the user taps "Cancel" (outgoing pending only).
    var onCancel: (() -> Void)?

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            headerRow
            dogsAndDatesRow
            statusAndActions
        }
        .padding(Theme.Spacing.md)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    // MARK: - Header Row

    private var headerRow: some View {
        HStack(spacing: Theme.Spacing.sm) {
            CachedAsyncImage(
                urlString: otherUserImageURL,
                cornerRadius: Theme.CornerRadius.pill,
                size: CGSize(width: 44, height: 44)
            )
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 2) {
                Text(otherUserName)
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)

                Text(relativeTimestamp)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            Spacer()
            StatusPillView(status: request.status)
        }
    }

    // MARK: - Dogs & Dates Row

    private var dogsAndDatesRow: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Label(dogNames, systemImage: "pawprint.fill")
                .font(Theme.Typography.subheadline)
                .foregroundStyle(Theme.Colors.textSecondary)
                .lineLimit(1)

            Label(dateRangeText, systemImage: "calendar")
                .font(Theme.Typography.subheadline)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    // MARK: - Status & Actions

    @ViewBuilder
    private var statusAndActions: some View {
        if direction == .incoming && request.status == .pending {
            incomingActions
        } else if direction == .outgoing && request.status == .pending {
            outgoingCancelButton
        }
    }

    private var incomingActions: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Button(action: { onDecline?() }) {
                Text("Decline")
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.error)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Spacing.sm)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
                            .stroke(Theme.Colors.error)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Decline swap request from \(otherUserName)")

            Button(action: { onAccept?() }) {
                Text("Accept")
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Spacing.sm)
                    .background(Theme.Colors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Accept swap request from \(otherUserName)")
        }
    }

    private var outgoingCancelButton: some View {
        Button(action: { onCancel?() }) {
            Text("Cancel Request")
                .font(Theme.Typography.subheadline)
                .foregroundStyle(Theme.Colors.error)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.sm)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
                        .stroke(Theme.Colors.error)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Cancel outgoing swap request")
    }

    // MARK: - Computed

    private var dateRangeText: String {
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        return "\(fmt.string(from: request.startDate)) – \(fmt.string(from: request.endDate))"
    }

    private var relativeTimestamp: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: request.createdAt, relativeTo: Date())
    }
}

// MARK: - StatusPillView

/// A small coloured badge showing the current `SwapStatus`.
struct StatusPillView: View {

    let status: SwapStatus

    var body: some View {
        Text(status.displayLabel)
            .font(Theme.Typography.caption)
            .foregroundStyle(.white)
            .padding(.horizontal, Theme.Spacing.sm)
            .padding(.vertical, Theme.Spacing.xs)
            .background(status.pillColor)
            .clipShape(Capsule())
    }
}

// MARK: - SwapStatus + Display

extension SwapStatus {

    /// Human-readable label shown on the status pill.
    var displayLabel: String {
        switch self {
        case .pending:   return "Pending"
        case .accepted:  return "Accepted"
        case .declined:  return "Declined"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        }
    }

    /// Background colour for the status pill.
    var pillColor: Color {
        switch self {
        case .pending:   return Theme.Colors.statusPending
        case .accepted:  return Theme.Colors.statusAccepted
        case .declined:  return Theme.Colors.error
        case .completed: return Theme.Colors.secondary
        case .cancelled: return Theme.Colors.textSecondary
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        RequestCardView(
            request: .mock,
            direction: .incoming,
            otherUserName: "Alex Kim",
            otherUserImageURL: nil,
            dogNames: "Luna, Max",
            onAccept: {},
            onDecline: {}
        )
        RequestCardView(
            request: {
                var r = SwapRequest.mock
                r.status = .accepted
                return r
            }(),
            direction: .outgoing,
            otherUserName: "Sarah Chen",
            otherUserImageURL: nil,
            dogNames: "Buddy"
        )
    }
    .padding()
    .background(Theme.Colors.background)
}
