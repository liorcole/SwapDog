//
//  MessageBubble.swift
//  SwapDog
//
//  Reusable chat message bubble component.
//  Incoming (theirs) aligns left; outgoing (yours) aligns right.
//
//  Architecture layer: DesignSystem/Components
//  Locked decisions:
//    - Outgoing: Theme.Colors.primary bg, white text
//    - Incoming: Theme.Colors.surface bg, Theme.Colors.textPrimary text
//    - Corner radius 16 pt on all corners except the "tail" corner:
//      outgoing → bottom-trailing, incoming → bottom-leading
//

import SwiftUI

// MARK: - MessageBubble

/// A single chat message rendered as a rounded rectangle bubble.
///
/// Outgoing messages (yours) appear on the right with the primary brand
/// colour and white text. Incoming messages appear on the left with a
/// white surface and near-black text.
///
/// The "tail" corner — bottom-trailing for outgoing, bottom-leading for
/// incoming — is left square to visually anchor the bubble to the sender.
///
/// Usage:
/// ```swift
/// MessageBubble(
///     text: "Hey!",
///     isFromCurrentUser: true,
///     timestamp: Date(),
///     showTimestamp: true
/// )
/// ```
struct MessageBubble: View {

    // MARK: - Inputs

    /// The message text to display inside the bubble.
    let text: String

    /// `true` when this message was sent by the current user.
    let isFromCurrentUser: Bool

    /// The message's creation timestamp. Shown beneath the bubble when `showTimestamp` is true.
    let timestamp: Date

    /// Whether to render the timestamp label below the bubble.
    let showTimestamp: Bool

    // MARK: - Constants

    private enum Layout {
        static let cornerRadius: CGFloat = 16
        static let tailRadius:   CGFloat = 4
        static let maxWidthFraction: CGFloat = 0.78
        static let horizontalPadding: CGFloat = Theme.Spacing.md
        static let verticalPadding:   CGFloat = Theme.Spacing.sm
    }

    // MARK: - Computed

    private var backgroundColor: Color {
        isFromCurrentUser ? Theme.Colors.primary : Theme.Colors.surface
    }

    private var textColor: Color {
        isFromCurrentUser ? .white : Theme.Colors.textPrimary
    }

    private var timestampColor: Color {
        Theme.Colors.textSecondary
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: isFromCurrentUser ? .trailing : .leading, spacing: Theme.Spacing.xs) {
            textBubble
            if showTimestamp {
                timestampLabel
            }
        }
    }

    // MARK: - Private: Bubble

    private var textBubble: some View {
        Text(text)
            .font(Theme.Typography.body)
            .foregroundStyle(textColor)
            .padding(.horizontal, Layout.horizontalPadding)
            .padding(.vertical, Layout.verticalPadding)
            .background(backgroundColor)
            .clipShape(bubbleShape)
            .shadow(
                color: .black.opacity(0.05),
                radius: 2,
                x: 0,
                y: 1
            )
    }

    private var timestampLabel: some View {
        Text(timestamp.timeString)
            .font(Theme.Typography.caption)
            .foregroundStyle(timestampColor)
    }

    // MARK: - Private: Shape

    /// Returns an `UnevenRoundedRectangle` that leaves the "tail" corner square.
    ///
    /// Outgoing messages: all corners rounded except bottom-trailing.
    /// Incoming messages: all corners rounded except bottom-leading.
    private var bubbleShape: UnevenRoundedRectangle {
        let r = Layout.cornerRadius
        let tail = Layout.tailRadius

        if isFromCurrentUser {
            return UnevenRoundedRectangle(
                topLeadingRadius:     r,
                bottomLeadingRadius:  r,
                bottomTrailingRadius: tail,
                topTrailingRadius:    r
            )
        } else {
            return UnevenRoundedRectangle(
                topLeadingRadius:     r,
                bottomLeadingRadius:  tail,
                bottomTrailingRadius: r,
                topTrailingRadius:    r
            )
        }
    }
}

// MARK: - Preview

#Preview("Outgoing & Incoming Bubbles") {
    ScrollView {
        VStack(spacing: Theme.Spacing.md) {

            // Outgoing — short
            HStack {
                Spacer()
                MessageBubble(
                    text: "Hey! Are you free this weekend to swap?",
                    isFromCurrentUser: true,
                    timestamp: Date().addingTimeInterval(-300),
                    showTimestamp: true
                )
            }
            .padding(.horizontal, Theme.Spacing.md)

            // Incoming — short
            HStack {
                MessageBubble(
                    text: "Hi! Yes, Saturday works great for me 🐶",
                    isFromCurrentUser: false,
                    timestamp: Date().addingTimeInterval(-240),
                    showTimestamp: true
                )
                Spacer()
            }
            .padding(.horizontal, Theme.Spacing.md)

            // Outgoing — long
            HStack {
                Spacer()
                MessageBubble(
                    text: "Luna loves the park near your place. She gets along really well with other dogs and is fully vaccinated. Would 10 AM work?",
                    isFromCurrentUser: true,
                    timestamp: Date().addingTimeInterval(-180),
                    showTimestamp: false
                )
            }
            .padding(.horizontal, Theme.Spacing.md)

            // Incoming — medium
            HStack {
                MessageBubble(
                    text: "10 AM is perfect! Rocky will be so excited to have a playdate.",
                    isFromCurrentUser: false,
                    timestamp: Date().addingTimeInterval(-60),
                    showTimestamp: true
                )
                Spacer()
            }
            .padding(.horizontal, Theme.Spacing.md)
        }
        .padding(.vertical, Theme.Spacing.lg)
    }
    .background(Theme.Colors.background)
}
