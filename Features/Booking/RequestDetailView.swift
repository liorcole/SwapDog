//
//  RequestDetailView.swift
//  SwapDog
//
//  Full-detail view for a single swap request with status timeline.
//  Action subviews live in RequestDetailActions.swift.
//
//  Architecture: MVVM-C — View layer (no business logic)
//

import SwiftUI

// MARK: - RequestDetailView

/// Shows the full details of a swap request and provides context-sensitive actions.
///
/// Actions (accept/decline/cancel/complete/review) are injected as async closures
/// so the view stays decoupled from the ViewModel.
struct RequestDetailView: View {

    // MARK: - Inputs

    let request: SwapRequest
    let direction: SwapDirection
    let currentUserID: String
    let otherUserName: String
    let otherUserImageURL: String?
    let requesterDogNames: [String]
    let recipientDogNames: [String]

    var onAccept: (() async throws -> Void)?
    var onDecline: (() async throws -> Void)?
    var onCancel: (() async throws -> Void)?
    var onMarkComplete: (() async throws -> Void)?
    var onSubmitReview: ((Int, String) async throws -> Void)?

    // MARK: - Local State

    @State private var showAcceptAlert = false
    @State private var showDeclineAlert = false
    @State private var showCancelAlert = false
    @State private var showCompleteAlert = false
    @State private var showReviewSheet = false
    @State private var isActioning = false
    @State private var errorMessage: String?

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                partiesSection
                Divider()
                datesSection
                if let msg = request.message, !msg.isEmpty {
                    Divider()
                    messageSection(msg)
                }
                Divider()
                statusTimelineSection
                actionSection
            }
            .padding(Theme.Spacing.md)
        }
        .background(Theme.Colors.background.ignoresSafeArea())
        .navigationTitle("Request Details")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Accept this swap?", isPresented: $showAcceptAlert) {
            Button("Accept") { performAction { try await onAccept?() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You're committing to \(dateRangeText). This cannot be undone.")
        }
        .alert("Decline this swap?", isPresented: $showDeclineAlert) {
            Button("Decline", role: .destructive) { performAction { try await onDecline?() } }
            Button("Keep", role: .cancel) {}
        } message: {
            Text("The requester will be notified that you declined.")
        }
        .alert("Cancel your request?", isPresented: $showCancelAlert) {
            Button("Cancel Request", role: .destructive) { performAction { try await onCancel?() } }
            Button("Keep", role: .cancel) {}
        } message: {
            Text("Your pending swap request will be withdrawn.")
        }
        .alert("Mark swap as complete?", isPresented: $showCompleteAlert) {
            Button("Mark Complete") {
                performAction {
                    try await onMarkComplete?()
                    showReviewSheet = true
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This confirms the swap finished successfully. You'll be prompted to review.")
        }
        .alert("Error", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .sheet(isPresented: $showReviewSheet) {
            WriteReviewView(
                otherUserName: otherUserName,
                onSubmit: { rating, text in
                    do { try await onSubmitReview?(rating, text) }
                    catch { errorMessage = error.localizedDescription }
                    showReviewSheet = false
                },
                onDismiss: { showReviewSheet = false }
            )
        }
    }

    // MARK: - Parties Section

    private var partiesSection: some View {
        HStack(spacing: Theme.Spacing.lg) {
            partyColumn(
                label: "Requester",
                dogNames: requesterDogNames,
                imageURL: direction == .outgoing ? nil : otherUserImageURL,
                name: direction == .outgoing ? "You" : otherUserName
            )
            Image(systemName: "arrow.left.arrow.right")
                .foregroundStyle(Theme.Colors.primary)
                .font(.system(size: 20))
            partyColumn(
                label: "Recipient",
                dogNames: recipientDogNames,
                imageURL: direction == .incoming ? nil : otherUserImageURL,
                name: direction == .incoming ? "You" : otherUserName
            )
        }
        .frame(maxWidth: .infinity)
    }

    private func partyColumn(label: String, dogNames: [String], imageURL: String?, name: String) -> some View {
        VStack(spacing: Theme.Spacing.xs) {
            CachedAsyncImage(urlString: imageURL, cornerRadius: Theme.CornerRadius.pill, size: CGSize(width: 60, height: 60))
                .frame(width: 60, height: 60)
            Text(name).font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            Text(dogNames.joined(separator: " & "))
                .font(Theme.Typography.caption).foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            Text(label).font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary.opacity(0.7)).textCase(.uppercase)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Dates Section

    private var datesSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Dates").font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary).textCase(.uppercase)
            HStack {
                Label(dateRangeText, systemImage: "calendar")
                    .font(Theme.Typography.body).foregroundStyle(Theme.Colors.textPrimary)
                Spacer()
                StatusPillView(status: request.status)
            }
        }
    }

    // MARK: - Message Section

    private func messageSection(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Message").font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary).textCase(.uppercase)
            Text(message).font(Theme.Typography.body).foregroundStyle(Theme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Status Timeline

    private var statusTimelineSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Timeline").font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary).textCase(.uppercase)
            timelineRow(icon: "plus.circle.fill", color: .green, label: "Request sent", date: request.createdAt)
            if request.status != .pending {
                timelineRow(icon: request.status.timelineIcon, color: request.status.pillColor,
                            label: request.status.timelineLabel, date: request.updatedAt)
            }
        }
    }

    private func timelineRow(icon: String, color: Color, label: String, date: Date) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: icon).foregroundStyle(color).frame(width: 20)
            Text(label).font(Theme.Typography.subheadline).foregroundStyle(Theme.Colors.textPrimary)
            Spacer()
            Text(DateFormatter.shortDate.string(from: date))
                .font(Theme.Typography.caption).foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    // MARK: - Action Section

    @ViewBuilder
    private var actionSection: some View {
        if isActioning {
            HStack { Spacer(); ProgressView(); Spacer() }.padding(.top, Theme.Spacing.sm)
        } else {
            RequestActionButtons(
                request: request,
                direction: direction,
                onShowAccept: { showAcceptAlert = true },
                onShowDecline: { showDeclineAlert = true },
                onShowCancel: { showCancelAlert = true },
                onShowComplete: { showCompleteAlert = true },
                onShowReview: { showReviewSheet = true }
            )
        }
    }

    // MARK: - Helpers

    private var dateRangeText: String {
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        return "\(fmt.string(from: request.startDate)) – \(fmt.string(from: request.endDate))"
    }

    private func performAction(block: @escaping () async throws -> Void) {
        isActioning = true
        Task {
            do { try await block() }
            catch { errorMessage = error.localizedDescription }
            isActioning = false
        }
    }
}

// MARK: - DateFormatter Helper

private extension DateFormatter {
    static let shortDate: DateFormatter = {
        let df = DateFormatter()
        df.dateStyle = .short
        return df
    }()
}

// MARK: - SwapStatus + Timeline

extension SwapStatus {
    /// SF Symbol name for the status timeline row.
    var timelineIcon: String {
        switch self {
        case .pending:   return "clock"
        case .accepted:  return "checkmark.circle.fill"
        case .declined:  return "xmark.circle.fill"
        case .completed: return "flag.checkered"
        case .cancelled: return "nosign"
        }
    }

    /// Human-readable timeline label.
    var timelineLabel: String {
        switch self {
        case .pending:   return "Pending response"
        case .accepted:  return "Accepted"
        case .declined:  return "Declined"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        RequestDetailView(
            request: .mock,
            direction: .incoming,
            currentUserID: "usr_mock_002",
            otherUserName: "Sarah Chen",
            otherUserImageURL: nil,
            requesterDogNames: ["Luna"],
            recipientDogNames: ["Max"],
            onAccept: {},
            onDecline: {}
        )
    }
}
