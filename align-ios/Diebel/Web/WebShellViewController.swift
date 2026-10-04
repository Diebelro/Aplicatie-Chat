import UIKit
import WebKit

/// Shell-ul aplicației: încarcă `chat.diebel.ro/app` într-un WKWebView, cu aceleași
/// comportamente ca aplicația Android (allowlist domenii, permisiuni cameră/microfon,
/// upload fișiere, ecran de eroare cu reîncercare) plus geolocație nativă și CallKit.
final class WebShellViewController: UIViewController {

    private var webView: WKWebView!
    private var geolocationBridge: GeolocationBridge!
    private var progressObservation: NSKeyValueObservation?

    private let progressBar = UIProgressView(progressViewStyle: .bar)
    private let refreshControl = UIRefreshControl()

    private let errorPanel = UIView()
    private let errorLabel = UILabel()
    private let retryButton = UIButton(type: .system)

    private var isOnCallScreen = false

    // MARK: - Ciclu de viață

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        setupWebView()
        setupProgressBar()
        setupErrorPanel()
        setupObservers()
        loadHome()
        // Dacă userul a răspuns din CallKit înainte să se creeze WebShell (app din kill).
        DispatchQueue.main.async { [weak self] in
            self?.openPendingAnsweredCallIfAny()
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        openPendingAnsweredCallIfAny()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        isOnCallScreen ? .lightContent : .darkContent
    }

    deinit {
        progressObservation?.invalidate()
        webView?.configuration.userContentController
            .removeScriptMessageHandler(forName: GeolocationBridge.handlerName)
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Construcție UI

    private func setupWebView() {
        let controller = WKUserContentController()
        controller.addUserScript(
            WKUserScript(
                source: WebScripts.geolocationPolyfill,
                injectionTime: .atDocumentStart,
                // Doar frame-ul principal: răspunsul nativ se livrează prin
                // `evaluateJavaScript`, care nu ajunge în iframe-uri.
                forMainFrameOnly: true
            )
        )

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.applicationNameForUserAgent = AppConfig.userAgentSuffix

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.backgroundColor = .white
        webView.isOpaque = true

        geolocationBridge = GeolocationBridge(webView: webView)
        controller.add(geolocationBridge, name: GeolocationBridge.handlerName)

        // Ecran complet: paginile folosesc `env(safe-area-inset-*)` (viewport-fit=cover e deja setat în web).
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        refreshControl.addTarget(self, action: #selector(handlePullToRefresh), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
    }

    private func setupProgressBar() {
        progressBar.translatesAutoresizingMaskIntoConstraints = false
        progressBar.progressTintColor = UIColor(red: 0.08, green: 0.72, blue: 0.65, alpha: 1)
        progressBar.trackTintColor = .clear
        progressBar.isHidden = true
        view.addSubview(progressBar)
        NSLayoutConstraint.activate([
            progressBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progressBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressBar.heightAnchor.constraint(equalToConstant: 2),
        ])

        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] webView, _ in
            guard let self else { return }
            let progress = Float(webView.estimatedProgress)
            self.progressBar.setProgress(progress, animated: true)
            self.progressBar.isHidden = progress >= 1.0 || progress <= 0.0
        }
    }

