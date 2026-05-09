//
//  BreedAutocompleteField.swift
//  SwapDog
//
//  Searchable text field with a dropdown of breed suggestions.
//  Contains the canonical breed list (50 breeds + Mixed + Other = 52 total).
//
//  Architecture layer: DesignSystem/Components (pure UI, no business logic)
//

import SwiftUI

// MARK: - Breed List

/// Top 50 dog breeds + "Mixed" + "Other", sorted alphabetically (52 entries total).
enum BreedList {
    static let all: [String] = [
        "Affenpinscher",
        "Australian Shepherd",
        "Basset Hound",
        "Beagle",
        "Belgian Malinois",
        "Bernese Mountain Dog",
        "Bichon Frise",
        "Border Collie",
        "Boston Terrier",
        "Boxer",
        "Bulldog",
        "Cavalier King Charles Spaniel",
        "Chihuahua",
        "Chow Chow",
        "Cocker Spaniel",
        "Dachshund",
        "Dalmatian",
        "Doberman Pinscher",
        "French Bulldog",
        "German Shepherd",
        "Golden Retriever",
        "Great Dane",
        "Greyhound",
        "Havanese",
        "Irish Setter",
        "Jack Russell Terrier",
        "Labrador Retriever",
        "Lhasa Apso",
        "Maltese",
        "Miniature Pinscher",
        "Miniature Schnauzer",
        "Mixed",
        "Newfoundland",
        "Other",
        "Papillon",
        "Pekingese",
        "Pembroke Welsh Corgi",
        "Pit Bull Terrier",
        "Pointer",
        "Pomeranian",
        "Poodle",
        "Pug",
        "Rottweiler",
        "Saint Bernard",
        "Samoyed",
        "Scottish Terrier",
        "Shetland Sheepdog",
        "Shih Tzu",
        "Siberian Husky",
        "Staffordshire Bull Terrier",
        "Vizsla",
        "Weimaraner"
    ]
}

// MARK: - BreedAutocompleteField

/// A text field that filters the breed list as the user types and shows a
/// scrollable dropdown of matching suggestions.
///
/// - Parameters:
///   - selectedBreed: Binding to the currently selected breed string.
///   - placeholder:   Placeholder text shown when the field is empty.
public struct BreedAutocompleteField: View {

    // MARK: - Inputs

    @Binding var selectedBreed: String
    var placeholder: String = "Search breed…"

    // MARK: - Internal State

    @State private var query: String = ""
    @State private var isExpanded: Bool = false
    @FocusState private var isFocused: Bool

    private var suggestions: [String] {
        guard !query.isEmpty else { return [] }
        let lower = query.lowercased()
        return BreedList.all.filter { $0.lowercased().contains(lower) }
    }

    // MARK: - Body

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            textField
            if isExpanded && !suggestions.isEmpty {
                dropdown
            }
        }
        .onChange(of: selectedBreed) { _, newValue in
            query = newValue
        }
        .onAppear {
            query = selectedBreed
        }
    }

    // MARK: - Subviews

    private var textField: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Theme.Colors.textSecondary)
            TextField(placeholder, text: $query)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .focused($isFocused)
                .onChange(of: query) { _, newValue in
                    selectedBreed = newValue
                    isExpanded = !newValue.isEmpty
                }
                .onChange(of: isFocused) { _, focused in
                    if !focused { isExpanded = false }
                }
            if !query.isEmpty {
                Button {
                    query = ""
                    selectedBreed = ""
                    isExpanded = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Theme.Spacing.md)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                .stroke(
                    isFocused ? Theme.Colors.primary : Theme.Colors.textSecondary.opacity(0.3),
                    lineWidth: 1
                )
        )
    }

    private var dropdown: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(suggestions, id: \.self) { breed in
                    Button {
                        selectBreed(breed)
                    } label: {
                        HStack {
                            Text(breed)
                                .font(Theme.Typography.body)
                                .foregroundStyle(Theme.Colors.textPrimary)
                            Spacer()
                        }
                        .padding(.horizontal, Theme.Spacing.md)
                        .padding(.vertical, Theme.Spacing.sm)
                    }
                    .buttonStyle(.plain)

                    if breed != suggestions.last {
                        Divider()
                            .padding(.horizontal, Theme.Spacing.md)
                    }
                }
            }
        }
        .frame(maxHeight: 200)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
        .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
        .zIndex(100)
    }

    // MARK: - Private

    private func selectBreed(_ breed: String) {
        query = breed
        selectedBreed = breed
        isExpanded = false
        isFocused = false
    }
}

// MARK: - Preview

#Preview {
    @Previewable @State var breed: String = ""

    VStack(spacing: Theme.Spacing.lg) {
        BreedAutocompleteField(selectedBreed: $breed)
        Text("Selected: \(breed.isEmpty ? "none" : breed)")
            .font(Theme.Typography.footnote)
            .foregroundStyle(Theme.Colors.textSecondary)
    }
    .padding()
    .screenBackground()
}
