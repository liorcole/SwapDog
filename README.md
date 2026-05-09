# SwapDog 🐾

Peer-to-peer dog-sitting exchange — find nearby owners, propose swaps, chat, and leave reviews.

---

## Opening in Xcode

There are **two ways** to set up the Xcode project.  
**Option A (recommended)** uses XcodeGen to generate the `.xcodeproj` automatically from `project.yml`.  
**Option B** walks you through creating it manually in Xcode.

---

## Option A — XcodeGen (recommended, ~2 minutes)

### 1. Install XcodeGen

```bash
brew install xcodegen
```

> Requires [Homebrew](https://brew.sh). Install it first if you don't have it.

### 2. Generate the Xcode project

```bash
cd /path/to/SwapDog
xcodegen generate
```

XcodeGen reads `project.yml` and writes `SwapDog.xcodeproj` in the repo root.

### 3. Open in Xcode

```bash
open SwapDog.xcodeproj
```

### 4. Add `GoogleService-Info.plist`

- Drag your `GoogleService-Info.plist` (downloaded from the Firebase console) into the **SwapDog** group in the Xcode Project Navigator.
- When prompted, make sure **"Add to target: SwapDog"** is checked.

### 5. Set your Team

- In Xcode, select the **SwapDog** project in the Navigator.
- Go to **Signing & Capabilities** → set your **Team** to your Apple developer account.

### 6. Select a simulator and run

- Choose **iPhone 15** (or any iOS 17+ device) from the scheme dropdown.
- Press **⌘R**.

> **Re-generating after adding files:** Any time you add or remove Swift files, run `xcodegen generate` again to keep the `.xcodeproj` in sync. The `.xcodeproj` itself is git-ignored so the generated file is never stale in source control.

---

## Option B — Manual Xcode Setup (~10 minutes)

If you prefer not to install XcodeGen, follow these steps entirely inside Xcode.

### 1. Create a new iOS App project

1. Open **Xcode** → **File → New → Project**.
2. Select **iOS → App** → click **Next**.
3. Fill in:
   | Field | Value |
   |---|---|
   | Product Name | `SwapDog` |
   | Bundle Identifier | `com.ari.SwapDog` |
   | Interface | SwiftUI |
   | Language | Swift |
4. Choose the **repo root** (`SwapDog/`) as the save location — **uncheck "Create Git repository"** (we already have one).
5. Click **Create**.

### 2. Delete the auto-generated stub files

Xcode creates placeholder files you don't need. In the Project Navigator:

- Delete **`ContentView.swift`**
- Delete **`SwapDogApp.swift`** (the auto-generated one — your real entry point is `App/SwapDogApp.swift`)

When prompted, choose **"Move to Trash"** for both.

### 3. Add all source folders

1. In the Project Navigator, right-click the **SwapDog** group → **"Add Files to 'SwapDog'…"**
2. Select all of these folders (hold ⌘ to multi-select):
   - `App/`
   - `Core/`
   - `DesignSystem/`
   - `Features/`
   - `Mocks/`
   - `Resources/`
3. Options to set:
   - ✅ **Create groups** (not folder references)
   - ✅ **Add to targets: SwapDog**
   - ☐ Copy items if needed ← leave **unchecked** (files are already in the right place)
4. Click **Add**.

### 4. Set the Info.plist

1. Select the **SwapDog** project in the Navigator → select the **SwapDog** target → **Build Settings** tab.
2. Search for **`INFOPLIST_FILE`** and set it to `SwapDog/Info.plist`.

### 5. Add Firebase via Swift Package Manager

1. In Xcode: **File → Add Package Dependencies…**
2. Paste the URL: `https://github.com/firebase/firebase-ios-sdk`
3. Set version rule: **Up to Next Major** from `10.0.0`.
4. Click **Add Package**.
5. In the package product selector, check:
   - ✅ `FirebaseAuth`
   - ✅ `FirebaseFirestore`
   - ✅ `FirebaseStorage`
   - ✅ `FirebaseMessaging`
6. Click **Add Package**.

### 6. Add `GoogleService-Info.plist`

- Drag `GoogleService-Info.plist` (from your Firebase console) into the **SwapDog** group.
- ✅ **"Add to target: SwapDog"** must be checked.

### 7. Configure Signing

- **Signing & Capabilities** tab → set **Team** to your Apple developer account.

### 8. Add the test target

1. **File → New → Target → Unit Testing Bundle**.
2. Name it `SwapDogTests`, set **Target to be Tested** to `SwapDog`.
3. Delete the auto-generated `SwapDogTests.swift` file Xcode creates.
4. Add files: **Add Files to 'SwapDog'…** → select `Tests/UnitTests/` → Add to **SwapDogTests** target.

### 9. Select a simulator and run

- Choose **iPhone 15** (iOS 17+) from the scheme dropdown.
- Press **⌘R**.

---

## Project structure

```
SwapDog/
├── App/                     # App entry point, coordinator, DI container
├── Core/
│   ├── Extensions/          # Swift extension helpers
│   ├── Models/              # Domain models (Dog, User, SwapRequest, …)
│   ├── Repositories/        # Firebase repository implementations + protocols
│   ├── Services/            # Location, notifications, analytics, validation
│   └── Utilities/           # Constants, error types, Firestore paths
├── DesignSystem/
│   ├── Components/          # Reusable SwiftUI views
│   ├── Modifiers/           # View modifiers (shimmer, etc.)
│   └── Theme.swift          # Colors, typography, spacing tokens
├── Features/
│   ├── Auth/                # Sign-in / sign-up
│   ├── Booking/             # Swap requests, review flow
│   ├── Discovery/           # Browse & filter nearby owners
│   ├── DogProfile/          # Dog detail view
│   ├── Messaging/           # Conversations & chat
│   ├── Onboarding/          # Multi-step onboarding flow
│   ├── Profile/             # User profile & settings
│   └── TabBar/              # Main tab container
├── Mocks/                   # In-memory fakes for unit tests & previews
├── Resources/
│   └── Assets.xcassets      # App icon, accent colour
├── Tests/
│   └── UnitTests/           # XCTest unit tests
├── Info.plist               # App metadata & permission strings
├── project.yml              # XcodeGen project definition
├── Package.swift            # SPM manifest (CI / swift build)
└── firestore.rules          # Firestore security rules
```

---

## Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Add an **iOS app** with bundle ID `com.ari.SwapDog`.
3. Download `GoogleService-Info.plist` and add it to the Xcode project (see steps above).
4. Enable **Authentication** (Email/Password + Apple Sign-In).
5. Enable **Cloud Firestore** (start in test mode, then apply `firestore.rules`).
6. Enable **Storage** and **Cloud Messaging**.

---

## Requirements

| Tool | Minimum version |
|---|---|
| Xcode | 15.2 |
| iOS Deployment Target | 17.0 |
| Swift | 5.9 |
| XcodeGen (Option A only) | 2.39 |
