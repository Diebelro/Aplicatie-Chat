package ro.diebel.chat.webrtc

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoCapturer
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import ro.diebel.chat.BuildConfig
import ro.diebel.chat.net.AlignApi
import java.util.concurrent.atomic.AtomicBoolean

class WebRtcCallSession(
    private val appContext: Context,
    private val roomId: String,
    private val remoteUserId: String,
    private val isCaller: Boolean,
    val audioOnly: Boolean,
    private val sessionToken: String,
    private val myUserId: String,
    private val localPreview: SurfaceViewRenderer?,
    private val remoteView: SurfaceViewRenderer?,
    private val callback: Callback,
) {
    interface Callback {
        fun onError(message: String)
        fun onConnected()
        fun onEnded()
    }

    private val main = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val api = AlignApi()
    private val signaling = SignalingWs(main)
    private val ended = AtomicBoolean(false)

    private var factoryRef: PeerConnectionFactory? = null
    private var eglBase: EglBase? = null
    private var peerConnection: PeerConnection? = null
    private var localAudioTrack: AudioTrack? = null
    private var localVideoTrack: VideoTrack? = null
    private var videoCapturer: VideoCapturer? = null

    private val pendingRemoteIce = mutableListOf<IceCandidate>()
    private var remoteDescrSet = false
    private val signalingUrlBase = BuildConfig.SIGNALING_WS_BASE

    fun start() {
        signaling.setListener(object : SignalingWs.Listener {
            override fun onOpen() {
                signaling.sendJoin(roomId, myUserId, isCaller)
                main.post { scheduleHeartbeat() }
            }

            override fun onJoined(roomId: String, peers: List<String>) {}

            override fun onSession(remoteUserId: String, shouldOffer: Boolean) {
                if (shouldOffer) createOffer()
            }

            override fun onOffer(sdp: String, from: String) {
                setRemoteSDP(SessionDescription(SessionDescription.Type.OFFER, sdp)) {
                    createAnswer()
                }
            }

            override fun onAnswer(sdp: String, from: String) {
                setRemoteSDP(SessionDescription(SessionDescription.Type.ANSWER, sdp), null)
            }

            override fun onIce(from: String, candidate: String?, sdpMid: String?, sdpMLineIndex: Int) {
                if (candidate.isNullOrEmpty()) return
                val ice = IceCandidate(sdpMid ?: "", sdpMLineIndex, candidate)
                if (remoteDescrSet) {
                    peerConnection?.addIceCandidate(ice)
                } else {
                    synchronized(pendingRemoteIce) { pendingRemoteIce.add(ice) }
                }
            }

            override fun onCallEnd(from: String) {
                end()
            }

            override fun onError(code: String?) {
                callback.onError(code ?: "signaling")
            }
        })

        scope.launch {
            try {
                if (isCaller) {
                    withContext(Dispatchers.IO) {
                        api.ringCallee(sessionToken, myUserId, remoteUserId, roomId, audioOnly)
                    }
                }
                val iceServers = api.fetchIceServers(sessionToken, myUserId)
                val sigTok = api.fetchSignalingToken(sessionToken, myUserId)
                val wsUrl = buildSignalingUrl(signalingUrlBase, sigTok)
                withContext(Dispatchers.Main) {
                    ensureFactory()
                    val eglCtx = eglBase?.eglBaseContext
                    if (eglCtx != null) {
                        localPreview?.init(eglCtx, null)
                        remoteView?.init(eglCtx, null)
                    }
                    createPeerConnection(iceServers)
                    signaling.connect(wsUrl)
                }
            } catch (e: Exception) {
                Log.w(TAG, "start failed", e)
                callback.onError(e.message ?: "start failed")
            }
        }
    }

    private var heartbeatRunnable: Runnable? = null
    private fun scheduleHeartbeat() {
        if (heartbeatRunnable != null) return
        val r = object : Runnable {
            override fun run() {
                if (ended.get()) return
                signaling.sendHeartbeat()
                main.postDelayed(this, 25_000L)
            }
        }
        heartbeatRunnable = r
        main.postDelayed(r, 25_000L)
    }

    private fun ensureFactory() {
        if (factoryRef != null) return
        try {
            PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(appContext).createInitializationOptions(),
            )
            val egl = EglBase.create()
            eglBase = egl
            factoryRef = PeerConnectionFactory.builder()
                .setVideoEncoderFactory(DefaultVideoEncoderFactory(egl.eglBaseContext, true, true))
                .setVideoDecoderFactory(DefaultVideoDecoderFactory(egl.eglBaseContext))
                .createPeerConnectionFactory()
        } catch (e: Exception) {
            Log.e(TAG, "ensureFactory failed", e)
        }
    }

    private fun createPeerConnection(iceServers: List<PeerConnection.IceServer>) {
        val factory = factoryRef ?: return
        val rtc = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }
        val pc = factory.createPeerConnection(rtc, object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                if (state == PeerConnection.IceConnectionState.CONNECTED ||
                    state == PeerConnection.IceConnectionState.COMPLETED
                ) {
                    callback.onConnected()
                }
                if (state == PeerConnection.IceConnectionState.FAILED ||
                    state == PeerConnection.IceConnectionState.CLOSED
                ) {
                    end()
                }
            }

            override fun onIceConnectionReceivingChange(p0: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate ?: return
                signaling.sendIce(candidate, remoteUserId)
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(dc: DataChannel?) {}
            override fun onRenegotiationNeeded() {}

            override fun onTrack(transceiver: RtpTransceiver?) {
                val track = transceiver?.receiver?.track() ?: return
                when (track) {
                    is VideoTrack -> if (remoteView != null) track.addSink(remoteView)
                    is AudioTrack -> track.setEnabled(true)
                }
            }
        }) ?: return
        peerConnection = pc

        val ss = MediaConstraints()
        val audioSource = factory.createAudioSource(ss)
        localAudioTrack = factory.createAudioTrack("align_audio", audioSource)
        pc.addTrack(localAudioTrack, listOf("local_stream"))

        if (!audioOnly && localPreview != null) {
            try {
                val enumerator = org.webrtc.Camera2Enumerator(appContext)
                val names = enumerator.deviceNames
                val dev = names.firstOrNull { enumerator.isFrontFacing(it) } ?: names.firstOrNull()
                val capturer = if (dev != null) enumerator.createCapturer(dev, null) else null
                if (capturer != null) {
                    videoCapturer = capturer
                    val surfaceTextureHelper =
                        org.webrtc.SurfaceTextureHelper.create("CaptureThread", eglBase?.eglBaseContext)
                    val vs: VideoSource = factory.createVideoSource(false)
                    capturer.initialize(surfaceTextureHelper, appContext, vs.capturerObserver)
                    capturer.startCapture(1280, 720, 30)
                    localVideoTrack = factory.createVideoTrack("align_video", vs)
                    localVideoTrack?.addSink(localPreview)
                    pc.addTrack(localVideoTrack, listOf("local_stream"))
                }
            } catch (e: Exception) {
                Log.w(TAG, "Video setup optional, skipping", e)
            }
        }
    }

    private fun createOffer() {
        val pc = peerConnection ?: return
        val offerS = MediaConstraints()
        pc.createOffer(object : SdpAdapter() {
            override fun onCreateSuccess(desc: SessionDescription?) {
                desc ?: return
                pc.setLocalDescription(object : SdpAdapter() {
                    override fun onSetSuccess() {
                        signaling.sendOffer(desc.description, remoteUserId)
                    }
                }, desc)
            }
        }, offerS)
    }

    private fun createAnswer() {
        val pc = peerConnection ?: return
        pc.createAnswer(object : SdpAdapter() {
            override fun onCreateSuccess(desc: SessionDescription?) {
                desc ?: return
                pc.setLocalDescription(object : SdpAdapter() {
                    override fun onSetSuccess() {
                        signaling.sendAnswer(desc.description, remoteUserId)
                    }
                }, desc)
            }
        }, MediaConstraints())
    }

    private fun setRemoteSDP(desc: SessionDescription, then: (() -> Unit)?) {
        val pc = peerConnection ?: return
        pc.setRemoteDescription(object : SdpAdapter() {
            override fun onSetSuccess() {
                remoteDescrSet = true
                synchronized(pendingRemoteIce) {
                    for (c in pendingRemoteIce) {
                        pc.addIceCandidate(c)
                    }
                    pendingRemoteIce.clear()
                }
                then?.invoke()
            }
        }, desc)
    }

    fun end() {
        if (!ended.compareAndSet(false, true)) return

        main.removeCallbacksAndMessages(null)
        heartbeatRunnable = null

        main.post {
            try {
                signaling.sendCallEnd()
            } catch (_: Exception) {}
            signaling.disconnect()
            signaling.setListener(null)

            try { videoCapturer?.stopCapture() } catch (_: Exception) {}
            try { videoCapturer?.dispose() } catch (_: Exception) {}
            videoCapturer = null

            try { localPreview?.release() } catch (_: Exception) {}
            try { remoteView?.release() } catch (_: Exception) {}

            try { localVideoTrack?.dispose() } catch (_: Exception) {}
            localVideoTrack = null
            try { localAudioTrack?.dispose() } catch (_: Exception) {}
            localAudioTrack = null

            try { peerConnection?.close() } catch (_: Exception) {}
            peerConnection = null
            try { factoryRef?.dispose() } catch (_: Exception) {}
            factoryRef = null
            try { eglBase?.release() } catch (_: Exception) {}
            eglBase = null

            scope.cancel()
            callback.onEnded()
        }
    }

    private open class SdpAdapter : SdpObserver {
        override fun onCreateSuccess(p0: SessionDescription?) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(p0: String?) {}
        override fun onSetFailure(p0: String?) {}
    }

    companion object {
        private const val TAG = "WebRtcCallSession"
    }
}
