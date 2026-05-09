//
//  Date+Extensions.swift
//  SwapDog
//
//  Convenience helpers for displaying dates in a human-readable format
//  throughout the app (feed timestamps, booking dates, message times, etc.).

import Foundation

extension Date {

    // MARK: - Relative Time

    /// Returns a short, human-readable relative time string.
    ///
    /// Examples:
    /// - "Just now" (< 60 s ago)
    /// - "2m ago"
    /// - "1h ago"
    /// - "Yesterday"
    /// - "Mon" (within the past week)
    /// - "12 Apr" (within the current year)
    /// - "12 Apr 2024" (older than a year)
    var relativeTimeString: String {
        let now = Date()
        let interval = now.timeIntervalSince(self)

        switch interval {
        case ..<60:
            return "Just now"
        case 60..<3600:
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        case 3600..<86400:
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        case 86400..<172800:
            return "Yesterday"
        case 172800..<604800:
            return shortDayFormatter.string(from: self)
        case 604800...:
            let calendar = Calendar.current
            if calendar.isDate(self, equalTo: now, toGranularity: .year) {
                return dayMonthFormatter.string(from: self)
            } else {
                return fullDateFormatter.string(from: self)
            }
        default:
            return shortDayFormatter.string(from: self)
        }
    }

    // MARK: - Formatted Strings

    /// Returns the time component only, e.g. "3:45 PM".
    var timeString: String {
        timeFormatter.string(from: self)
    }

    /// Returns the date formatted as "12 Apr 2024".
    var fullDateString: String {
        fullDateFormatter.string(from: self)
    }

    /// Returns ISO 8601 string suitable for Firestore storage.
    var iso8601String: String {
        iso8601Formatter.string(from: self)
    }

    // MARK: - Helpers

    /// Whether this date falls on today.
    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    /// Whether this date falls on yesterday.
    var isYesterday: Bool {
        Calendar.current.isDateInYesterday(self)
    }
}

// MARK: - Private Formatters (reused across calls)

private let timeFormatter: DateFormatter = {
    let f = DateFormatter()
    f.timeStyle = .short
    f.dateStyle = .none
    return f
}()

private let shortDayFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "EEE"
    return f
}()

private let dayMonthFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "d MMM"
    return f
}()

private let fullDateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "d MMM yyyy"
    return f
}()

private let iso8601Formatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()
