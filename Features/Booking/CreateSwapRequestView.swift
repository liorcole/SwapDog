//
//  CreateSwapRequestView.swift
//  SwapDog
//
//  Main container for the swap-request creation flow.
//  Subviews live in CreateSwapFormSections.swift.
//
//  Architecture: MVVM-C — View layer (no business logic)
//

import SwiftUI

// MARK: - CreateSwapRequestView

/// Full-screen form for creating a new swap request to a specific recipient.
///
/// The parent coordinator is responsible for injecting a pre-built
/// `CreateSwapViewModel` with the correct user and dog data.
struct CreateSwapRequestView: View {

    // MARK: - ViewModel

    @StateObject var viewModel: CreateSwapViewModel
    @Environment(\.dismiss) private var dismiss

    // MARK: - Body

    var body: some View {
        ZStack {
            scrollContent
            if viewModel.isLoading {
                loadingOverlay
            }
        }
        .navigationTitle("New Swap Request")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
                    .foregroundStyle(Theme.Colors.primary)
            }
        }
        .alert("Send Request?", isPresented: $viewModel.showConfirmationAlert) {
            Button("Send", role: .none) {
                Task { await viewModel.confirmSubmission() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("A swap request will be sent. You can cancel it before they respond.")
        }
        .alert("Error", isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
        .onChange(of: viewModel.didSubmitSuccessfully) { _, success in
            if success { dismiss() }
        }
    }

    // MARK: - Scroll Content

    private var scrollContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                SwapRecipientSection(dogs: viewModel.theirDogs)
                Divider()
                SwapDogSelectionSection(
                    myDogs: viewModel.myDogs,
                    selectedIDs: viewModel.selectedDogIDs,
                    onToggle: viewModel.toggleDog(id:)
                )
                Divider()
                SwapDatePickerSection(
                    startDate: $viewModel.startDate,
                    endDate: $viewModel.endDate,
                    validationError: viewModel.dateValidationError
                )
                Divider()
                SwapMessageSection(
                    message: $viewModel.message,
                    maxLength: viewModel.maxMessageLength
                )
                Divider()
                SwapSummaryCard(viewModel: viewModel)
                sendButton
            }
            .padding(Theme.Spacing.md)
        }
        .background(Theme.Colors.background.ignoresSafeArea())
    }

    // MARK: - Send Button

    private var sendButton: some View {
        Button(action: viewModel.requestSubmission) {
            Text("Send Request")
                .font(Theme.Typography.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(Theme.Spacing.md)
                .background(
                    viewModel.isFormValid
                        ? Theme.Colors.primary
                        : Theme.Colors.primary.opacity(0.4)
                )
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill))
        }
        .disabled(!viewModel.isFormValid || viewModel.isLoading)
        .padding(.top, Theme.Spacing.sm)
        .accessibilityLabel("Send swap request")
    }

    // MARK: - Loading Overlay

    private var loadingOverlay: some View {
        ZStack {
            Theme.Colors.overlayBackground.ignoresSafeArea()
            ProgressView("Sending…")
                .padding(Theme.Spacing.lg)
                .background(Theme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        CreateSwapRequestView(
            viewModel: CreateSwapViewModel(
                currentUser: .mock,
                currentUserDogs: [.mock],
                recipient: User(
                    id: "usr_mock_002", email: "alex@example.com",
                    displayName: "Alex Kim", profileImageURL: nil,
                    latitude: 40.78, longitude: -73.97, neighborhood: "Chelsea",
                    bio: "Dog dad", joinedDate: Date(), isVerified: false,
                    rating: 4.5, reviewCount: 3, dogs: ["dog_mock_002"], swapCount: 2
                ),
                recipientDogs: [Dog(
                    id: "dog_mock_002", ownerID: "usr_mock_002", name: "Max",
                    breed: "Beagle", age: .adult, size: .medium,
                    energyLevel: .moderate, temperament: [], specialNeeds: nil,
                    vaccinated: true, spayedNeutered: true, photos: [], bio: ""
                )],
                swapRepository: MockSwapRepository(),
                messagingRepository: MockMessagingRepository()
            )
        )
    }
}
