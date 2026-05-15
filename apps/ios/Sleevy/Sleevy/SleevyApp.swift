//
//  SleevyApp.swift
//  Sleevy
//
//  Created by Onno Klein Hofmeijer on 01/05/2026.
//

import SwiftUI
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

@main
struct SleevyApp: App {
    @StateObject private var authStore = AuthStore()
    @StateObject private var appSettings = AppSettings()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authStore)
                .environmentObject(appSettings)
                .preferredColorScheme(appSettings.preferredColorScheme)
                .onOpenURL { url in
#if canImport(GoogleSignIn)
                    GIDSignIn.sharedInstance.handle(url)
#endif
                }
                .task {
                    await authStore.restoreSession()
                }
        }
    }
}
