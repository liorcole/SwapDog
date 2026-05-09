//
//  EditDogFormView.swift
//  SwapDog
//
//  All editable form fields for EditDogView.
//  Extracted to keep EditDogView under 300 lines.
//
//  Architecture layer: Features/Profile (View — no business logic)
//

import SwiftUI
import PhotosUI

// MARK: - EditDogFormView

/// Scrollable form containing all editable fields for a dog.
///
/// All state lives in `EditDogView` and is passed down as `@Binding`.
/// The delete button calls `onDeleteTap` to trigger the parent's alert.
struct EditDogFormView: View {

    // MARK: - Inputs

    let dog:          Dog
    let onDeleteTap:  () -> Void

    // MARK: - Bindings

    @Binding var draftName:          String
    @Binding var draftBreed:         String
    @Binding var draftAge:           DogAge
    @Binding var draftSize:          DogSize
    @Binding var draftEnergy:        EnergyLevel
    @Binding var draftTemperament:   Set<String>
    @Binding var draftVaccinated:    Bool
    @Binding var draftSpayed:        Bool
    @Binding var draftBio:           String
    @Binding var draftSpecialNeeds:  String
    @Binding var isDirty:            Bool

    // MARK: - Photo State

    @State private var newPhotoItems: [PhotosPickerItem] = []
    @State private var newPhotoData:  [Data]             = []

    // MARK: - Constants

    private let temperamentOptions = [
        "Friendly", "Playful", "Calm", "Energetic", "Gentle",
        "Protective", "Independent", "Loyal", "Shy", "Social",
        "Curious", "Affectionate"
    ]

    // MARK: - Init (memberwise with labels for clarity)

