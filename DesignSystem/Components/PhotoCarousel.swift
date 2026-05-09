//
//  PhotoCarousel.swift
//  SwapDog
//
//  Swipeable photo gallery with page-indicator dots.
//  Uses CachedAsyncImage — no 3rd-party libraries.
//
//  Architecture layer: DesignSystem/Components (pure UI, no business logic)
//
//  Edge cases handled:
//  0 photos — camera.fill placeholder on gray background
//  1 photo  — shows image, no page dots
//  2+ photos — swipeable TabView with page dots
//

import SwiftUI

// MARK: - PhotoCarousel

/// Swipeable image gallery with page-indicator dots.
///
/// Automatically adapts to the number of provided photo URLs:
/// - 0 URLs: Placeholder (camera icon on gray background)
/// - 1 URL:  Single image, no dots
/// - 2+ URLs: Swipeable `TabView` with page dots below
struct PhotoCarousel: View {

    // MARK: - Inputs

    /// Remote URL strings for each photo. Order is preserved.
    let photoURLs: [String]

    /// Corner radius applied to the carousel frame. Defaults to 0 (full bleed).
    var cornerRadius: CGFloat = 0

    /// Aspect ratio of the carousel. Defaults to 4:3.
    var aspectRatio: CGFloat = 4 / 3

    // MARK: - State

    @State private var currentIndex: Int = 0

    // MARK: - Body

    var body: some View {
        VStack(spacing: Theme.Spacing.sm) {
            photoContent
                .aspectRatio(aspectRatio, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))

            if photoURLs.count > 1 {
                pageIndicator
            }
        }
        .accessibilityLabel(accessibilityLabel)
    }

    // MARK: - Photo Content

    @ViewBuilder
    private var photoContent: some View {
        if photoURLs.isEmpty {
            placeholderView
        } else if photoURLs.count == 1 {
            CachedAsyncImage(urlString: photoURLs[0], cornerRadius: 0)
        } else {
            swipeableGallery
        }
    }

    private var placeholderView: some View {
        ZStack {
            Theme.Colors.textSecondary.opacity(0.12)
            VStack(spacing: Theme.Spacing.sm) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(Theme.Colors.textSecondary.opacity(0.4))
                Text("No photos yet")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
    }

    private var swipeableGallery: some View {
        TabView(selection: $currentIndex) {
            ForEach(Array(photoURLs.enumerated()), id: \.offset) { index, url in
                CachedAsyncImage(urlString: url, cornerRadius: 0)
                    .tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .animation(.easeInOut, value: currentIndex)
    }

    // MARK: - Page Indicator

    private var pageIndicator: some View {
        HStack(spacing: Theme.Spacing.xs) {
            ForEach(0..<photoURLs.count, id: \.self) { index in
                Circle()
                    .fill(index == currentIndex
                          ? Theme.Colors.primary
                          : Theme.Colors.textSecondary.opacity(0.3))
                    .frame(width: 7, height: 7)
                    .animation(.easeInOut(duration: 0.2), value: currentIndex)
            }
        }
        .accessibilityHidden(true)
    }

    // MARK: - Accessibility

    private var accessibilityLabel: String {
        switch photoURLs.count {
        case 0:  return "No photos available"
        case 1:  return "Photo"
        default: return "Photo \(currentIndex + 1) of \(photoURLs.count)"
        }
    }
}

// MARK: - Preview

#Preview("PhotoCarousel — 0 photos") {
    PhotoCarousel(photoURLs: [], cornerRadius: Theme.CornerRadius.md)
        .padding()
}

#Preview("PhotoCarousel — 1 photo") {
    PhotoCarousel(
        photoURLs: ["https://picsum.photos/seed/dog1/400/300"],
        cornerRadius: Theme.CornerRadius.md
    )
    .padding()
}

#Preview("PhotoCarousel — many photos") {
    PhotoCarousel(
        photoURLs: [
            "https://picsum.photos/seed/dog1/400/300",
            "https://picsum.photos/seed/dog2/400/300",
            "https://picsum.photos/seed/dog3/400/300"
        ],
        cornerRadius: Theme.CornerRadius.md
    )
    .padding()
}
