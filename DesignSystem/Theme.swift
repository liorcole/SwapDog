//
//  Theme.swift
//  SwapDog
//
//  Single source of truth for the SwapDog design system.
//  Import this file anywhere you need colors, typography, spacing, or animation.
//
//  Rules:
//  - All values are static lets — no magic strings, no inline hex values in views
//  - Semantic colors use UIColor adaptive initialiser for automatic light/dark mode
//  - Brand colors (primary, secondary, accent, error) never change with dark mode
//  - Typography uses Font to stay UIKit-free
//  - Animation constants ensure consistent motion throughout the app

import SwiftUI

/// Top-level namespace for the SwapDog design system.
enum Theme {

    // MARK: - Colors

    /// Semantic color palette for the SwapDog brand.
    ///
    /// Brand colors are fixed; semantic colors adapt to light/dark mode automatically
    /// via UIColor's `init(_:dynamicProvider:)`.
    enum Colors {

        // MARK: Brand Colors (light/dark invariant)

        /// Warm orange — primary brand color.  #FF6B35
        static let primary = Color(hex: "#FF6B35")

        /// Deep navy — secondary brand color.  #004E89
        static let secondary = Color(hex: "#004E89")

        /// Sunny yellow — accent / highlight color.  #F7C948
        static let accent = Color(hex: "#F7C948")

        /// Red — destructive actions and error states.  #DC3545
        static let error = Color(hex: "#DC3545")

        // MARK: Semantic / Adaptive Colors (light ↔ dark)

        /// App background — adapts: #FAFAFA (light) / #121212 (dark).
        static let background = Color(uiColor: UIColor { tc in
            tc.userInterfaceStyle == .dark
                ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) // #121212
                : UIColor(red: 0.980, green: 0.980, blue: 0.980, alpha: 1) // #FAFAFA
        })

