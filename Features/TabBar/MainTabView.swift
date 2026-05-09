//
//  MainTabView.swift
//  SwapDog
//
//  Root tab bar shell for authenticated users.
//  Houses 4 tabs: Discover, Requests, Messages, Profile.
//
//  Architecture layer: Features/TabBar
//  Pattern: outer MainTabView reads @EnvironmentObject and passes deps to
//           inner MainTabShell which safely owns @StateObject ViewModels.
//  Locked decisions:
//    - Badges on Messages (unread count) and Requests (pending count)
//    - All interactive elements have VoiceOver accessibility labels
//    - Tap targets >= 44×44 pt
//    - Step 9: MessagesStubView replaced with ConversationsListView
//

import SwiftUI

// MARK: - Tab

/// Represents one of the four root tabs in the authenticated app shell.
enum MainTab: Int, CaseIterable {
    case discover
    case requests
    case messages
    case profile

    var title: String {
        switch self {
        case .discover:  return "Discover"
        case .requests:  return "Requests"
        case .messages:  return "Messages"
        case .profile:   return "Profile"
        }
    }

    var icon: String {
        switch self {
        case .discover:  return "pawprint.fill"
        case .requests:  return "arrow.2.squarepath"
        case .messages:  return "bubble.left.and.bubble.right.fill"
        case .profile:   return "person.circle.fill"
        }
    }

    var accessibilityHint: String {
        switch self {
        case .discover:  return "Discover nearby dog owners"
        case .requests:  return "Swap requests"
        case .messages:  return "Messages"
        case .profile:   return "My profile"
        }
    }
}

// MARK: - MainTabView (Environment reader)

/// Reads DependencyContainer from the environment and wires dependencies into
/// the inner `MainTabShell`, which safely owns `@StateObject` ViewModels.
///
/// Split into two types to avoid the SwiftUI restriction that `@StateObject`
/// cannot be initialised using values from `@EnvironmentObject` in the same view.
struct MainTabView: View {

    @EnvironmentObject private var container: DependencyContainer
    @EnvironmentObject private var coordinator: AppCoordinator

    var body: some View {
        MainTabShell(
            userRepository:      container.userRepository,
            dogRepository:       container.dogRepository,
            locationService:     container.locationService,
            swapRepository:      container.swapRepository,
            messagingRepository: container.messagingRepository,
            authRepository:      container.authRepository
        )
    }
}

// MARK: - MainTabShell (@StateObject owner)

/// Owns all tab-level `@StateObject` ViewModels.
/// Only created once — SwiftUI ignores subsequent init parameter changes.
private struct MainTabShell: View {

    // MARK: - ViewModels

    @StateObject private var discoveryViewModel:     DiscoveryViewModel
    @StateObject private var conversationsViewModel: ConversationsViewModel
    @StateObject private var tabViewModel = MainTabViewModel()

    // MARK: - State

    @State private var selectedTab: MainTab = .discover

    // MARK: - Init

    init(
        userRepository:      any UserRepositoryProtocol,
        dogRepository:       any DogRepositoryProtocol,
        locationService:     any LocationServiceProtocol,
        swapRepository:      any SwapRepositoryProtocol,
        messagingRepository: any MessagingRepositoryProtocol,
        authRepository:      any AuthRepositoryProtocol
    ) {
        _discoveryViewModel = StateObject(wrappedValue: DiscoveryViewModel(
            userRepository:  userRepository,
            dogRepository:   dogRepository,
            locationService: locationService
        ))

        _conversationsViewModel = StateObject(wrappedValue: ConversationsViewModel(
            messagingRepository: messagingRepository,
            userRepository:      userRepository,
            currentUserID:       authRepository.currentUserID
        ))

        // Store refs needed for chatview navigation.
        self._messagingRepository = messagingRepository
        self._currentUserID       = authRepository.currentUserID
    }

    // MARK: - Stored Refs

    private let _messagingRepository: any MessagingRepositoryProtocol
    private let _currentUserID:       String?

    // MARK: - Body