    private func setupErrorPanel() {
        errorPanel.translatesAutoresizingMaskIntoConstraints = false
        errorPanel.backgroundColor = .white
        errorPanel.isHidden = true

        errorLabel.translatesAutoresizingMaskIntoConstraints = false
        errorLabel.numberOfLines = 0
        errorLabel.textAlignment = .center
        errorLabel.textColor = .darkGray
        errorLabel.font = .systemFont(ofSize: 16)
        errorLabel.text = "Nu ne putem conecta. Verifică internetul și încearcă din nou."

        retryButton.translatesAutoresizingMaskIntoConstraints = false
        retryButton.setTitle("Reîncearcă", for: .normal)
        retryButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        retryButton.setTitleColor(.white, for: .normal)
        retryButton.backgroundColor = UIColor(red: 0.08, green: 0.72, blue: 0.65, alpha: 1)
        retryButton.layer.cornerRadius = 12
        retryButton.contentEdgeInsets = UIEdgeInsets(top: 12, left: 28, bottom: 12, right: 28)
        retryButton.addTarget(self, action: #selector(handleRetry), for: .touchUpInside)

        view.addSubview(errorPanel)
        errorPanel.addSubview(errorLabel)
        errorPanel.addSubview(retryButton)

        NSLayoutConstraint.activate([
            errorPanel.topAnchor.constraint(equalTo: view.topAnchor),
            errorPanel.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            errorPanel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            errorPanel.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            errorLabel.centerYAnchor.constraint(equalTo: errorPanel.centerYAnchor, constant: -32),
            errorLabel.leadingAnchor.constraint(equalTo: errorPanel.leadingAnchor, constant: 32),
            errorLabel.trailingAnchor.constraint(equalTo: errorPanel.trailingAnchor, constant: -32),

            retryButton.topAnchor.constraint(equalTo: errorLabel.bottomAnchor, constant: 24),
            retryButton.centerXAnchor.constraint(equalTo: errorPanel.centerXAnchor),
        ])
    }

    private func setupObservers() {
        let center = NotificationCenter.default
        center.addObserver(
            self,
            selector: #selector(handleOpenCall(_:)),
            name: .diebelOpenCall,
            object: nil
        )
        center.addObserver(
            self,
            selector: #selector(handleEndCall),
            name: .diebelEndCall,
            object: nil
        )
        center.addObserver(
            self,
            selector: #selector(handleDeclineCall),
            name: .diebelDeclineCall,
            object: nil
        )
        center.addObserver(
            self,
            selector: #selector(handleVoipTokenUpdated),
            name: .diebelVoipTokenUpdated,
            object: nil
        )
        center.addObserver(
            self,
            selector: #selector(handleAppForeground),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    // MARK: - Navigare

    private func loadHome() {
        errorPanel.isHidden = true
        webView.load(URLRequest(url: AppConfig.homeURL()))
    }

    @objc private func handleRetry() {
        loadHome()
    }

    @objc private func handlePullToRefresh() {
        webView.reload()
    }

    @objc private func handleOpenCall(_ note: Notification) {
        guard let call = note.object as? PendingCall, !call.roomId.isEmpty else { return }
        openCall(call)
    }

    @objc private func handleEndCall() {
        if AppConfig.isCallURL(webView.url) {
            loadHome()
        }
    }

    @objc private func handleDeclineCall() {
        webView.evaluateJavaScript(WebScripts.declineIncomingCall, completionHandler: nil)
    }

    private func openPendingAnsweredCallIfAny() {
        guard let call = PendingCallStore.takeAnsweredAwaitingUI(), !call.roomId.isEmpty else { return }
        openCall(call)
    }

    private func openCall(_ call: PendingCall) {
        // Consumă și buffer-ul cold-start ca să nu redeschidem de două ori.
        _ = PendingCallStore.takeAnsweredAwaitingUI()
        AudioSessionController.activateForCall()
        errorPanel.isHidden = true
        webView.load(URLRequest(url: AppConfig.callURL(roomId: call.roomId, audioOnly: call.audioOnly)))
    }

    @objc private func handleAppForeground() {
        openPendingAnsweredCallIfAny()
        webView.evaluateJavaScript(WebScripts.resumeScript, completionHandler: nil)
        registerPushTokenIfPossible()
    }

    @objc private func handleVoipTokenUpdated() {
        registerPushTokenIfPossible()
    }

    /// Trimite tokenul VoIP prin WebView, ca să folosească automat cookie-ul de sesiune.
    /// Rulează după fiecare navigare; scriptul se auto-deduplică per pagină, deci după
    /// (re)autentificare tokenul se leagă de contul corect.
    private func registerPushTokenIfPossible() {
        guard let token = VoipPushManager.shared.voipToken,
              let host = webView.url?.host?.lowercased(),
              host == AppConfig.webHost
        else { return }
        webView.evaluateJavaScript(WebScripts.registerVoipToken(token), completionHandler: nil)
    }

    private func updateCallChrome(for url: URL?) {
        let onCall = AppConfig.isCallURL(url)
        guard onCall != isOnCallScreen else { return }
        isOnCallScreen = onCall
        view.backgroundColor = onCall ? .black : .white
        webView.backgroundColor = onCall ? .black : .white
        setNeedsStatusBarAppearanceUpdate()
        if onCall {
            AudioSessionController.activateForCall()
        } else {
            CallKitManager.shared.endActiveCall()
            AudioSessionController.deactivateAfterCall()
        }
    }

    private func showError(_ message: String?) {
        progressBar.isHidden = true
        refreshControl.endRefreshing()
        if let message, !message.isEmpty {
            errorLabel.text = message
        }
        errorPanel.isHidden = false
    }
}

// MARK: - WKNavigationDelegate

extension WebShellViewController: WKNavigationDelegate {

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        let scheme = url.scheme?.lowercased() ?? ""

        // Scheme interne WebKit (iframe-uri, blob-uri, conținut inline) — nu le filtrăm.
        if scheme == "about" || scheme == "blob" || scheme == "data" {
            decisionHandler(.allow)
            return
        }

        if AppConfig.isBlockedStoreLink(url) {
            decisionHandler(.cancel)
            return
        }

        if AppConfig.isAllowedInApp(url) {
            decisionHandler(.allow)
            return
        }

        if scheme == "http" || scheme == "https" {
            // Linkuri externe: rămânem în aplicație, ca pe Android.
            decisionHandler(.cancel)
            return
        }

        // tel:, mailto:, sms: → aplicațiile de sistem.
        decisionHandler(.cancel)
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        errorPanel.isHidden = true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshControl.endRefreshing()
        progressBar.isHidden = true
        webView.evaluateJavaScript(WebScripts.bootScript, completionHandler: nil)
        updateCallChrome(for: webView.url)
        registerPushTokenIfPossible()
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        handleNavigationError(error)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        handleNavigationError(error)
    }

    private func handleNavigationError(_ error: Error) {
        let nsError = error as NSError
        // Navigare anulată (redirect / link blocat) nu este o eroare de rețea.
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled { return }
        if nsError.domain == "WebKitErrorDomain" && nsError.code == 102 { return }
        showError(nsError.localizedDescription)
    }
}

// MARK: - WKUIDelegate

extension WebShellViewController: WKUIDelegate {

    /// Cameră / microfon pentru apelurile WebRTC. Doar pentru domeniul nostru.
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        let host = origin.host.lowercased()
        decisionHandler(host == AppConfig.webHost ? .grant : .deny)
    }

    /// `target="_blank"` → încărcăm în aceeași fereastră (altfel linkul nu face nimic).
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil,
           let url = navigationAction.request.url,
           AppConfig.isAllowedInApp(url) {
            webView.load(URLRequest(url: url))
        }
        return nil
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Anulează", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
}
