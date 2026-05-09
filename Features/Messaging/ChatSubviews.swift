//
//  ChatSubviews.swift
//  SwapDog
//
//  Composable sub-views used by ChatView:
//    - MessageRow      — aligns MessageBubble left or right
//    - TimestampSeparator — centred date/time label between message clusters
//    - ChatInputBar    — text field + send button composite
//
//  Architecture layer: Features/Messaging (View helpers)
//

import SwiftUI

// MARK: - MessageRow

/// Wraps a `MessageBubble` and handles its horizontal alignment within the
/// chat scroll view.
///
/// Outgoing (current user) bubbles are right-aligned; incoming are left-aligned.
struct MessageRow: View {

    // MARK: - Inputs

    let message: Message
    let isFromCurrentUser: Bool
    let showTimestamp: Bool

    // MARK: - Body

    var body: some View {
        HStack(spacing: 0) {
            if isFromCurrentUser {
                Spacer(minLength: chatMarginWidth)
                bubble
            } else {
                bubble
                Spacer(minLength: chatMarginWidth)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityDescription)
    }

    // MARK: - Private

    /// Minimum horizontal margin so long bubbles don't fill the full width.
    private var chatMarginWidth: CGFloat { 64 }

    private var bubble: some View {
        MessageBubble(
            text:              message.text,
            isFromCurrentUser: isFromCurrentUser,
            timestamp:         message.timestamp,
            showTimestamp:     showTimestamp
        )
        .padding(.horizontal, Theme.Spacing.md)
    }

    private var accessibilityDescription: String {
        let who = isFromCurrentUser ? "You" : "Other"
        let time = message.timestamp.timeString
        return "\(who), \(message.text), sent at \(time)"
    }
}

// MARK: - TimestampSeparator

/// A centred, muted date-time label rendered between message clusters that
/// are more than 15 minutes apart.
struct TimestampSeparator: View {

    let date: Date

    var body: some View {
        HStack {
            Spacer()
            Text(date.chatSeparatorString)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .padding(.horizontal, Theme.Spacing.md)
                .padding(.vertical, Theme.Spacing.xs)
                .background(
                    Capsule()
                        .fill(Theme.Colors.surface.opacity(0.8))
                        .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
                )
            Spacer()
        }
        .padding(.vertical, Theme.Spacing.xs)
        .accessibilityLabel(date.chatSeparatorString)
    }
}

// MARK: - ChatInputBar

/// A fixed-height bar at the bottom of the chat screen containing a `TextField`
/// and a send button.
///
/// The send button is disabled and dimmed when the input is empty or a send is
/// already in flight.
struct ChatInputBar: View {

    // MARK: - Bindings

    @Binding var text: String
    let isSending: Bool
    let onSend: () async -> Void

    // MARK: - Private State

    @FocusState private var isInputFocused: Bool

    // MARK: - Constants

    private enum Layout {
        static let barMinHeight: CGFloat = 56
        static let inputCornerRadius: CGFloat = Theme.CornerRadius.pill
        static let sendButtonSize: CGFloat = 36
    }

    // MARK: - Computed

    private var canSend: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }

    // MARK: - Body

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            inputField
            sendButton
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.sm)
        .frame(minHeight: Layout.barMinHeight)
        .background(
            Theme.Colors.surface
                .shadow(color: .black.opacity(0.08), radius: 4, x: 0, y: -2)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    // MARK: - Subviews

    private var inputField: some View {
        TextField("Message…", text: $text, axis: .vertical)
            .font(Theme.Typography.body)
            .foregroundStyle(Theme.Colors.textPrimary)
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.sm)
            .background(Theme.Colors.background)
            .clipShape(RoundedRectangle(cornerRadius: Layout.inputCornerRadius, style: .continuous))
            .lineLimit(1...5)
            .focused($isInputFocused)
            .accessibilityLabel("Message input")
            .submitLabel(.send)
            .onSubmit {
                guard canSend else { return }
                Task { await onSend() }
            }
    }

    private var sendButton: some View {
        Button {
            Task { await onSend() }
        } label: {
            Image(systemName: "paperplane.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(canSend ? .white : Theme.Colors.textSecondary)
                .frame(width: Layout.sendButtonSize, height: Layout.sendButtonSize)
                .background(
                    Circle()
                        .fill(canSend ? Theme.Colors.primary : Theme.Colors.shimmerBase)
                )
        }
        .disabled(!canSend)
        .animation(.easeInOut(duration: 0.15), value: canSend)
        .accessibilityLabel("Send message")
    }
}

// MARK: - Previews

#Preview("MessageRow — Outgoing") {
    VStack {
        MessageRow(
            message: .mock,
            isFromCurrentUser: true,
            showTimestamp: true
        )
        MessageRow(
            message: Message(
                id: "m2",
                conversationID: "c1",
                senderID: "usr_other",
                text: "That sounds great! Rocky can't wait.",
                timestamp: Date(),
                readBy: []
            ),
            isFromCurrentUser: false,
            showTimestamp: true
        )
    }
    .padding()
    .background(Theme.Colors.background)
}

#Preview("TimestampSeparator") {
    TimestampSeparator(date: Date().addingTimeInterval(-3600 * 25))
        .padding()
        .background(Theme.Colors.background)
}

#Preview("ChatInputBar") {
    @Previewable @State var text = ""
    ChatInputBar(text: $text, isSending: false) {
        // no-op
    }
    .background(Theme.Colors.surface)
}
