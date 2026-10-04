import CoreLocation
import Foundation
import WebKit

/// WKWebView nu implementează Geolocation API (spre deosebire de WebView-ul Android).
/// Fără acest bridge, harta, distanțele și onboarding-ul de locație ar eșua silențios.
/// Flux: JS `navigator.geolocation` → `postMessage` → CoreLocation → callback în JS.
final class GeolocationBridge: NSObject, CLLocationManagerDelegate, WKScriptMessageHandler {
    static let handlerName = "diebelGeo"

    private let manager = CLLocationManager()
    private weak var webView: WKWebView?

    /// Cereri `getCurrentPosition` în așteptare.
    private var pendingOneShot: [Int] = []
    /// Id-uri `watchPosition` active.
    private var watchers: Set<Int> = []

    init(webView: WKWebView) {
        self.webView = webView
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.handlerName,
              let body = message.body as? [String: Any],
              let action = body["action"] as? String
        else { return }

        let id = (body["id"] as? Int) ?? 0

        switch action {
        case "getCurrentPosition":
            pendingOneShot.append(id)
            requestLocation()
        case "watchPosition":
            watchers.insert(id)
            requestLocation()
        case "clearWatch":
            watchers.remove(id)
            if watchers.isEmpty { manager.stopUpdatingLocation() }
        default:
            break
        }
    }

    // MARK: - CoreLocation

    private func requestLocation() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            failPending(code: 1, message: "Permisiunea pentru locație este dezactivată.")
        default:
            manager.requestLocation()
            if !watchers.isEmpty { manager.startUpdatingLocation() }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
            if !watchers.isEmpty { manager.startUpdatingLocation() }
        case .denied, .restricted:
            failPending(code: 1, message: "Permisiunea pentru locație este dezactivată.")
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let payload: [String: Any] = [
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "accuracy": max(location.horizontalAccuracy, 0),
            "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
        ]
        let oneShot = pendingOneShot
        pendingOneShot.removeAll()
        for id in oneShot { emit(id: id, ok: true, payload: payload) }
        for id in watchers { emit(id: id, ok: true, payload: payload) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        failPending(code: 2, message: "Poziția nu este disponibilă.")
    }

    private func failPending(code: Int, message: String) {
        let payload: [String: Any] = ["code": code, "message": message]
        let oneShot = pendingOneShot
        pendingOneShot.removeAll()
        for id in oneShot { emit(id: id, ok: false, payload: payload) }
        for id in watchers { emit(id: id, ok: false, payload: payload) }
    }

    private func emit(id: Int, ok: Bool, payload: [String: Any]) {
        guard let webView,
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8)
        else { return }
        let script = "window.__diebelGeoResolve && window.__diebelGeoResolve(\(id), \(ok), \(json));"
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script, completionHandler: nil)
        }
    }
}
