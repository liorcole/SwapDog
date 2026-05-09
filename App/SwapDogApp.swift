//
//  SwapDogApp.swift
//  SwapDog
//
//  App entry point. Owns AppCoordinator and DependencyContainer, sets up
//  the UNUserNotificationCenter delegate for notification tap handling,
//  and triggers non-blocking permission request after successful auth.
//
//  Step 12: Added notification permission request, APNs registration,
//           UNUserNotificationCenterDelegate wiring, and deep-link routing.
//
//  Architecture note: notification setup lives in AppDelegate-equivalent
//  init() + scene methods to keep SwiftUI body < 40 lines.
//

import SwiftUI
import UserNotifications

@main
struct SwapDogApp: App {

    // MARK: - Root Dependencies

    /// Drives top-level navigation, auth-state transitions, and deep linking.
    @StateObject private var coordinator = AppCoordinator()

    /// Holds all repository and service instances for injection.
    @StateObject private var container = DependencyContainer()

    // MARK: - Notification Delegate

    /// Bridges UIKit notification callbacks into the SwiftUI lifecycle.
    @StateObject private var notificationDelegate = NotificationCenterDelegate()

    // MARK: - Init

    init() {
        FirebaseConfig.configure()
    }

    // MARK: - Scene

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(coordinator)
                .environmentObject(container)
                // Forward notification taps to AppCoordinator via the delegate.
                .onReceive(notificationDelegate.deepLinkPublisher) { deepLink in
                    coordinator.navigate(to: deepLink)
                }
                .task {
                    // Set the UNUserNotificationCenter delegate once on launch.
                    UNUserNotificationCenter.current().delegate = notificationDelegate
                }
        }
    }
}

// MARK: - RootView

/// Switches between app shells based on `AppCoordinator.authState`.
private struct RootView: View {

    @EnvironmentObject private var coordinator: AppCoordinator
    @EnvironmentObject private var container: DependencyContainer

    var body: some View {
        Group {
            switch coordinator.authState {
            case .loggedOut:
                AuthView(
                    viewModel: AuthViewModel(
                        authRepository: container.authRepository,
                        coordinator:    coordinator
                    )
                )

            case .onboarding:
                Text("SwapDog — Onboarding")
                    .font(Theme.Typography.title)
                    .foregroundStyle(Theme.Colors.textPrimary)

            case .authenticated:
                MainTabView()
                    .onAppear {
                        // Request permission once; non-blocking fire-and-forget.
                        Task {
                            let granted = await container.notificationService.requestPermission()
                            if granted {
                                await container.notificationService.registerForRemoteNotifications()
                            }
                        }
                        // Drain any pending deep link buffered during cold launch.
                        coordinator.consumePendingDeepLink()
                    }
            }
        }
        .animation(.easeInOut(duration: AppConstants.defaultAnimationDuration),
                   value: coordinator.authState)
    }
}

// MARK: - NotificationCenterDelegate

/// `UNUserNotificationCenterDelegate` implementation that converts notification
/// taps into typed `DeepLink` values and publishes them to the SwiftUI scene.
///
/// Kept separate from `SwapDogApp` to avoid making the App struct a reference type.
@MainActor
final class NotificationCenterDelegate: NSObject, ObservableObject, UNUserNotificationCenterDelegate,
                                        @unchecked Sendable {

    // MARK: - Publisher

    /// Emits a `DeepLink` whenever the user taps a push notification.
    private let deepLinkSubject = PassthroughSubjectBox<DeepLink>()

    /// Public publisher that the SwiftUI scene subscribes to via `.onReceive`.
    var deepLinkPublisher: AnyPublisher<DeepLink, Never> { deepLinkSubject.eraseToAnyPublisher() }

    // MARK: - UNUserNotificationCenterDelegate

    /// Called when the user taps a notification while the app is in the foreground or background.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let parser = FirebaseNotificationService()
        if let deepLink = parser.handleIncomingNotification(userInfo: userInfo) {
            Task { @MainActor in
                self.deepLinkSubject.send(deepLink)
            }
        }
        completionHandler()
    }

    /// Called when a notification arrives while the app is in the foreground.
    /// Returns `.banner + .sound + .badge` so the notification is still visible.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }
}

// MARK: - PassthroughSubjectBox

/// Sendable wrapper around `PassthroughSubject` to bridge Combine into @MainActor code.
///
/// `PassthroughSubject` itself is not `Sendable`; wrapping in a final class marked
/// `@unchecked Sendable` is the standard workaround when the class is always used
/// on the main actor.
import Combine

@MainActor
private final class PassthroughSubjectBox<Output>: @unchecked Sendable {
    private let subject = PassthroughSubject<Output, Never>()

    func send(_ value: Output) { subject.send(value) }
    func eraseToAnyPublisher() -> AnyPublisher<Output, Never> { subject.eraseToAnyPublisher() }
}
