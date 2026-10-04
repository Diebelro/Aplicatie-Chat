import Foundation

/// Configurație shell iOS — aceleași adrese ca aplicația Android (`align-android`).
enum AppConfig {
    static let webHost = "chat.diebel.ro"
    static let baseURL = URL(string: "https://chat.diebel.ro")!

    /// Trebuie să coincidă cu `align-app/lib/uiBuildVersion.ts`.
    static let uiBuild = "77"

    static var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
    }

    static var buildNumber: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
    }

    /// Sufix UA: serverul relaxează filtrele pentru shell-uri native (vezi `/api/profiles`).
    /// Păstrăm și tokenul `Mobile`, altfel `applicationNameForUserAgent` îl elimină din UA
    /// și bibliotecile care detectează mobilul (hărți, WebRTC) se pot comporta ca pe desktop.
    static var userAgentSuffix: String { "Mobile/15E148 DiebelIOS/\(appVersion)" }

    /// Ecran de start, identic cu Android: `/app` + cache-busting pe versiunea UI.
    static func homeURL() -> URL {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("app"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "shell", value: buildNumber),
            URLQueryItem(name: "ui", value: uiBuild),
            URLQueryItem(name: "_", value: String(Int(Date().timeIntervalSince1970 * 1000))),
        ]
        return components.url ?? baseURL
    }

    static func callURL(roomId: String, audioOnly: Bool = false) -> URL {
        var components = URLComponents(
            url: baseURL
                .appendingPathComponent("app")
                .appendingPathComponent("call")
                .appendingPathComponent(roomId),
            resolvingAgainstBaseURL: false
        )!
        var items = [URLQueryItem(name: "from", value: "push")]
        if audioOnly {
            items.append(URLQueryItem(name: "audio", value: "1"))
        }
        components.queryItems = items
        return components.url
            ?? baseURL.appendingPathComponent("app").appendingPathComponent("call").appendingPathComponent(roomId)
    }

    /// În aplicație rămân doar `chat.diebel.ro` și furnizorii OAuth folosiți la login.
    static func isAllowedInApp(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http" else { return false }
        guard let host = url.host?.lowercased() else { return false }
        if isBlockedStoreLink(url) { return false }
        if host == webHost { return true }
        let oauthDomains = [
            "google.com",
            "apple.com",
            "microsoftonline.com",
            "live.com",
            "facebook.com",
            "yahoo.com",
        ]
        return oauthDomains.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    /// Apple interzice trimiterea către alte magazine de aplicații.
    static func isBlockedStoreLink(_ url: URL) -> Bool {
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "market" || scheme == "itms-apps" || scheme == "itms-appss" { return true }
        guard let host = url.host?.lowercased() else { return false }
        return host == "play.google.com" || host.hasSuffix(".play.google.com")
    }

    static func isCallURL(_ url: URL?) -> Bool {
        guard let path = url?.path.lowercased() else { return false }
        return path.hasPrefix("/app/call")
    }
}
