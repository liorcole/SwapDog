//
//  RequestsView.swift
//  SwapDog
//
//  Displays incoming and outgoing swap requests in a segmented picker.
//  Incoming cards show accept/decline buttons; outgoing show status + cancel.
//
//  Architecture: MVVM-C — View layer (no business logic)
//

import SwiftUI

// MARK: - RequestSegment

/// The two segments of the Requests tab.
enum RequestSegment: String, CaseIterable {
    case incoming = "Incoming"
    case outgoing = "Outgoing"
}

// MARK: - RequestsView

/// Tab-level view that lists the current user's swap requests.
///
/// Inject a `RequestsViewModel` via `@StateObject` or `@ObservedObject`
/// depending on who owns the lifecycle.
struct RequestsView: View {

    // MARK: - ViewModel

    @ObservedObject var viewModel: RequestsViewModel

    // MARK: - Local State

    @State private var selectedSegment: RequestSegment = .incoming
    @State private var confirmingAcceptID: String?
    @State private var confirmingDeclineID: String?
    @State private var confirmingCancelID: String?
    @State private var actionError: String?
    @State private var navigatingToDetail: SwapRequest?

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                segmentedPicker
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.top, Theme.Spacing.sm)

                if viewModel.isLoading {
                    VStack(spacing: Theme.Spacing.md) {
                        Spacer()
                        ProgressView("Loading requests…")
                            .accessibilityLabel("Loading swap requests")
                        Spacer()
                    }
                } else {
                    requestList
                }
            }
            .background(Theme.Colors.background.ignoresSafeArea())
            .navigationTitle("Requests")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: { Task { await viewModel.loadRequests() } }) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("Refresh requests")
                }
            }
            // Confirm Accept
            .alert("Accept Request?", isPresented: Binding(
                get: { confirmingAcceptID != nil },
                set: { if !$0 { confirmingAcceptID = nil } }
            )) {
                Button("Accept") {
                    guard let id = confirmingAcceptID else { return }
                    Task { try? await viewModel.accept(requestID: id) }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Accepting this request means you've agreed to the swap dates.")
            }
            // Confirm Decline
            .alert("Decline Request?", isPresented: Binding(
                get: { confirmingDeclineID != nil },
                set: { if !$0 { confirmingDeclineID = nil } }
            )) {
                Button("Decline", role: .destructive) {
                    guard let id = confirmingDeclineID else { return }
                    Task { try? await viewModel.decline(requestID: id) }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("The other user will be notified that you declined.")
            }
            // Confirm Cancel
            .alert("Cancel Request?", isPresented: Binding(
                get: { confirmingCancelID != nil },
                set: { if !$0 { confirmingCancelID = nil } }
            )) {
                Button("Cancel Request", role: .destructive) {
                    guard let id = confirmingCancelID else { return }
                    Task { try? await viewModel.cancel(requestID: id) }
                }
                Button("Keep", role: .cancel) {}
            } message: {
                Text("Your pending swap request will be withdrawn.")
            }
            // Action error
            .alert("Error", isPresented: Binding(
                get: { actionError != nil },
                set: { if !$0 { actionError = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(actionError ?? "")
            }
        }
        .task { await viewModel.loadRequests() }
        .dynamicTypeSize(...DynamicTypeSize.accessibility3)
    }

    // MARK: - Segmented Picker

    private var segmentedPicker: some View {
        Picker("Segment", selection: $selectedSegment) {
            ForEach(RequestSegment.allCases, id: \.self) { seg in
                Text(seg.rawValue).tag(seg)
            }
        }
        .pickerStyle(.segmented)
    }

    // MARK: - Request List

    @ViewBuilder
    private var requestList: some View {
        ScrollView {
            LazyVStack(spacing: Theme.Spacing.sm) {
                if selectedSegment == .incoming {
                    incomingContent
                } else {
                    outgoingContent
                }
            }
            .padding(Theme.Spacing.md)
        }
    }

    // MARK: - Incoming Content

    @ViewBuilder
    private var incomingContent: some View {
        if viewModel.incomingRequests.isEmpty {
            emptyState(
                icon: "tray",
                title: "No incoming requests",
                subtitle: "When someone sends you a swap request it will appear here."
            )
        } else {
            ForEach(viewModel.incomingRequests) { request in
                RequestCardView(
                    request: request,
                    direction: .incoming,
                    otherUserName: "Swap partner",
                    otherUserImageURL: nil,
                    dogNames: request.requesterDogIDs.joined(separator: ", "),
                    onAccept: { confirmingAcceptID = request.id },
                    onDecline: { confirmingDeclineID = request.id }
                )
                .onTapGesture { navigatingToDetail = request }
            }
        }
    }

    // MARK: - Outgoing Content

    @ViewBuilder
    private var outgoingContent: some View {
        if viewModel.outgoingRequests.isEmpty {
            emptyState(
                icon: "paperplane",
                title: "No outgoing requests",
                subtitle: "Tap a nearby owner in Discovery to send your first swap request."
            )
        } else {
            ForEach(viewModel.outgoingRequests) { request in
                RequestCardView(
                    request: request,
                    direction: .outgoing,
                    otherUserName: "Swap partner",
                    otherUserImageURL: nil,
                    dogNames: request.requesterDogIDs.joined(separator: ", "),
                    onCancel: { confirmingCancelID = request.id }
                )
                .onTapGesture { navigatingToDetail = request }
            }
        }
    }

    // MARK: - Empty State

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        EmptyStateView(icon: icon, title: title, subtitle: subtitle)
    }
}

// MARK: - Preview

#Preview {
    RequestsView(
        viewModel: RequestsViewModel(
            currentUserID: User.mock.id,
            swapRepository: MockSwapRepository(),
            userRepository: MockUserRepository(),
            reviewRepository: MockReviewRepository()
        )
    )
}
