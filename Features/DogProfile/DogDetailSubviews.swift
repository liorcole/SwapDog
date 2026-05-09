//
//  DogDetailSubviews.swift
//  SwapDog
//
//  Companion subview components for DogDetailView.
//  Kept separate to honour the < 300 line rule per file.
//
//  Architecture: MVVM-C — View layer (pure display components).
//

import SwiftUI

// MARK: - DogHeaderSection

/// Name, breed, life-stage badge, and size chip.
struct DogHeaderSection: View {

    let dog: Dog

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            HStack(alignment: .firstTextBaseline) {
                Text(dog.name)
                    .font(Theme.Typography.largeTitle)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Spacer()
                Text(dog.age.displayName)
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }

            Text(dog.breed)
                .font(Theme.Typography.title3)
                .foregroundStyle(Theme.Colors.textSecondary)

            HStack(spacing: Theme.Spacing.sm) {
                ChipView(text: dog.size.displayName, icon: "scalemass", backgroundColor: Theme.Colors.background)
                Text(dog.size.weightRange)
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - EnergySection

/// 3-bar energy indicator plus label.
struct EnergySection: View {

    let level: EnergyLevel

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Energy Level")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            HStack(spacing: Theme.Spacing.sm) {
                EnergyLevelBars(level: level)
                Text(level.displayName)
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
    }
}

// MARK: - EnergyLevelBars

/// Three ascending bar shapes filled based on the energy level (1–3 bars).
struct EnergyLevelBars: View {

    let level: EnergyLevel

    private var filledBars: Int {
        switch level {
        case .low:      return 1
        case .moderate: return 2
        case .high:     return 3
        }
    }

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<3, id: \.self) { index in
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(index < filledBars ? Theme.Colors.primary : Theme.Colors.textSecondary.opacity(0.2))
                    .frame(width: 8, height: CGFloat(12 + index * 4))
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - TemperamentSection

/// Wrapping flow of display-only temperament chips.
struct TemperamentSection: View {

    let tags: [String]

    private let columns = [GridItem(.adaptive(minimum: 90, maximum: 180), spacing: Theme.Spacing.sm)]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Temperament")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            if tags.isEmpty {
                Text("No traits listed")
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(Theme.Colors.textSecondary)
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: Theme.Spacing.sm) {
                    ForEach(tags, id: \.self) { tag in
                        ChipView(text: tag)
                    }
                }
            }
        }
    }
}

// MARK: - SpecialNeedsCallout

/// Yellow callout box shown when a dog has special care requirements.
struct SpecialNeedsCallout: View {

    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.Colors.statusPending)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("Special Needs")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(text)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Theme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.accent.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Special needs: \(text)")
    }
}

// MARK: - HealthSection

/// Vaccination and spay/neuter status checkmarks.
struct HealthSection: View {

    let vaccinated: Bool
    let spayedNeutered: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Health")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            HealthStatusRow(label: "Vaccinations up to date", isComplete: vaccinated)
            HealthStatusRow(label: "Spayed / Neutered", isComplete: spayedNeutered)
        }
    }
}

// MARK: - HealthStatusRow

/// Single health attribute with a ✓ or ✗ icon.
struct HealthStatusRow: View {

    let label: String
    let isComplete: Bool

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: isComplete ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(isComplete ? Theme.Colors.statusAccepted : Theme.Colors.error)
                .font(.system(size: 20))
                .accessibilityHidden(true)

            Text(label)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)

            Spacer()
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(isComplete ? "Yes" : "No")")
    }
}

// MARK: - OwnerMiniCard

/// Owner photo + name + optional "View Profile" link at the bottom of DogDetailView.
struct OwnerMiniCard: View {

    let owner: User
    var onViewProfile: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Owner")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            HStack(spacing: Theme.Spacing.md) {
                CachedAsyncImage(
                    urlString: owner.profileImageURL,
                    cornerRadius: Theme.CornerRadius.pill,
                    size: CGSize(width: 48, height: 48)
                )
                .frame(width: 48, height: 48)
                .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text(owner.displayName)
                        .font(Theme.Typography.headline)
                        .foregroundStyle(Theme.Colors.textPrimary)

                    if let neighborhood = owner.neighborhood {
                        Text(neighborhood)
                            .font(Theme.Typography.subheadline)
                            .foregroundStyle(Theme.Colors.textSecondary)
                    }
                }

                Spacer()

                if let action = onViewProfile {
                    Button("View Profile", action: action)
                        .font(Theme.Typography.subheadline)
                        .foregroundStyle(Theme.Colors.primary)
                        .frame(minWidth: 44, minHeight: 44)
                        .accessibilityLabel("View \(owner.displayName)'s profile")
                }
            }
            .cardStyle()
        }
    }
}

// MARK: - Display Name Extensions

extension DogAge {
    var displayName: String {
        switch self {
        case .puppy:  return "Puppy (0–1 yr)"
        case .young:  return "Young (1–3 yrs)"
        case .adult:  return "Adult (3–8 yrs)"
        case .senior: return "Senior (8+ yrs)"
        }
    }
}

extension DogSize {
    var displayName: String {
        switch self {
        case .small:      return "Small"
        case .medium:     return "Medium"
        case .large:      return "Large"
        case .extraLarge: return "Extra Large"
        }
    }
}

extension EnergyLevel {
    var displayName: String {
        switch self {
        case .low:      return "Low Energy"
        case .moderate: return "Moderate Energy"
        case .high:     return "High Energy"
        }
    }
}
