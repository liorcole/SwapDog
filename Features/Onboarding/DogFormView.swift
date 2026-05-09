//
//  DogFormView.swift
//  SwapDog
//
//  Reusable form view for a single dog's fields, extracted from AddDogStepView
//  to keep each file under 300 lines.
//
//  Architecture layer: Features/Onboarding (View — no business logic)
//

import SwiftUI
import PhotosUI

/// All input fields for one dog entry during onboarding.
///
/// Binds directly to a `DraftDog` via index into `OnboardingViewModel.dogs`.
/// Designed to be embedded in `AddDogStepView` inside a card container.
struct DogFormView: View {

    // MARK: - Inputs

    let index: Int
    let isOnly: Bool

    @EnvironmentObject private var viewModel: OnboardingViewModel

    // MARK: - Constants

    private let temperamentOptions = [
        "Friendly", "Playful", "Calm", "Energetic", "Gentle",
        "Protective", "Independent", "Loyal", "Shy", "Social",
        "Curious", "Affectionate"
    ]
    private let maxDogPhotos = 5

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            cardHeader
            dogNameField
            dogBreedField
            dogAgeSection
            dogSizeSection
            dogEnergySection
            temperamentSection
            dogToggles
            dogPhotoSection
            dogBioField
        }
    }

    // MARK: - Card Header

    private var cardHeader: some View {
        HStack {
            Text(isOnly ? "Your Dog" : "Dog \(index + 1)")
                .font(Theme.Typography.title3)
                .foregroundStyle(Theme.Colors.textPrimary)
            Spacer()
            if !isOnly {
                Button {
                    viewModel.removeDog(at: index)
                } label: {
                    Image(systemName: "trash")
                        .foregroundStyle(Theme.Colors.error)
                }
            }
        }
    }

    // MARK: - Individual Field Views

    private var dogNameField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Label("Dog's Name *", systemImage: "dog.fill")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            TextField("e.g. Luna", text: Binding(
                get: { viewModel.dogs[safe: index]?.name ?? "" },
                set: { viewModel.dogs[index].name = $0 }
            ))
            .font(Theme.Typography.body)
            .padding(Theme.Spacing.md)
            .background(Theme.Colors.background)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                    .stroke(Theme.Colors.textSecondary.opacity(0.3), lineWidth: 1)
            )
        }
    }

    private var dogBreedField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Label("Breed", systemImage: "magnifyingglass")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            BreedAutocompleteField(selectedBreed: Binding(
                get: { viewModel.dogs[safe: index]?.breed ?? "" },
                set: { viewModel.dogs[index].breed = $0 }
            ))
        }
    }

    private var dogAgeSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Age").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            Picker("Age", selection: Binding(
                get: { viewModel.dogs[safe: index]?.age ?? .young },
                set: { viewModel.dogs[index].age = $0 }
            )) {
                ForEach(DogAge.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
            }
            .pickerStyle(.segmented)
        }
    }

    private var dogSizeSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Size").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            Picker("Size", selection: Binding(
                get: { viewModel.dogs[safe: index]?.size ?? .medium },
                set: { viewModel.dogs[index].size = $0 }
            )) {
                ForEach(DogSize.allCases, id: \.self) { Text($0.weightRange).tag($0) }
            }
            .pickerStyle(.segmented)
        }
    }

    private var dogEnergySection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Energy Level").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            Picker("Energy Level", selection: Binding(
                get: { viewModel.dogs[safe: index]?.energyLevel ?? .moderate },
                set: { viewModel.dogs[index].energyLevel = $0 }
            )) {
                ForEach(EnergyLevel.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
            }
            .pickerStyle(.segmented)
        }
    }

    private var temperamentSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Temperament (select all that apply)")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            ChipSelectionView(
                options: temperamentOptions,
                selectedOptions: Binding(
                    get: { viewModel.dogs[safe: index]?.temperament ?? [] },
                    set: { viewModel.dogs[index].temperament = $0 }
                )
            )
        }
    }

    private var dogToggles: some View {
        VStack(spacing: 0) {
            Toggle("Up-to-date on vaccinations", isOn: Binding(
                get: { viewModel.dogs[safe: index]?.vaccinated ?? false },
                set: { viewModel.dogs[index].vaccinated = $0 }
            ))
            .font(Theme.Typography.body)
            .padding(.vertical, Theme.Spacing.sm)
            Divider()
            Toggle("Spayed / Neutered", isOn: Binding(
                get: { viewModel.dogs[safe: index]?.spayedNeutered ?? false },
                set: { viewModel.dogs[index].spayedNeutered = $0 }
            ))
            .font(Theme.Typography.body)
            .padding(.vertical, Theme.Spacing.sm)
        }
    }

    private var dogPhotoSection: some View {
        let currentCount = viewModel.dogs[safe: index]?.photoItems.count ?? 0
        return VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("Photos").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
                Spacer()
                Text("\(currentCount)/\(maxDogPhotos)").font(Theme.Typography.caption).foregroundStyle(Theme.Colors.textSecondary)
            }
            if currentCount < maxDogPhotos {
                photoPicker(currentCount: currentCount)
            }
            if currentCount > 0 {
                photoThumbnails
            }
        }
    }

    private func photoPicker(currentCount: Int) -> some View {
        PhotosPicker(
            selection: Binding(
                get: { [] as [PhotosPickerItem] },
                set: { items in loadPhotos(items) }
            ),
            maxSelectionCount: maxDogPhotos - currentCount,
            matching: .images,
            photoLibrary: .shared()
        ) {
            Label("Add Photos", systemImage: "photo.badge.plus")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.primary)
                .padding(Theme.Spacing.md)
                .frame(maxWidth: .infinity)
                .background(Theme.Colors.primary.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                        .stroke(Theme.Colors.primary.opacity(0.3), lineWidth: 1)
                )
        }
    }

    private var photoThumbnails: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(
                    Array((viewModel.dogs[safe: index]?.photoItems ?? []).enumerated()),
                    id: \.offset
                ) { photoIdx, data in
                    if let uiImage = UIImage(data: data) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 70, height: 70)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                            .overlay(alignment: .topTrailing) {
                                Button {
                                    viewModel.dogs[index].photoItems.remove(at: photoIdx)
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(.white)
                                        .background(Theme.Colors.overlayBackground.clipShape(Circle()))
                                }
                                .offset(x: 4, y: -4)
                            }
                    }
                }
            }
        }
    }

    private var dogBioField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text("About Your Dog").font(Theme.Typography.headline).foregroundStyle(Theme.Colors.textPrimary)
            TextEditor(text: Binding(
                get: { viewModel.dogs[safe: index]?.bio ?? "" },
                set: { viewModel.dogs[index].bio = $0 }
            ))
            .font(Theme.Typography.body)
            .frame(minHeight: 80)
            .padding(Theme.Spacing.sm)
            .background(Theme.Colors.background)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                    .stroke(Theme.Colors.textSecondary.opacity(0.3), lineWidth: 1)
            )
        }
    }

    // MARK: - Photo Loading

    private func loadPhotos(_ items: [PhotosPickerItem]) {
        Task {
            for item in items {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    let compressed = viewModel.compressImage(data)
                    await MainActor.run {
                        guard viewModel.dogs[safe: index] != nil,
                              viewModel.dogs[index].photoItems.count < maxDogPhotos else { return }
                        viewModel.dogs[index].photoItems.append(compressed ?? data)
                    }
                }
            }
        }
    }
}

// MARK: - Safe Array Extension

extension Array {
    subscript(safe index: Int) -> Element? {
        guard index >= 0, index < count else { return nil }
        return self[index]
    }
}