    init(
        dog: Dog,
        draftName:         Binding<String>,
        draftBreed:        Binding<String>,
        draftAge:          Binding<DogAge>,
        draftSize:         Binding<DogSize>,
        draftEnergy:       Binding<EnergyLevel>,
        draftTemperament:  Binding<Set<String>>,
        draftVaccinated:   Binding<Bool>,
        draftSpayed:       Binding<Bool>,
        draftBio:          Binding<String>,
        draftSpecialNeeds: Binding<String>,
        isDirty:           Binding<Bool>,
        onDeleteTap:       @escaping () -> Void
    ) {
        self.dog          = dog
        self.onDeleteTap  = onDeleteTap
        _draftName        = draftName
        _draftBreed       = draftBreed
        _draftAge         = draftAge
        _draftSize        = draftSize
        _draftEnergy      = draftEnergy
        _draftTemperament = draftTemperament
        _draftVaccinated  = draftVaccinated
        _draftSpayed      = draftSpayed
        _draftBio         = draftBio
        _draftSpecialNeeds = draftSpecialNeeds
        _isDirty          = isDirty
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                photoSection
                nameField
                breedField
                ageSection
                sizeSection
                energySection
                temperamentSection
                togglesSection
                bioField
                specialNeedsField
                deleteButton
            }
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.lg)
        }
        .screenBackground()
        .hideKeyboardOnTap()
        .onChange(of: newPhotoItems) { _, items in
            Task { await loadNewPhotos(items) }
        }
    }

    // MARK: - Photos

    private var photoSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Photos").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.sm) {
                    ForEach(dog.photos.prefix(5), id: \.self) { url in
                        CachedAsyncImage(urlString: url, cornerRadius: Theme.CornerRadius.sm,
                                         size: CGSize(width: 70, height: 70))
                        .frame(width: 70, height: 70)
                        .accessibilityHidden(true)
                    }
                    ForEach(newPhotoData.indices, id: \.self) { i in
                        if let img = UIImage(data: newPhotoData[i]) {
                            Image(uiImage: img).resizable().scaledToFill()
                                .frame(width: 70, height: 70)
                                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm,
                                                            style: .continuous))
                                .accessibilityLabel("New photo")
                        }
                    }
                }
            }
            PhotosPicker(selection: $newPhotoItems, maxSelectionCount: 5,
                         matching: .images, photoLibrary: .shared()) {
                Label("Add More Photos", systemImage: "photo.badge.plus")
                    .font(Theme.Typography.subheadline).foregroundStyle(Theme.Colors.primary)
            }
            .accessibilityLabel("Add photos of your dog")
        }
    }

    // MARK: - Name

    private var nameField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Label("Dog's Name *", systemImage: "dog.fill")
                .font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            TextField("e.g. Luna", text: $draftName)
                .font(Theme.Typography.body).padding(Theme.Spacing.md)
                .background(Theme.Colors.background)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                    .stroke(Theme.Colors.textSecondary.opacity(0.3), lineWidth: 1))
                .onChange(of: draftName) { _, _ in isDirty = true }
                .accessibilityLabel("Dog's name")
        }
    }

    // MARK: - Breed

    private var breedField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Label("Breed", systemImage: "magnifyingglass")
                .font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            BreedAutocompleteField(selectedBreed: $draftBreed)
                .onChange(of: draftBreed) { _, _ in isDirty = true }
        }
    }

    // MARK: - Age / Size / Energy

    private var ageSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Age").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            Picker("Age", selection: $draftAge) {
                ForEach(DogAge.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
            }.pickerStyle(.segmented).onChange(of: draftAge) { _, _ in isDirty = true }
             .accessibilityLabel("Dog's age category")
        }
    }

    private var sizeSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Size").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            Picker("Size", selection: $draftSize) {
                ForEach(DogSize.allCases, id: \.self) { Text($0.weightRange).tag($0) }
            }.pickerStyle(.segmented).onChange(of: draftSize) { _, _ in isDirty = true }
             .accessibilityLabel("Dog's size category")
        }
    }

    private var energySection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Energy Level").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            Picker("Energy Level", selection: $draftEnergy) {
                ForEach(EnergyLevel.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
            }.pickerStyle(.segmented).onChange(of: draftEnergy) { _, _ in isDirty = true }
             .accessibilityLabel("Dog's energy level")
        }
    }

    // MARK: - Temperament

    private var temperamentSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Temperament").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            ChipSelectionView(
                options: temperamentOptions,
                selectedOptions: Binding(
                    get: { Array(draftTemperament) },
                    set: { draftTemperament = Set($0); isDirty = true }
                )
            )
        }
    }

    // MARK: - Toggles

    private var togglesSection: some View {
        VStack(spacing: 0) {
            Toggle("Up-to-date on vaccinations", isOn: $draftVaccinated)
                .font(Theme.Typography.body).padding(.vertical, Theme.Spacing.sm)
                .onChange(of: draftVaccinated) { _, _ in isDirty = true }
            Divider()
            Toggle("Spayed / Neutered", isOn: $draftSpayed)
                .font(Theme.Typography.body).padding(.vertical, Theme.Spacing.sm)
                .onChange(of: draftSpayed) { _, _ in isDirty = true }
        }
    }

    // MARK: - Bio

    private var bioField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text("About Your Dog").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            TextEditor(text: $draftBio)
                .font(Theme.Typography.body).frame(minHeight: 80)
                .padding(Theme.Spacing.sm)
                .background(Theme.Colors.background)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                    .stroke(Theme.Colors.textSecondary.opacity(0.3), lineWidth: 1))
                .onChange(of: draftBio) { _, _ in isDirty = true }
                .accessibilityLabel("Dog bio text editor")
        }
    }

    // MARK: - Special Needs

    private var specialNeedsField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text("Special Needs / Care Notes")
                .font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            TextField("e.g. Takes medication twice daily", text: $draftSpecialNeeds)
                .font(Theme.Typography.body).padding(Theme.Spacing.md)
                .background(Theme.Colors.background)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                    .stroke(Theme.Colors.textSecondary.opacity(0.3), lineWidth: 1))
                .onChange(of: draftSpecialNeeds) { _, _ in isDirty = true }
                .accessibilityLabel("Special needs or care notes")
        }
    }

    // MARK: - Delete Button

    private var deleteButton: some View {
        Button(action: onDeleteTap) {
            HStack {
                Image(systemName: "trash")
                Text("Delete \(dog.name)")
            }
            .font(Theme.Typography.headline)
            .foregroundStyle(Theme.Colors.error)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.md)
            .background(Theme.Colors.error.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.pill, style: .continuous))
        }
        .padding(.top, Theme.Spacing.md)
        .accessibilityLabel("Delete \(dog.name). This cannot be undone.")
    }

    // MARK: - Helpers

    private func loadNewPhotos(_ items: [PhotosPickerItem]) async {
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self) {
                newPhotoData.append(data)
                isDirty = true
            }
        }
    }
}
