//
//  ErrorView.swift
//  SwapDog
//
//  Reusable full-screen (or inline) error state component.
//  Displays an icon, title, message, and an optional retry button.
//
//  Architecture layer: DesignSystem/Components (pure UI, no business logic)
//  Locked decisions:
//    - Configurable for network / notFound / generic error types
//    - All tap targets >= 44x44 pt
//    - VoiceOver reads icon as hidden; title+message+button are announced
//

import SwiftUI

// MARK: - ErrorView

/// A configurable error state view for network, not-found, and generic errors.
///
/// Usage:
/// ```swift
/// ErrorView(type: .network) {
///     Task { await viewModel.reload() }
/// }
/// ```
struct ErrorView: View {

    // MARK: - Error Type

    /// Semantic error categories driving icon, title, and default message.
    enum ErrorType {
        /// A network or connectivity problem (no connection, timeout).
        case network
        /// The requested resource was not found.
        case notFound
        /// A generic or unexpected failure.
        case generic

        var icon: String {
            switch self {
            case .network:  return "wifi.slash"
            case .notFound: return "magnifyingglass"
            case .generic:  return "exclamationmark.triangle"
            }
        }

        var title: String {
            switch self {
            case .network:  return "No Connection"
            case .notFound: return "Not Found"
            case .generic:  return "Something Went Wrong"
            }
        }

        var defaultMessage: String {
            switch self {
            case .network:
                return "Check your internet connection and try again."
            case .notFound:
                return "We couldn't find what you were looking for."
            case .generic:
                return "An unexpected error occurred. Please try again."
            }
        }
    }

    // MARK: - Inputs

    /// The kind of error to display.
    let type: ErrorType

    /// Override the default message for the error type.
    var message: String? = nil

    /// Optional retry handler — when non-nil a \"Try Again\" button is shown.
    var retryAction: (() -> Void)? = nil

    // MARK: - Body

    var body: some View {
        VStack(spacing: Theme.Spacing.lg) {
            iconView
            textStack
            if let retry = retryAction {
                retryButton(action: retry)
            }
        }
        .padding(.horizontal, Theme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(combinedAccessibilityLabel)
    }

    // MARK: - Subviews

    private var iconView: some View {
        Image(systemName: type.icon)
            .font(.system(size: 64, weight: .thin))
            .foregroundStyle(Theme.Colors.error.opacity(0.7))
            .accessibilityHidden(true)
    }

    private var textStack: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Text(type.title)
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)
                .multilineTextAlignment(.center)

            Text(resolvedMessage)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func retryButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text("Try Again")
                .primaryButtonStyle()
        }
        .frame(maxWidth: 240)
        .frame(minHeight: 44)
        .accessibilityLabel("Try Again")
        .animation(Theme.Animation.buttonPress, value: true)
    }

    // MARK: - Helpers

    private var resolvedMessage: String {
        message ?? type.defaultMessage
    }

    private var combinedAccessibilityLabel: String {
        var parts = [type.title, resolvedMessage]
        if retryAction != nil { parts.append("Double tap to try again.") }
        return parts.joined(separator: ". ")
    }
}

// MARK: - Previews

#Preview("Network Error") {
    ErrorView(type: .network) {
        // retry action
    }
    .background(Theme.Colors.background)
}

#Preview("Not Found") {
    ErrorView(
        type: .notFound,
        message: "This profile may have been removed."
    )
    .background(Theme.Colors.background)
}

#Preview("Generic — No Retry") {
    ErrorView(type: .generic)
        .background(Theme.Colors.background)
}

#Preview("Dark Mode") {
    ErrorView(type: .network) {
        // retry action
    }
    .background(Theme.Colors.background)
    .preferredColorScheme(.dark)
}