    var body: some View {
        TabView(selection: $selectedTab) {
            discoverTab
            requestsTab
            messagesTab
            profileTab
        }
        .tint(Theme.Colors.primary)
        .onAppear { configureTabBarAppearance() }
        // Keep Messages badge in sync with the conversations VM.
        .onChange(of: conversationsViewModel.totalUnreadCount) { _, count in
            tabViewModel.setUnreadMessageCount(count)
        }
    }

    // MARK: - Tabs

    private var discoverTab: some View {
        DiscoveryView(viewModel: discoveryViewModel)
            .tabItem {
                Label(MainTab.discover.title, systemImage: MainTab.discover.icon)
            }
            .tag(MainTab.discover)
            .accessibilityLabel(MainTab.discover.accessibilityHint)
    }

    private var requestsTab: some View {
        RequestsStubView()
            .tabItem {
                Label(MainTab.requests.title, systemImage: MainTab.requests.icon)
            }
            .badge(tabViewModel.pendingRequestCount)
            .tag(MainTab.requests)
            .accessibilityLabel(
                tabViewModel.pendingRequestCount > 0
                    ? "\(MainTab.requests.accessibilityHint), \(tabViewModel.pendingRequestCount) pending"
                    : MainTab.requests.accessibilityHint
            )
    }

    private var messagesTab: some View {
        ConversationsListView(
            viewModel:           conversationsViewModel,
            currentUserID:       _currentUserID ?? "",
            messagingRepository: _messagingRepository
        )
        .tabItem {
            Label(MainTab.messages.title, systemImage: MainTab.messages.icon)
        }
        .badge(tabViewModel.unreadMessageCount)
        .tag(MainTab.messages)
        .accessibilityLabel(
            tabViewModel.unreadMessageCount > 0
                ? "\(MainTab.messages.accessibilityHint), \(tabViewModel.unreadMessageCount) unread"
                : MainTab.messages.accessibilityHint
        )
    }

    private var profileTab: some View {
        ProfileStubView()
            .tabItem {
                Label(MainTab.profile.title, systemImage: MainTab.profile.icon)
            }
            .tag(MainTab.profile)
            .accessibilityLabel(MainTab.profile.accessibilityHint)
    }

    // MARK: - Appearance

    private func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Theme.Colors.surface)
        UITabBar.appearance().standardAppearance  = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}

// MARK: - MainTabViewModel

/// Drives badge counts on the tab bar items.
@MainActor
final class MainTabViewModel: ObservableObject {

    /// Pending swap-request count shown as a badge on the Requests tab.
    @Published private(set) var pendingRequestCount: Int = 0

    /// Unread message count shown as a badge on the Messages tab.
    @Published private(set) var unreadMessageCount: Int = 0

    /// Called by `MainTabShell.onChange` whenever `ConversationsViewModel.totalUnreadCount` changes.
    func setUnreadMessageCount(_ count: Int) {
        unreadMessageCount = count
    }
}

// MARK: - Stub Views (replaced in later steps)

/// Placeholder for the Swap Requests screen (Step 8).
private struct RequestsStubView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: Theme.Spacing.md) {
                Image(systemName: "arrow.2.squarepath")
                    .font(.system(size: 56, weight: .thin))
                    .foregroundStyle(Theme.Colors.primary.opacity(0.5))
                    .accessibilityHidden(true)
                Text("Swap Requests")
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text("Coming in Step 8")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            .navigationTitle("Requests")
            .navigationBarTitleDisplayMode(.large)
            .screenBackground()
        }
    }
}

/// Placeholder for the Profile screen (Step 10).
private struct ProfileStubView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: Theme.Spacing.md) {
                Image(systemName: "person.circle")
                    .font(.system(size: 56, weight: .thin))
                    .foregroundStyle(Theme.Colors.primary.opacity(0.5))
                    .accessibilityHidden(true)
                Text("Profile")
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text("Coming in Step 10")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .screenBackground()
        }
    }
}

// MARK: - Preview

#Preview {
    MainTabView()
        .environmentObject(AppCoordinator())
        .environmentObject(DependencyContainer.preview)
}