        /// Card / surface background — adapts: #FFFFFF (light) / #1E1E1E (dark).
        static let surface = Color(uiColor: UIColor { tc in
            tc.userInterfaceStyle == .dark
                ? UIColor(red: 0.118, green: 0.118, blue: 0.118, alpha: 1) // #1E1E1E
                : UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 1) // #FFFFFF
        })

        /// Alias for `surface` — used for explicit card backgrounds.
        static var cardBackground: Color { surface }

        /// Primary body text — adapts: #1A1A2E (light) / #F0F0F0 (dark).
        static let textPrimary = Color(uiColor: UIColor { tc in
            tc.userInterfaceStyle == .dark
                ? UIColor(red: 0.941, green: 0.941, blue: 0.941, alpha: 1) // #F0F0F0
                : UIColor(red: 0.102, green: 0.102, blue: 0.180, alpha: 1) // #1A1A2E
        })

        /// Alias for `textPrimary` — shorter form for convenience.
        static var text: Color { textPrimary }

        /// Secondary / caption text — adapts: #6B7280 (light) / #9CA3AF (dark).
        static let textSecondary = Color(uiColor: UIColor { tc in
            tc.userInterfaceStyle == .dark
                ? UIColor(red: 0.612, green: 0.639, blue: 0.686, alpha: 1) // #9CA3AF
                : UIColor(red: 0.420, green: 0.447, blue: 0.502, alpha: 1) // #6B7280
        })

        /// Thin separator lines — adapts: #E5E7EB (light) / #374151 (dark).
        static let separator = Color(uiColor: UIColor { tc in
            tc.userInterfaceStyle == .dark
                ? UIColor(red: 0.216, green: 0.255, blue: 0.318, alpha: 1) // #374151
                : UIColor(red: 0.898, green: 0.906, blue: 0.922, alpha: 1) // #E5E7EB
        })

        /// Input field / TextEditor borders — adapts to both modes.
        static let fieldBorder = Color(uiColor: UIColor { tc in
            tc.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: 0.15)
                : UIColor(white: 0.0, alpha: 0.15)
        })

        /// Modal / loading overlay tint — consistent across modes.
        static let overlayBackground = Color.black.opacity(0.45)

        // MARK: Shimmer / Skeleton Colors

        /// Base fill for shimmer skeleton placeholders.
        static let shimmerBase = Color(uiColor: UIColor { tc in
            tc.userInterfaceStyle == .dark
                ? UIColor(white: 0.22, alpha: 1)
                : UIColor(white: 0.88, alpha: 1)
        })

        /// Highlight sweep colour for the shimmer animation.
        static let shimmerHighlight = Color(uiColor: UIColor { tc in
            tc.userInterfaceStyle == .dark
                ? UIColor(white: 0.32, alpha: 0.9)
                : UIColor(white: 0.96, alpha: 0.9)
        })

        // MARK: Status Colors

        /// Pending-status orange — uses system orange (adapts automatically).
        static let statusPending = Color(uiColor: .systemOrange)

        /// Accepted/success green — uses system green (adapts automatically).
        static let statusAccepted = Color(uiColor: .systemGreen)
    }

    // MARK: - Typography

    /// SwiftUI `Font` scale supporting Dynamic Type at all sizes including XXL.
    ///
    /// All fonts use `.system(.textStyle)` so they scale with the user's accessibility
    /// text-size preference automatically. Views should set `lineLimit(nil)` or
    /// `.fixedSize(horizontal: false, vertical: true)` where text must not be truncated.
    enum Typography {
        /// largeTitle — 34 pt equivalent, bold. Scales with Dynamic Type.
        static let largeTitle: Font = .system(.largeTitle, design: .default, weight: .bold)

        /// title — 28 pt equivalent, bold. Scales with Dynamic Type.
        static let title: Font = .system(.title, design: .default, weight: .bold)

        /// title2 — 22 pt equivalent, semibold. Scales with Dynamic Type.
        static let title2: Font = .system(.title2, design: .default, weight: .semibold)

        /// title3 — 20 pt equivalent, semibold. Scales with Dynamic Type.
        static let title3: Font = .system(.title3, design: .default, weight: .semibold)

        /// headline — 17 pt equivalent, semibold. Scales with Dynamic Type.
        static let headline: Font = .system(.headline, design: .default, weight: .semibold)

        /// body — 17 pt equivalent, regular. Scales with Dynamic Type.
        static let body: Font = .system(.body, design: .default, weight: .regular)

        /// callout — 16 pt equivalent, regular. Scales with Dynamic Type.
        static let callout: Font = .system(.callout, design: .default, weight: .regular)

        /// subheadline — 15 pt equivalent, regular. Scales with Dynamic Type.
        static let subheadline: Font = .system(.subheadline, design: .default, weight: .regular)

        /// footnote — 13 pt equivalent, regular. Scales with Dynamic Type.
        static let footnote: Font = .system(.footnote, design: .default, weight: .regular)

        /// caption — 12 pt equivalent, regular. Scales with Dynamic Type.
        static let caption: Font = .system(.caption, design: .default, weight: .regular)
    }

    // MARK: - Spacing

    /// 4-pt grid spacing constants.
    enum Spacing {
        /// 4 pt — tight internal padding.
        static let xs: CGFloat = 4

        /// 8 pt — compact spacing between related elements.
        static let sm: CGFloat = 8

        /// 16 pt — standard content padding.
        static let md: CGFloat = 16

        /// 24 pt — generous section spacing.
        static let lg: CGFloat = 24

        /// 32 pt — large whitespace blocks.
        static let xl: CGFloat = 32

        /// 48 pt — hero / full-bleed section gaps.
        static let xxl: CGFloat = 48
    }

    // MARK: - Corner Radius

    /// Standard corner radii for consistent rounding across components.
    enum CornerRadius {
        /// 4 pt — subtle rounding (tags, badges).
        static let xs: CGFloat = 4
        /// 8 pt — small cards, inputs.
        static let sm: CGFloat = 8
        /// 12 pt — standard cards.
        static let md: CGFloat = 12
        /// 16 pt — large cards, sheets.
        static let lg: CGFloat = 16
        /// 24 pt — pill buttons, full rounding.
        static let pill: CGFloat = 24
    }

    // MARK: - Animation

    /// Motion constants for consistent, purposeful animation throughout the app.
    enum Animation {
        /// 100 ms ease-in-out — for button press scale feedback.
        static let buttonPress = SwiftUI.Animation.easeInOut(duration: 0.1)

        /// 300 ms ease-out — for card appear / fade-in transitions.
        static let cardAppear = SwiftUI.Animation.easeOut(duration: 0.3)

        /// 200 ms ease-in-out — for tab transitions and modal animations.
        static let standard = SwiftUI.Animation.easeInOut(duration: 0.2)

        /// 250 ms ease-in-out — for toggle and picker state changes.
        static let interactive = SwiftUI.Animation.easeInOut(duration: 0.25)
    }
}

// MARK: - Color Hex Initialiser

extension Color {
    /// Initialise a `Color` from a CSS-style hex string (e.g. `"#FF6B35"` or `"FF6B35"`).
    /// - Parameter hex: A 6-character hex string with an optional `#` prefix.
    init(hex: String) {
        let sanitised = hex.trimmingCharacters(in: .alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: sanitised).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255.0
        let g = Double((int >> 8) & 0xFF) / 255.0
        let b = Double(int & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}
