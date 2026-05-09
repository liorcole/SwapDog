//
//  ChipSelectionView.swift
//  SwapDog
//
//  Multi-select chip / tag component.
//  Selected chips use the primary brand colour; unselected use the surface colour.
//
//  Architecture layer: DesignSystem/Components (pure UI, no business logic)
//

import SwiftUI

/// A wrapping grid of selectable chip tags for multi-select input.
///
/// Chips flow left-to-right and wrap to the next line automatically via
/// `LazyVGrid` with adaptive columns.  Toggling a chip updates the
/// `selectedOptions` binding immediately.
///
/// - Parameters:
///   - options:         All available option strings.
///   - selectedOptions: Binding to the set of currently selected values.
public struct ChipSelectionView: View {

    // MARK: - Inputs

    let options: [String]
    @Binding var selectedOptions: Set<String>

    // MARK: - Layout

    private let columns = [
        GridItem(.adaptive(minimum: 90, maximum: 180), spacing: Theme.Spacing.sm)
    ]

    // MARK: - Body

    public var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: Theme.Spacing.sm) {
            ForEach(options, id: \.self) { option in
                chipButton(for: option)
            }
        }
    }

    // MARK: - Chip

    private func chipButton(for option: String) -> some View {
        let isSelected = selectedOptions.contains(option)

        return Button {
            toggleSelection(option)
        } label: {
            Text(option)
                .font(Theme.Typography.subheadline)
                .foregroundStyle(isSelected ? .white : Theme.Colors.textPrimary)
                .padding(.horizontal, Theme.Spacing.md)
                .padding(.vertical, Theme.Spacing.sm)
                .background(isSelected ? Theme.Colors.primary : Theme.Colors.surface)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(
                            isSelected ? Theme.Colors.primary : Theme.Colors.textSecondary.opacity(0.3),
                            lineWidth: 1
                        )
                )
                .animation(.easeInOut(duration: 0.15), value: isSelected)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    // MARK: - Private

    private func toggleSelection(_ option: String) {
        if selectedOptions.contains(option) {
            selectedOptions.remove(option)
        } else {
            selectedOptions.insert(option)
        }
    }
}

// MARK: - Preview

#Preview {
    @Previewable @State var selected: Set<String> = ["Friendly", "Playful"]

    ChipSelectionView(
        options: [
            "Friendly", "Playful", "Calm", "Energetic", "Gentle",
            "Protective", "Independent", "Loyal", "Shy", "Social",
            "Curious", "Affectionate"
        ],
        selectedOptions: $selected
    )
    .padding()
}
