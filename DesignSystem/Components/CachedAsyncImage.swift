//
//  CachedAsyncImage.swift
//  SwapDog
//
//  A lightweight async image loader with NSCache-based caching.
//  Replaces the placeholder stub that contained no declarations.
//
//  Architecture layer: DesignSystem/Components
//  Locked decisions:
//    - Uses NSCache for in-memory image caching (no disk cache)
//    - Renders a shimmer placeholder while loading
//    - cornerRadius and size are configurable at the call site
//

import SwiftUI

// MARK: - ImageCache

/// Shared in-memory NSCache for downloaded images.
private final class ImageCache: @unchecked Sendable {
    static let shared = ImageCache()
    private let cache = NSCache<NSString, UIImage>()

    private init() {
        cache.countLimit = 100
        cache.totalCostLimit = 50 * 1024 * 1024 // 50 MB
    }

    func image(for url: String) -> UIImage? {
        cache.object(forKey: url as NSString)
    }

    func setImage(_ image: UIImage, for url: String) {
        cache.setObject(image, forKey: url as NSString)
    }
}

// MARK: - CachedAsyncImage

/// An async image view that caches results in memory.
///
/// Usage:
/// ```swift
/// CachedAsyncImage(
///     urlString: user.profileImageURL,
///     cornerRadius: Theme.CornerRadius.pill,
///     size: CGSize(width: 104, height: 104)
/// )
/// ```
struct CachedAsyncImage: View {

    // MARK: - Configuration

    /// Remote URL string for the image. Nil or empty shows a placeholder.
    let urlString: String?

    /// Corner radius applied to the rendered image and placeholder.
    var cornerRadius: CGFloat = 0

    /// Explicit size for the rendered image. Used to size the placeholder correctly.
    var size: CGSize = CGSize(width: 80, height: 80)

    // MARK: - State

    @State private var uiImage: UIImage?
    @State private var isLoading = false
    @State private var hasFailed = false

    // MARK: - Body

    var body: some View {
        Group {
            if let image = uiImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: size.width, height: size.height)
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            } else if hasFailed {
                placeholder(systemName: "photo.slash")
            } else {
                placeholder(systemName: "photo")
                    .shimmer(active: isLoading)
            }
        }
        .task(id: urlString) {
            await loadImage()
        }
    }

    // MARK: - Private

    @ViewBuilder
    private func placeholder(systemName: String) -> some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(Theme.Colors.shimmerBase)
            .frame(width: size.width, height: size.height)
            .overlay {
                Image(systemName: systemName)
                    .font(.system(size: min(size.width, size.height) * 0.3))
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
    }

    private func loadImage() async {
        guard let urlString = urlString, !urlString.isEmpty else { return }

        // Cache hit — no network needed.
        if let cached = ImageCache.shared.image(for: urlString) {
            uiImage = cached
            return
        }

        guard let url = URL(string: urlString) else {
            hasFailed = true
            return
        }

        isLoading = true
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let image = UIImage(data: data) {
                ImageCache.shared.setImage(image, for: urlString)
                uiImage = image
            } else {
                hasFailed = true
            }
        } catch {
            hasFailed = true
        }
        isLoading = false
    }
}

// MARK: - Preview

#Preview("CachedAsyncImage") {
    VStack(spacing: Theme.Spacing.md) {
        CachedAsyncImage(
            urlString: nil,
            cornerRadius: Theme.CornerRadius.pill,
            size: CGSize(width: 104, height: 104)
        )
        CachedAsyncImage(
            urlString: "https://invalid.example.com/missing.jpg",
            cornerRadius: Theme.CornerRadius.md,
            size: CGSize(width: 120, height: 100)
        )
    }
    .padding()
}
