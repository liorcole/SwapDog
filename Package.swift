// swift-tools-version: 5.9
//
//  Package.swift
//  SwapDog
//
//  Swift Package Manager manifest.
//  This defines the SwapDog module and test target so the scaffold
//  can be compiled with `swift build` and tested with `swift test`
//  independently of Xcode.
//
//  Firebase dependencies (FirebaseAuth, FirebaseFirestore, etc.) are
//  added when Firebase is integrated in Step 3.

import PackageDescription

let package = Package(
    name: "SwapDog",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)   // enables `swift build` on macOS for CI
    ],
    products: [
        .library(name: "SwapDog", targets: ["SwapDog"])
    ],
    dependencies: [
        // Step 3: add Firebase iOS SDK here
        // .package(url: "https://github.com/firebase/firebase-ios-sdk", from: "10.0.0"),
    ],
    targets: [
        .target(
            name: "SwapDog",
            path: ".",
            exclude: [
                "Tests",
                "Resources/Assets.xcassets",
                "Package.swift",
                "README.md"
            ],
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency")
            ]
        ),
        .testTarget(
            name: "SwapDogTests",
            dependencies: ["SwapDog"],
            path: "Tests"
        )
    ]
)
