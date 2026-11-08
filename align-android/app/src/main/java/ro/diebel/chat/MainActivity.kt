package ro.diebel.chat

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ro.diebel.chat.ads.ConsentAndMobileAds
import ro.diebel.chat.data.SessionStore
import ro.diebel.chat.databinding.ActivityMainBinding
import ro.diebel.chat.net.AlignApi

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var homeUrl: String = ""
    private var webViewDestroyed = false
    private var insetTop = 0
    private var insetBottom = 0
    private var insetLeft = 0
    private var insetRight = 0

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents(),
    ) { uris ->
        fileUploadCallback?.onReceiveValue(uris.toTypedArray())
        fileUploadCallback = null
    }

    private var pendingPermissionRequest: PermissionRequest? = null
    private var pendingDeepLinkUrl: String? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingDeepLinkUrl = intent?.getStringExtra(EXTRA_DEEP_LINK_URL)?.trim()?.takeIf { it.isNotBlank() }
        configureSystemBars()
        try {
            binding = ActivityMainBinding.inflate(layoutInflater)
            setContentView(binding.root)

            ConsentAndMobileAds.startConsentFlowIfNeeded(this)

            homeUrl = chatEntryUrl()
            enableCookies(binding.webView)
            configureWebView(binding.webView)
            applyWindowInsetsToWebView()
            binding.webView.clearCache(true)
            binding.btnRetry.setOnClickListener { loadHome() }
            maybeRequestNotificationPermission()

            onBackPressedDispatcher.addCallback(
                this,
                object : OnBackPressedCallback(true) {
                    override fun handleOnBackPressed() {
                        if (::binding.isInitialized && binding.webView.canGoBack()) {
                            binding.webView.goBack()
                        } else {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                },
            )

            if (savedInstanceState != null) {
                binding.webView.restoreState(savedInstanceState)
                if (binding.webView.url.isNullOrBlank()) {
                    loadHome()
                }
            } else {
                loadHome()
            }
        } catch (e: Exception) {
            Log.e(TAG, "onCreate failed", e)
            try {
                setContentView(R.layout.activity_main)
                findViewById<android.widget.TextView>(R.id.errorMessage)?.text =
                    getString(R.string.web_error_body)
                findViewById<android.view.View>(R.id.errorPanel)?.visibility =
                    android.view.View.VISIBLE
                findViewById<com.google.android.material.button.MaterialButton>(R.id.btnRetry)
                    ?.setOnClickListener { recreate() }
            } catch (e2: Exception) {
                Log.e(TAG, "fallback UI failed", e2)
            }
        }
    }

    private fun chatEntryUrl(): String {
        val base = BuildConfig.API_BASE_URL.trimEnd('/')
        return "$base/app"
    }

    /**
     * Edge-to-edge: aplicația desenează pe tot ecranul, iar root view-ul primește
     * padding egal cu înălțimea barelor sistemului. WebView-ul se dimensionează
     * automat în spațiul rămas — exact ca aplicațiile native standard.
     *
     * Nu mai setăm statusBarColor / navigationBarColor (API-uri depreciate pe Android 15+);
     * culoarea vine din fundalul root-ului, iar iconițele din WindowInsetsControllerCompat.
     */
    private fun configureSystemBars() {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
        enableEdgeToEdge()
        // Aplicația web e tema light → iconițe închise pe barele transparente.
        // Ecranul de apel (întunecat) comută prin applyCallChrome(true).
        applyCallChrome(false)
    }

    /**
     * Aliniază fundalul și aspectul iconițelor barelor de sistem:
     * - rute normale (light): fundal deschis, iconițe închise;
     * - apel (întunecat): fundal închis, iconițe deschise.
     */
    private fun applyCallChrome(isCall: Boolean) {
        if (!::binding.isInitialized && isCall) return
        val colorRes = if (isCall) R.color.align_bg else R.color.align_bg_light
        val bg = ContextCompat.getColor(this, colorRes)
        if (::binding.isInitialized) {
            binding.root.setBackgroundColor(bg)
            binding.webView.setBackgroundColor(bg)
        }
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = !isCall
            isAppearanceLightNavigationBars = !isCall
        }
    }

    private fun applyWindowInsetsToWebView() {
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, windowInsets ->
            val bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
            insetTop = bars.top
            insetBottom = bars.bottom
            insetLeft = bars.left
            insetRight = bars.right
            // Padding pe ROOT: bare sistem + tastatură (IME) ca inputul chat să rămână vizibil.
            val bottomPad = maxOf(bars.bottom, ime.bottom)
            view.setPadding(bars.left, bars.top, bars.right, bottomPad)
            binding.webView.setPadding(0, 0, 0, 0)
            injectSafeAreaCss()
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(binding.root)
    }

    /** Root view primește padding = barele sistemului + IME; CSS safe-area rămâne 0. */
    private fun injectSafeAreaCss() {
        if (!::binding.isInitialized || webViewDestroyed) return
        val js =
            "(function(){try{var r=document.documentElement;" +
                "r.style.setProperty('--safe-area-inset-top','0px');" +
                "r.style.setProperty('--safe-area-inset-bottom','0px');" +
                "r.style.setProperty('--safe-area-inset-left','0px');" +
                "r.style.setProperty('--safe-area-inset-right','0px');" +
                "r.style.removeProperty('--keyboard-inset');" +
                "r.classList.add('diebel-native-insets');}catch(e){}})();"
        binding.webView.evaluateJavascript(js, null)
    }

    private fun enableCookies(webView: WebView) {
        val cm = CookieManager.getInstance()
        cm.setAcceptCookie(true)
        cm.setAcceptThirdPartyCookies(webView, true)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(webView: WebView) {
        webView.setBackgroundColor(ContextCompat.getColor(this, R.color.align_bg_light))
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            allowContentAccess = true
            allowFileAccess = true
            cacheMode = WebSettings.LOAD_NO_CACHE
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = false
            userAgentString = "$userAgentString DiebelAndroid/${BuildConfig.VERSION_NAME}"
        }

        // Bridge web→nativ: web-ul anunță când intră/iese din ecranul de apel (navigare SPA),
        // ca barele de sistem să comute corect (light în app, dark în apel).
        webView.addJavascriptInterface(WebBridge(), "DiebelNative")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (!::binding.isInitialized) return
                binding.progress.isVisible = newProgress in 1..99
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request ?: return
                val resources = request.resources
                val needAndroid = mutableListOf<String>()
                if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED
                    ) needAndroid.add(Manifest.permission.RECORD_AUDIO)
                }
                if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA)
                        != PackageManager.PERMISSION_GRANTED
                    ) needAndroid.add(Manifest.permission.CAMERA)
                }
                if (needAndroid.isEmpty()) {
                    prepareCallAudioRouting()
                    request.grant(resources)
                } else {
                    val canGrantNow = resources.all { res ->
                        when (res) {
                            PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                                ContextCompat.checkSelfPermission(
                                    this@MainActivity,
                                    Manifest.permission.RECORD_AUDIO,
                                ) == PackageManager.PERMISSION_GRANTED
                            PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                                ContextCompat.checkSelfPermission(
                                    this@MainActivity,
                                    Manifest.permission.CAMERA,
                                ) == PackageManager.PERMISSION_GRANTED
                            else -> true
                        }
                    }
                    if (canGrantNow) {
                        prepareCallAudioRouting()
                        request.grant(resources)
                    } else {
                        pendingPermissionRequest = request
                        ActivityCompat.requestPermissions(
                            this@MainActivity,
                            needAndroid.toTypedArray(),
                            REQ_WEBRTC_PERM,
                        )
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest?) {
                if (pendingPermissionRequest === request) pendingPermissionRequest = null
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?,
            ) {
                callback?.invoke(origin, true, false)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback
                try {
                    val acceptTypes = fileChooserParams?.acceptTypes
                        ?.filter { it.isNotBlank() }
                        .orEmpty()
                    val mimeType = when {
                        acceptTypes.isEmpty() -> "image/*"
                        acceptTypes.any { it == "*/*" } -> "*/*"
                        acceptTypes.any { it == "image/*" } -> "image/*"
                        acceptTypes.any { it == "video/*" } -> "video/*"
                        acceptTypes.all { it.startsWith("image/") } -> "image/*"
                        acceptTypes.all { it.startsWith("video/") } -> "video/*"
                        acceptTypes.size == 1 -> acceptTypes[0]
                        else -> "*/*"
                    }
                    fileChooserLauncher.launch(mimeType)
                } catch (e: Exception) {
                    Log.w(TAG, "File chooser failed", e)
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = null
                }
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                if (!::binding.isInitialized) return
                binding.errorPanel.isVisible = false
                binding.progress.isVisible = true
                val pageUrl = url?.trim().orEmpty()
                if (pageUrl.isEmpty()) return
                val uri = Uri.parse(pageUrl)
                if (isAllowedInApp(uri)) return
                view?.stopLoading()
                if (isDiebelProductLink(uri)) {
                    Log.i(TAG, "Opening Diebel product in browser: $pageUrl")
                    openInExternalBrowser(uri)
                    if (view?.canGoBack() == true) view.goBack()
                    return
                }
                Log.w(TAG, "Blocked off-chat navigation, returning home: $pageUrl")
                loadHome()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                if (!::binding.isInitialized) return
                binding.progress.isVisible = false
                injectSafeAreaCss()
                binding.webView.evaluateJavascript(webShellBootJs(), null)
                val onCall = isCallUrl(url)
                applyCallChrome(onCall)
                if (onCall) prepareCallAudioRouting()
                else resetCallAudioRouting()
                if (url?.contains("chat.diebel.ro") == true) {
                    syncSessionAndRegisterFcm()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                if (request?.isForMainFrame != true) return
                showError(error?.description?.toString())
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (isBlockedStoreLink(uri)) {
                    Log.w(TAG, "Blocked Play Store link: $uri")
                    return true
                }
                if (isAllowedInApp(uri)) return false
                val scheme = uri.scheme?.lowercase()
                // intent://…#Intent;scheme=https;… — deschis din web fără DiebelNative.openExternal
                if (scheme == "intent") {
                    openIntentUri(uri.toString())
                    return true
                }
                // Ads / Transfer / AnunțAI / alte produse Diebel → browser extern (nu bloca click-ul).
                if ((scheme == "http" || scheme == "https") && isDiebelProductLink(uri)) {
                    openInExternalBrowser(uri)
                    return true
                }
                if (scheme == "http" || scheme == "https") {
                    // Link extern din chat (YouTube, hărți etc.) → browserul telefonului; WebView-ul rămâne pe Chat.
                    Log.i(TAG, "Opening external web link in browser: $uri")
                    openInExternalBrowser(uri)
                    return true
                }
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (e: Exception) {
                    Log.w(TAG, "No app to handle URL: $uri", e)
                }
                return true
            }
        }
    }

    /**
     * Android 13+ (API 33): notificările cer permisiune la runtime. Fără ea, push-ul FCM
     * pentru apeluri/mesaje primite e silentios. Cerem o singură dată, non-blocant.
     */
    private fun maybeRequestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
        ) return
        try {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                REQ_NOTIF_PERM,
            )
        } catch (e: Exception) {
            Log.w(TAG, "notification permission request failed", e)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_NOTIF_PERM) return
        if (requestCode == REQ_WEBRTC_PERM) {
            val req = pendingPermissionRequest ?: return
            pendingPermissionRequest = null
            val grantedResources = req.resources.filter { resource ->
                when (resource) {
                    PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
                            PackageManager.PERMISSION_GRANTED
                    PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
                            PackageManager.PERMISSION_GRANTED
                    else -> true
                }
            }.toTypedArray()
            if (grantedResources.isNotEmpty()) {
                prepareCallAudioRouting()
                req.grant(grantedResources)
            } else {
                req.deny()
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = intent.getStringExtra(EXTRA_DEEP_LINK_URL)?.trim()?.takeIf { it.isNotBlank() } ?: return
        if (::binding.isInitialized && !webViewDestroyed) {
            binding.webView.loadUrl(url)
        } else {
            pendingDeepLinkUrl = url
        }
    }

    /** Cookie httpOnly + userId din storage → FCM pentru apeluri primite pe telefon. */
    private fun syncSessionAndRegisterFcm() {
        if (webViewDestroyed || !::binding.isInitialized) return
        val cookie = CookieManager.getInstance().getCookie("https://chat.diebel.ro") ?: return
        val sidMatch = Regex("(?:^|;\\s*)align_sid=([^;]+)").find(cookie) ?: return
        val sessionToken = sidMatch.groupValues[1]
        binding.webView.evaluateJavascript(
            "(function(){try{var r=localStorage.getItem('align_user')||sessionStorage.getItem('align_user');" +
                "if(!r)return null;var u=JSON.parse(r);return u&&u.id?String(u.id):null;}catch(e){return null;}})();",
        ) { userIdJson ->
            val userId = userIdJson?.trim()?.removeSurrounding("\"")?.takeIf {
                it.isNotBlank() && it != "null"
            } ?: return@evaluateJavascript
            val store = SessionStore(this)
            store.sessionToken = sessionToken
            store.userId = userId
            registerFcmTokenIfConfigured(sessionToken, userId)
        }
    }

    private fun registerFcmTokenIfConfigured(sessionToken: String, userId: String) {
        if (!FirebaseBootstrap.isConfigured(this)) return
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) return@addOnCompleteListener
            val token = task.result ?: return@addOnCompleteListener
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    AlignApi().registerFcmToken(sessionToken, userId, token)
                } catch (e: Exception) {
                    Log.w(TAG, "FCM register failed", e)
                }
            }
        }
    }

    /** Doar chat.diebel.ro + OAuth — nu www.diebel.ro (site firmă) și nu Play Store. */
    private fun isAllowedInApp(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme != "http" && scheme != "https") return false
        val host = uri.host?.lowercase() ?: return false
        if (isBlockedStoreLink(uri)) return false
        return host == "chat.diebel.ro"
            || host == "accounts.google.com"
            || host.endsWith(".google.com")
            || host == "appleid.apple.com"
            || host.endsWith(".apple.com")
            || host == "login.microsoftonline.com"
            || host.endsWith(".microsoftonline.com")
            || host == "www.facebook.com"
            || host.endsWith(".facebook.com")
            || host == "login.yahoo.com"
            || host.endsWith(".yahoo.com")
    }

    /** ads / transfer / anunțuri / play — se deschid în Chrome, nu în WebView-ul Chat. */
    private fun isDiebelProductLink(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme != "http" && scheme != "https") return false
        val host = uri.host?.lowercase() ?: return false
        if (host == "chat.diebel.ro") return false
        return host == "diebel.ro"
            || host.endsWith(".diebel.ro")
    }

    private fun openInExternalBrowser(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            Log.w(TAG, "Cannot open external browser for $uri", e)
        }
    }

    /** Parsează intent:// din WebView (fallback când APK-ul vechi n-are openExternal). */
    private fun openIntentUri(raw: String) {
        try {
            val intent = Intent.parseUri(raw, Intent.URI_INTENT_SCHEME)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val target = intent.data
            if (target != null && (isDiebelProductLink(target) || isAllowedInApp(target))) {
                // Nu pornim intent-ul parsat (ar putea ținti package/component); doar ACTION_VIEW pe https.
                openInExternalBrowser(target)
                return
            }
            // Fallback: extrage https din intent
            val browser = intent.getStringExtra("browser_fallback_url")
            if (!browser.isNullOrBlank()) {
                openInExternalBrowser(Uri.parse(browser))
                return
            }
            if (target != null && target.scheme.equals("https", ignoreCase = true)) {
                openInExternalBrowser(target)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Cannot open intent URI: $raw", e)
        }
    }

    private fun isBlockedStoreLink(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme == "market") return true
        val host = uri.host?.lowercase() ?: return false
        return host == "play.google.com" || host.endsWith(".play.google.com")
    }

    private fun loadHome(forceFresh: Boolean = false) {
        if (!::binding.isInitialized) return
        binding.errorPanel.isVisible = false
        binding.progress.isVisible = true
        if (forceFresh) {
            binding.webView.clearCache(true)
            CookieManager.getInstance().flush()
        }
        val deepLink = pendingDeepLinkUrl
        if (!deepLink.isNullOrBlank()) {
            pendingDeepLinkUrl = null
            binding.webView.loadUrl(deepLink)
            return
        }
        val bust = System.currentTimeMillis()
        val url = "$homeUrl?shell=${BuildConfig.VERSION_CODE}&ui=$UI_BUILD&_=$bust"
        binding.webView.loadUrl(url)
    }

    private fun isHeadsetConnected(am: AudioManager): Boolean {
        return try {
            @Suppress("DEPRECATION")
            am.isWiredHeadsetOn ||
                @Suppress("DEPRECATION")
                am.isBluetoothScoOn ||
                @Suppress("DEPRECATION")
                am.isBluetoothA2dpOn
        } catch (_: Exception) {
            false
        }
    }

    private fun isCallUrl(url: String?): Boolean {
        val u = url?.lowercase() ?: return false
        return u.contains("/app/call")
    }

    /** Apel WebRTC: routing căști/ureche — difuzor OFF implicit (evită ecou); user poate comuta din UI web. */
    private fun prepareCallAudioRouting() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
            am.mode = AudioManager.MODE_IN_COMMUNICATION
            am.isSpeakerphoneOn = false
            @Suppress("DEPRECATION")
            am.requestAudioFocus(
                null,
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN,
            )
        } catch (e: Exception) {
            Log.w(TAG, "prepareCallAudioRouting", e)
        }
    }

    private fun resetCallAudioRouting() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
            am.mode = AudioManager.MODE_NORMAL
            am.isSpeakerphoneOn = false
            @Suppress("DEPRECATION")
            am.abandonAudioFocus(null)
        } catch (e: Exception) {
            Log.w(TAG, "resetCallAudioRouting", e)
        }
    }

    private fun showError(detail: String?) {
        if (!::binding.isInitialized) return
        binding.progress.isVisible = false
        binding.errorPanel.isVisible = true
        binding.errorMessage.text = detail?.takeIf { it.isNotBlank() }
            ?: getString(R.string.web_error_body)
    }

    override fun onResume() {
        super.onResume()
        CookieManager.getInstance().flush()
        if (::binding.isInitialized && !webViewDestroyed) {
            binding.webView.onResume()
            ViewCompat.requestApplyInsets(binding.root)
            injectSafeAreaCss()
            val prefs = getSharedPreferences(PREFS_WEB, MODE_PRIVATE)
            val lastUi = prefs.getString(PREF_UI_BUILD, null)
            if (lastUi != null && lastUi != UI_BUILD) {
                prefs.edit().putString(PREF_UI_BUILD, UI_BUILD).apply()
                // Doar cache nou — NU ștergem cookie-urile (altfel userul pierde sesiunea și „nu mai primește mesaje”).
                binding.webView.clearCache(true)
                loadHome(forceFresh = false)
            } else if (lastUi == null) {
                prefs.edit().putString(PREF_UI_BUILD, UI_BUILD).apply()
            }
            // Reîmprospătează heartbeat + status online (visibility/focus în pagina web).
            binding.webView.evaluateJavascript(
                "(function(){try{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new CustomEvent('align:poll-sync'));}catch(e){}})();",
                null,
            )
        }
    }

    override fun onPause() {
        if (::binding.isInitialized && !webViewDestroyed) {
            binding.webView.onPause()
        }
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::binding.isInitialized) {
            binding.webView.saveState(outState)
        }
    }

    override fun onDestroy() {
        if (isFinishing && ::binding.isInitialized && !webViewDestroyed) {
            webViewDestroyed = true
            val webView = binding.webView
            webView.stopLoading()
            (webView.parent as? ViewGroup)?.removeView(webView)
            webView.destroy()
        }
        super.onDestroy()
    }

    /** Expus în WebView ca `window.DiebelNative`. Apelat din web la schimbarea rutei. */
    private inner class WebBridge {
        @android.webkit.JavascriptInterface
        fun setCallChrome(isCall: Boolean) {
            runOnUiThread { applyCallChrome(isCall) }
        }

        /** Deschide ads.diebel.ro / transfer / anunțuri în browserul telefonului. */
        @android.webkit.JavascriptInterface
        fun openExternal(url: String?) {
            val raw = url?.trim().orEmpty()
            if (raw.isEmpty()) return
            runOnUiThread {
                try {
                    val uri = Uri.parse(raw)
                    if (isDiebelProductLink(uri) || isAllowedInApp(uri)) {
                        openInExternalBrowser(uri)
                    } else {
                        Log.w(TAG, "openExternal blocked: $raw")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "openExternal failed: $raw", e)
                }
            }
        }
    }

    companion object {
        const val EXTRA_DEEP_LINK_URL = "diebel_deep_link_url"
        private const val TAG = "MainActivity"
        private const val REQ_WEBRTC_PERM = 2001
        private const val REQ_NOTIF_PERM = 2002
        /** Trebuie să coincidă cu align-app/lib/uiBuildVersion.ts */
        private const val UI_BUILD = "106"
        private const val PREFS_WEB = "diebel_web"
        private const val PREF_UI_BUILD = "ui_build"

        /** NU ștergem `align_search_filters` — utilizatorul își pierdea criteriile de căutare. */
        private fun webShellBootJs(): String =
            "(function(){try{" +
                "if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations()" +
                ".then(function(r){r.forEach(function(x){x.unregister();});});}" +
                "if('caches' in window){caches.keys().then(function(k){" +
                "k.forEach(function(n){caches.delete(n);});});}" +
                "var onCall=/\\/app\\/call/i.test(location.pathname||'');" +
                "if(onCall){var C=window.AudioContext||window.webkitAudioContext;" +
                "if(C){if(!window.__diebelAudioCtx||window.__diebelAudioCtx.state==='closed')" +
                "{window.__diebelAudioCtx=new C();}window.__diebelAudioCtx.resume();}" +
                "document.querySelectorAll('audio').forEach(function(a){" +
                "try{if(a.srcObject&&!a.muted)a.play();}catch(e){}});}" +
                "}catch(e){}})();"
    }
}
