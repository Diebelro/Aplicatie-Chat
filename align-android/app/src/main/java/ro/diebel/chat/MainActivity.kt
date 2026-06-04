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
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import ro.diebel.chat.ads.ConsentAndMobileAds
import ro.diebel.chat.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var homeUrl: String = ""
    private var webViewDestroyed = false

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents(),
    ) { uris ->
        fileUploadCallback?.onReceiveValue(uris.toTypedArray())
        fileUploadCallback = null
    }

    private var pendingPermissionRequest: PermissionRequest? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureSystemBars()
        try {
            binding = ActivityMainBinding.inflate(layoutInflater)
            setContentView(binding.root)

            ConsentAndMobileAds.startConsentFlowIfNeeded(this)

            homeUrl = chatEntryUrl()
            enableCookies(binding.webView)
            configureWebView(binding.webView)
            binding.webView.clearCache(true)
            binding.btnRetry.setOnClickListener { loadHome() }

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

    /** Aceeași culoare ca app-ul (#0f1419); fără padding extra web care făcea „linii” mari sus/jos. */
    private fun configureSystemBars() {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = ContextCompat.getColor(this, R.color.align_bg)
        window.navigationBarColor = ContextCompat.getColor(this, R.color.align_bg)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
    }

    private fun enableCookies(webView: WebView) {
        val cm = CookieManager.getInstance()
        cm.setAcceptCookie(true)
        cm.setAcceptThirdPartyCookies(webView, true)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(webView: WebView) {
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
                    pendingPermissionRequest = request
                    ActivityCompat.requestPermissions(
                        this@MainActivity,
                        needAndroid.toTypedArray(),
                        REQ_WEBRTC_PERM,
                    )
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
                    val mimeType = fileChooserParams?.acceptTypes
                        ?.firstOrNull { it.isNotBlank() } ?: "image/*"
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
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                if (!::binding.isInitialized) return
                binding.progress.isVisible = false
                binding.webView.evaluateJavascript(WEB_SHELL_BOOT_JS, null)
                prepareCallAudioRouting()
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
                if (isAllowedInApp(uri)) return false
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                } catch (e: Exception) {
                    Log.w(TAG, "No app to handle URL: $uri", e)
                }
                return true
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_WEBRTC_PERM) {
            val req = pendingPermissionRequest ?: return
            pendingPermissionRequest = null
            if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                prepareCallAudioRouting()
                req.grant(req.resources)
            } else {
                req.deny()
            }
        }
    }

    private fun isAllowedInApp(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme != "http" && scheme != "https") return false
        val host = uri.host?.lowercase() ?: return false
        return host == "chat.diebel.ro"
            || host.endsWith(".diebel.ro")
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
            || host == "www.google.com"
    }

    private fun loadHome() {
        if (!::binding.isInitialized) return
        binding.errorPanel.isVisible = false
        binding.progress.isVisible = true
        val url = "$homeUrl?shell=${BuildConfig.VERSION_CODE}"
        binding.webView.loadUrl(url)
    }

    /** Difuzor + focus audio pentru apeluri WebRTC în WebView (altfel uneori fără sunet). */
    private fun prepareCallAudioRouting() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
            am.mode = AudioManager.MODE_IN_COMMUNICATION
            am.isSpeakerphoneOn = true
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

    companion object {
        private const val TAG = "MainActivity"
        private const val REQ_WEBRTC_PERM = 2001

        private const val WEB_SHELL_BOOT_JS =
            "(function(){try{localStorage.removeItem('align_search_filters');" +
                "if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations()" +
                ".then(function(r){r.forEach(function(x){x.unregister();});});}" +
                "if('caches' in window){caches.keys().then(function(k){" +
                "k.forEach(function(n){caches.delete(n);});});}" +
                "var C=window.AudioContext||window.webkitAudioContext;" +
                "if(C){if(!window.__diebelAudioCtx||window.__diebelAudioCtx.state==='closed')" +
                "{window.__diebelAudioCtx=new C();}window.__diebelAudioCtx.resume();}" +
                "document.querySelectorAll('audio').forEach(function(a){" +
                "try{a.muted=false;if(a.srcObject)a.play();}catch(e){}});" +
                "}catch(e){}})();"
    }
}
