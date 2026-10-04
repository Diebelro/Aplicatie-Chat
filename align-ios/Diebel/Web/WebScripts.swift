import Foundation

/// JavaScript injectat în WebView.
enum WebScripts {
    /// Polyfill `navigator.geolocation` peste bridge-ul nativ. Se injectează la `documentStart`,
    /// înainte ca paginile să apeleze `getCurrentPosition`.
    static let geolocationPolyfill = """
    (function () {
      if (window.__diebelGeoReady) return;
      window.__diebelGeoReady = true;
      var seq = 1;
      var callbacks = {};

      window.__diebelGeoResolve = function (id, ok, data) {
        var entry = callbacks[id];
        if (!entry) return;
        if (!entry.watch) delete callbacks[id];
        if (ok) {
          if (entry.success) {
            entry.success({
              coords: {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: data.timestamp
            });
          }
        } else if (entry.error) {
          entry.error({
            code: data.code,
            message: data.message,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3
          });
        }
      };

      function post(action, id) {
        try {
          window.webkit.messageHandlers.diebelGeo.postMessage({ action: action, id: id });
        } catch (e) {}
      }

      var geolocation = {
        getCurrentPosition: function (success, error) {
          var id = seq++;
          callbacks[id] = { success: success, error: error, watch: false };
          post('getCurrentPosition', id);
        },
        watchPosition: function (success, error) {
          var id = seq++;
          callbacks[id] = { success: success, error: error, watch: true };
          post('watchPosition', id);
          return id;
        },
        clearWatch: function (id) {
          delete callbacks[id];
          post('clearWatch', id);
        }
      };

      try {
        Object.defineProperty(navigator, 'geolocation', {
          value: geolocation,
          configurable: true
        });
      } catch (e) {
        try { navigator.geolocation = geolocation; } catch (e2) {}
      }
    })();
    """

    /// Rulat după fiecare navigare: reia audio pe ecranul de apel.
    /// Atenție: NU ștergem `align_search_filters` — utilizatorul își pierdea criteriile de căutare.
    static let bootScript = """
    (function () {
      try {
        var onCall = /\\/app\\/call/i.test(location.pathname || '');
        if (onCall) {
          var Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) {
            if (!window.__diebelAudioCtx || window.__diebelAudioCtx.state === 'closed') {
              window.__diebelAudioCtx = new Ctx();
            }
            window.__diebelAudioCtx.resume();
          }
          document.querySelectorAll('audio').forEach(function (el) {
            try { if (el.srcObject && !el.muted) el.play(); } catch (e) {}
          });
        }
      } catch (e) {}
    })();
    """

    /// Reactivează heartbeat-ul de prezență când aplicația revine în prim-plan.
    static let resumeScript = """
    (function () {
      try {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new CustomEvent('align:poll-sync'));
      } catch (e) {}
    })();
    """

    /// Înregistrează tokenul VoIP folosind sesiunea (cookie-ul) deja existentă în WebView.
    static func registerVoipToken(_ token: String) -> String {
        let safe = token.replacingOccurrences(of: "'", with: "")
        return """
        (function (t) {
          try {
            if (window.__diebelVoipSent === t) return;
            window.__diebelVoipSent = t;
            fetch('/api/me/push-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ apnsVoipToken: t, platform: 'ios' })
            }).catch(function () { window.__diebelVoipSent = null; });
          } catch (e) {}
        })('\(safe)');
        """
    }

    /// Respinge apelul curent (pending) pe server — folosește cookie-ul din WebView.
    static let declineIncomingCall = """
    (function () {
      try {
        fetch('/api/call/decline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: '{}'
        }).catch(function () {});
      } catch (e) {}
    })();
    """
}
