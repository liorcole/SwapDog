//
//  Date+Messaging.swift
//  SwapDog
//
//  Messaging-specific Date helpers: relative timestamps for conversation
//  lists and cluster-separator logic for the chat timeline.
//
//  Architecture layer: Core/Extensions
//  Companion to: Date+Extensions.swift (general-purpose helpers)
//

import Foundation

extension Date {

    // MARK: - Conversation List Timestamps

    /// Returns a short human-readable relative string suitable for conversation row timestamps.
    ///
    /// Delegates to `relativeTimeString` from `Date+Extensions.swift`.
    ///
    /// Examples: "Just now", "2m ago", "1h ago", "Yesterday", "Mon", "Mar 15"
    func relativeTimestamp() -> String {
        relativeTimeString
    }

    // MARK: - Chat Cluster Separators

    /// Returns `true` when a timestamp separator should be displayed between
    /// this message and `other`.
    ///
    /// A separator is shown whenever two consecutive messages are more than
    /// `intervalMinutes` apart, helping readers orient themselves in a long thread.
    ///
    /// - Parameters:
    ///   - other: The adjacent message's timestamp to compare against.
    ///   - intervalMinutes: Gap threshold in minutes. Defaults to 15.
    /// - Returns: `true` if the absolute time gap exceeds the threshold.
    func shouldShowTimestamp(comparedTo other: Date, intervalMinutes: Int = 15) -> Bool {
        let threshold = Double(intervalMinutes) * 60
        return abs(timeIntervalSince(other)) >= threshold
    }

    // MARK: - Chat Separator Label

    /// Returns a formatted string for a chat timestamp separator.
    ///
    /// - Today: "Today at 3:45 PM"
    /// - Yesterday: "Yesterday at 9:12 AM"
    /// - This week: "Mon at 11:00 AM"
    /// - This year: "12 Apr at 2:30 PM"
    /// - Older: "12 Apr 2024 at 2:30 PM"
    var chatSeparatorString: String {
        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInToday(self) {
            return "Today at \(timeString)"
        } else if calendar.isDateInYesterday(self) {
            return "Yesterday at \(timeString)"
        } else if let daysAgo = calendar.dateComponents([.day], from: self, to: now).day,
                  daysAgo < 7 {
            return "\(chatWeekdayFormatter.string(from: self)) at \(timeString)"
        } else if calendar.isDate(self, equalTo: now, toGranularity: .year) {
            return "\(chatDayMonthFormatter.string(from: self)) at \(timeString)"
        } else {
            return "\(chatFullDateFormatter.string(from: self)) at \(timeString)"
        }
    }
}

// MARK: - Private Formatters

private let chatWeekdayFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "EEE"
    return f
}()

private let chatDayMonthFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "d MMM"
    return f
}()

private let chatFullDateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "d MMM yyyy"
    return f
}()
