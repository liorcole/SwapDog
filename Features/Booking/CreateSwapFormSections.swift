//
//  CreateSwapFormSections.swift
//  SwapDog
//
//  Extracted subview components for CreateSwapRequestView.
//  Kept separate to stay within the 300-line file limit.
//
//  Architecture: MVVM-C — View layer (pure display components)
//

import SwiftUI

// MARK: - SwapRecipientSection

/// Header section showing the recipient's dogs.
struct SwapRecipientSection: View {

    let dogs: [Dog]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Requesting a swap with")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .textCase(.uppercase)

            HStack(spacing: Theme.Spacing.md) {
                CachedAsyncImage(
                    urlString: dogs.first?.photos.first,
                    cornerRadius: Theme.CornerRadius.pill,
                    size: CGSize(width: 52, height: 52)
                )
                .frame(width: 52, height: 52)

                VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                    Text(dogs.map(\.name).joined(separator: " & "))
                        .font(Theme.Typography.headline)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("\(dogs.count) dog\(dogs.count == 1 ? "" : "s")")
                        .font(Theme.Typography.footnote)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                Spacer()
            }
        }
    }
}

// MARK: - SwapDogSelectionSection

/// Multi-select dog picker for the current user's dogs.
struct SwapDogSelectionSection: View {

    let myDogs: [Dog]
    let selectedIDs: Set<String>
    let onToggle: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Your dogs to include")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .textCase(.uppercase)

            if myDogs.isEmpty {
                Text("You have no dogs registered.")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
            } else {
                ForEach(myDogs) { dog in
                    DogSelectionRow(
                        dog: dog,
                        isSelected: selectedIDs.contains(dog.id),
                        onToggle: { onToggle(dog.id) }
                    )
                }
            }
        }
    }
}

// MARK: - DogSelectionRow

/// One row in the dog multi-select list.
struct DogSelectionRow: View {

    let dog: Dog
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: Theme.Spacing.md) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isSelected ? Theme.Colors.primary : Theme.Colors.textSecondary)

                CachedAsyncImage(
                    urlString: dog.photos.first,
                    cornerRadius: Theme.CornerRadius.pill,
                    size: CGSize(width: 40, height: 40)
                )
                .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 2) {
                    Text(dog.name)
                        .font(Theme.Typography.headline)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("\(dog.breed) · \(dog.size.weightRange)")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                Spacer()
            }
            .padding(Theme.Spacing.sm)
            .background(isSelected ? Theme.Colors.primary.opacity(0.08) : Theme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(dog.name), \(isSelected ? "selected" : "not selected")")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

// MARK: - SwapDatePickerSection

/// Start / end date pickers with inline validation error.
struct SwapDatePickerSection: View {

    @Binding var startDate: Date
    @Binding var endDate: Date
    let validationError: String?

    private var minimumDate: Date {
        Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: Date())) ?? Date()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Swap dates")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .textCase(.uppercase)

            DatePicker("Start", selection: $startDate, in: minimumDate..., displayedComponents: .date)
                .datePickerStyle(.compact)
                .tint(Theme.Colors.primary)

            DatePicker("End", selection: $endDate, in: startDate..., displayedComponents: .date)
                .datePickerStyle(.compact)
                .tint(Theme.Colors.primary)

            if let error = validationError {
                Text(error)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.error)
            }
        }
    }
}

// MARK: - SwapMessageSection

/// Optional message TextEditor with character counter.
struct SwapMessageSection: View {

    @Binding var message: String
    let maxLength: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("Message (optional)")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .textCase(.uppercase)
                Spacer()
                Text("\(message.count)/\(maxLength)")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(
                        message.count >= maxLength ? Theme.Colors.error : Theme.Colors.textSecondary
                    )
            }

            TextEditor(text: $message)
                .frame(minHeight: 100)
                .padding(Theme.Spacing.sm)
                .background(Theme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
                        .stroke(Theme.Colors.fieldBorder)
                )
                .onChange(of: message) { _, newValue in
                    if newValue.count > maxLength {
                        message = String(newValue.prefix(maxLength))
                    }
                }
        }
    }
}

// MARK: - SwapSummaryCard

/// Read-only summary of the swap request before submission.
struct SwapSummaryCard: View {

    @ObservedObject var viewModel: CreateSwapViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Summary")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .textCase(.uppercase)

            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack {
                    Label(selectedDogNames, systemImage: "pawprint.fill")
                        .font(Theme.Typography.subheadline)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Spacer()
                    Image(systemName: "arrow.left.arrow.right")
                        .foregroundStyle(Theme.Colors.primary)
                    Spacer()
                    Label(recipientDogNames, systemImage: "pawprint")
                        .font(Theme.Typography.subheadline)
                        .foregroundStyle(Theme.Colors.textPrimary)
                }

                Label(dateRangeText, systemImage: "calendar")
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.textSecondary)

                if !viewModel.message.isEmpty {
                    Text("\"\(viewModel.message.prefix(80))\(viewModel.message.count > 80 ? "…" : "")\"")
                        .font(Theme.Typography.footnote)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .italic()
                }
            }
            .padding(Theme.Spacing.md)
            .background(Theme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                    .stroke(Theme.Colors.primary.opacity(0.3))
            )
        }
    }

    private var selectedDogNames: String {
        viewModel.myDogs
            .filter { viewModel.selectedDogIDs.contains($0.id) }
            .map(\.name)
            .joined(separator: ", ")
    }

    private var recipientDogNames: String {
        viewModel.theirDogs.map(\.name).joined(separator: ", ")
    }

    private var dateRangeText: String {
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        return "\(fmt.string(from: viewModel.startDate)) – \(fmt.string(from: viewModel.endDate))"
    }
}
