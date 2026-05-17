# 🐾 SwapDog

**Peer-to-peer dog-sitting exchange** — swap dog-sitting duties with trusted owners in your neighborhood. No money changes hands; it's all about community trust.

---

## Features

- 🔐 **Auth** — Email/password sign-up & sign-in via Firebase Auth
- 🐕 **Dog Profiles** — Add multiple dogs with photos, breed, age, size, energy level, and traits
- 🗺️ **Discovery** — Browse nearby dog owners filtered by location
- 🔄 **Swap Requests** — Create, accept, decline, cancel, and complete swap requests
- 💬 **Real-time Messaging** — Firestore-powered chat between swap participants
- ⭐ **Reviews** — Leave immutable star ratings after completed swaps
- 🌙 **Dark Mode** — System-aware with manual toggle; preference persisted in AsyncStorage
- 🔔 **Push Notifications** — Expo Notifications with deep-link response handling
- 🔗 **Deep Linking** — `swapdog://` scheme routes to swap, chat, user, and dog screens
- ♿ **Accessibility** — `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` on all interactive elements

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript (strict mode) |
| Navigation | React Navigation v7 (stack + bottom tabs) |
| Backend | Firebase (Auth, Firestore, Storage) |
| Notifications | expo-notifications |
| Location | expo-location |
| Images | expo-image-picker |
| Animations | React Native Animated API + expo-haptics |
| Storage | @react-native-async-storage/async-storage |

---

## Prerequisites

- **Node.js** 18+ and npm 9+
- **Expo CLI**: `npm install -g expo-cli`
- **Expo Go** app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- A **Firebase** project (free Spark plan works)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/liorcole/SwapDog.git
cd SwapDog
git checkout react-native
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) → create a project (or use existing)
2. Add a **Web app** to your project
3. Copy the config object and paste into `src/config/firebase.ts`:

```ts
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

4. Enable **Email/Password** in Firebase Auth → Sign-in methods
5. Create a **Firestore database** (start in test mode, then deploy `firestore.rules`)
6. Enable **Storage** (optional, for photo uploads)

### 4. Deploy Firestore security rules

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules
```

---

## Running with Expo Go

```bash
npx expo start
```

Scan the QR code with:
- **iOS**: Camera app
- **Android**: Expo Go app

The app will load over your local network. Make sure your phone and computer are on the same Wi-Fi.

---

## Project Structure

```
SwapDog-RN/
├── App.tsx                    # Root: SafeAreaProvider → ThemeProvider → AuthProvider → Navigation
├── firestore.rules            # Firestore security rules
├── src/
│   ├── config/
│   │   ├── firebase.ts        # Firebase SDK init
│   │   ├── theme.ts           # Design tokens (colors, spacing, typography)
│   │   └── linking.ts         # Deep link configuration
│   ├── models/
│   │   └── types.ts           # All TypeScript interfaces and enums
│   ├── contexts/
│   │   ├── AuthContext.tsx    # Firebase auth state + user profile
│   │   └── ThemeContext.tsx   # Dark/light mode with AsyncStorage persistence
│   ├── hooks/
│   │   ├── useAuth.ts         # signUp / signIn / signOut
│   │   ├── useUsers.ts        # Firestore user CRUD + location query
│   │   ├── useDogs.ts         # Firestore dog CRUD
│   │   ├── useSwaps.ts        # Swap request lifecycle
│   │   ├── useMessaging.ts    # Real-time Firestore messages
│   │   └── useReviews.ts      # Review creation + fetch
│   ├── services/
│   │   └── NotificationService.ts  # Expo push token registration + scheduling
│   ├── navigation/
│   │   ├── types.ts           # Typed param lists for all stacks
│   │   ├── AppNavigator.tsx   # Root navigator (auth gate)
│   │   ├── AuthNavigator.tsx  # Splash → SignIn → SignUp
│   │   ├── OnboardingNavigator.tsx
│   │   └── MainTabNavigator.tsx  # 4 tabs with nested stacks
│   ├── components/common/     # Reusable UI components
│   │   ├── LoadingSpinner
│   │   ├── CachedImage
│   │   ├── StarRating
│   │   ├── Chip
│   │   ├── PhotoCarousel
│   │   ├── EmptyStateView
│   │   ├── ErrorView
│   │   ├── ShimmerLoading
│   │   └── MessageBubble
│   ├── screens/
│   │   ├── auth/              # Splash, SignIn, SignUp
│   │   ├── onboarding/        # ProfileSetup, AddDog, LocationSetup
│   │   ├── discover/          # Discover, UserDetail, DogDetail
│   │   ├── booking/           # CreateSwap, WriteReview
│   │   ├── requests/          # RequestsScreen
│   │   ├── messages/          # ConversationsList, Chat
│   │   └── profile/           # Profile, EditProfile, EditDog
│   └── utils/
│       ├── firestoreConverters.ts  # Timestamp ↔ Date helpers
│       └── animations.ts           # Reusable animation configs
```

---

## Firebase Setup Guide

### Firestore Indexes

For production, create composite indexes for:
- `swapRequests` — `requesterId` + `createdAt` (desc)
- `swapRequests` — `receiverId` + `createdAt` (desc)
- `conversations` — `participantIds` (array-contains) + `updatedAt` (desc)

### Push Notifications (Expo)

For production push notifications, you need an **EAS project ID**:
1. `npm install -g eas-cli`
2. `eas login`
3. `eas build:configure` — this generates a project ID
4. Add it to `app.json` under `expo.extra.eas.projectId`

---

## Deep Linking

The app responds to `swapdog://` URLs:

| URL | Screen |
|-----|--------|
| `swapdog://discover` | Discover feed |
| `swapdog://user/:userId` | User detail |
| `swapdog://dog/:dogId` | Dog detail |
| `swapdog://chat/:conversationId` | Chat |
| `swapdog://requests` | Swap requests |

---

## License

MIT
