//
//  EditDogView.swift
//  SwapDog
//
//  Pre-populated dog edit screen. Toolbar actions + alerts live here;
//  form fields are in EditDogFormView to keep this file under 300 lines.
//
//  Architecture layer: Features/Profile (View — no business logic)
//  Locked decisions:
//    - Dog deletion shows "This cannot be undone" confirmation
//    - Unsaved changes detection on dismiss
//

import SwiftUI

// MARK: - EditDogView

/// Navigation host for editing an existing dog.
///
/// Owns navigation bar buttons and all confirmation alerts.
/// Field layout is delegated to `EditDogFormView`.
struct EditDogView: View {

    // MARK: - Inputs

    let dog: Dog

    // MARK: - Environment

    @EnvironmentObject private var viewModel: ProfileViewModel
    @Environment(\.dismiss) private var dismiss

    // MARK: - Draft State

    @State var draftName:          String
    @State var draftBreed:         String
    @State var draftAge:           DogAge
    @State var draftSize:          DogSize
    @State var draftEnergy:        EnergyLevel
    @State var draftTemperament:   Set<String>
    @State var draftVaccinated:    Bool
    @State var draftSpayed:        Bool
    @State var draftBio:           String
    @State var draftSpecialNeeds:  String

    // MARK: - UI State

    @State private var isDirty              = false
    @State private var showingDiscardAlert  = false
    @State private var showingDeleteAlert   = false
    @State private var showingError         = false
    @State private var errorMessage         = ""

    // MARK: - Init

    init(dog: Dog) {
        self.dog = dog
        _draftName         = State(initialValue: dog.name)
        _draftBreed        = State(initialValue: dog.breed)
        _draftAge          = State(initialValue: dog.age)
        _draftSize         = State(initialValue: dog.size)
        _draftEnergy       = State(initialValue: dog.energyLevel)
        _draftTemperament  = State(initialValue: Set(dog.temperament))
        _draftVaccinated   = State(initialValue: dog.vaccinated)
        _draftSpayed       = State(initialValue: dog.spayedNeutered)
        _draftBio          = State(initialValue: dog.bio)
        _draftSpecialNeeds = State(initialValue: dog.specialNeeds ?? "")
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            EditDogFormView(
                dog: dog,
                draftName:         $draftName,
                draftBreed:        $draftBreed,
                draftAge:          $draftAge,
                draftSize:         $draftSize,
                draftEnergy:       $draftEnergy,
                draftTemperament:  $draftTemperament,
                draftVaccinated:   $draftVaccinated,
                draftSpayed:       $draftSpayed,
                draftBio:          $draftBio,
                draftSpecialNeeds: $draftSpecialNeeds,
                isDirty:           $isDirty,
                onDeleteTap:       { showingDeleteAlert = true }
            )
            .environmentObject(viewModel)
            .navigationTitle("Edit \(dog.name)")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .toolbar { toolbarContent }
            .loadingOverlay(viewModel.isLoading)
            .interactiveDismissDisabled(isDirty)
            .alert("Discard Changes?", isPresented: $showingDiscardAlert) {
                Button("Discard", role: .destructive) { dismiss() }
                Button("Keep Editing", role: .cancel) {}
            } message: {
                Text("You have unsaved changes. Discard them?")
            }
            .alert("Delete \(dog.name)?", isPresented: $showingDeleteAlert) {
                Button("Delete", role: .destructive) {
                    Task { await performDelete() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This cannot be undone.")
            }
            .alert("Invalid Input", isPresented: $showingError) {
                Button("OK") {}
            } message: {
                Text(errorMessage)
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") {
                if isDirty { showingDiscardAlert = true } else { dismiss() }
            }
            .accessibilityLabel("Cancel editing dog")
        }
        ToolbarItem(placement: .confirmationAction) {
            Button("Save") { Task { await save() } }
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.primary)
                .disabled(viewModel.isLoading)
                .accessibilityLabel("Save dog changes")
        }
    }

    // MARK: - Actions

    private func save() async {
        switch ValidationService.validateDogName(draftName) {
        case .failure(let err):
            errorMessage = err.errorDescription ?? "Invalid name."
            showingError = true
            return
        case .success: break
        }
        switch ValidationService.validateBreed(draftBreed) {
        case .failure(let err):
            errorMessage = err.errorDescription ?? "Invalid breed."
            showingError = true
            return
        case .success: break
        }

        let updated = Dog(
            id: dog.id,
            ownerID: dog.ownerID,
            name: draftName.trimmingCharacters(in: .whitespaces),
            breed: draftBreed.trimmingCharacters(in: .whitespaces),
            age: draftAge,
            size: draftSize,
            energyLevel: draftEnergy,
            temperament: Array(draftTemperament),
            specialNeeds: draftSpecialNeeds.isEmpty ? nil : draftSpecialNeeds.trimmingCharacters(in: .whitespaces),
            vaccinated: draftVaccinated,
            spayedNeutered: draftSpayed,
            photos: dog.photos,
            bio: draftBio.trimmingCharacters(in: .whitespaces)
        )
        do {
            try await viewModel.updateDog(updated)
            isDirty = false
            dismiss()
        } catch let err as SwapDogError {
            errorMessage = err.errorDescription ?? "Save failed."
            showingError = true
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
    }

    private func performDelete() async {
        do {
            try await viewModel.deleteDog(id: dog.id)
            dismiss()
        } catch let err as SwapDogError {
            errorMessage = err.errorDescription ?? "Delete failed."
            showingError = true
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
    }
}

// MARK: - Preview

#Preview {
    EditDogView(dog: .mock)
        .environmentObject(
            ProfileViewModel(
                userRepository: MockUserRepository(),
                dogRepository: MockDogRepository(),
                authRepository: MockAuthRepository(),
                reviewRepository: MockReviewRepository(),
                coordinator: AppCoordinator()
            )
        )
}
