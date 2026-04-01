import Foundation
import WebRTC

/// Protocol compatibil cu `server/call-signaling-server.mjs`.
final class SignalingWebSocket: NSObject, URLSessionWebSocketDelegate {
    private var session: URLSession!
    private var task: URLSessionWebSocketTask?
    var onJson: (([String: Any]) -> Void)?
    var onConnected: (() -> Void)?

    func connect(url: URL) {
        let cfg = URLSessionConfiguration.default
        session = URLSession(configuration: cfg, delegate: self, delegateQueue: .main)
        task = session.webSocketTask(with: url)
        task?.resume()
    }

    func disconnect() {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func receiveLoop() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                if case .string(let text) = message,
                   let data = text.data(using: .utf8),
                   let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    self.onJson?(obj)
                }
                self.receiveLoop()
            case .failure:
                break
            }
        }
    }

    private func send(_ obj: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: obj),
              let s = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(s)) { _ in }
    }

    func sendJoin(roomId: String, userId: String, isCaller: Bool) {
        send(["t": "join", "roomId": roomId, "userId": userId, "isCaller": isCaller])
    }

    func sendOffer(sdp: String, to: String) {
        send(["t": "offer", "sdp": sdp, "to": to])
    }

    func sendAnswer(sdp: String, to: String) {
        send(["t": "answer", "sdp": sdp, "to": to])
    }

    func sendIce(candidate: RTCIceCandidate, to: String) {
        let c: [String: Any] = [
            "candidate": candidate.sdp,
            "sdpMid": candidate.sdpMid ?? "",
            "sdpMLineIndex": candidate.sdpMLineIndex,
        ]
        send(["t": "ice", "candidate": c, "to": to])
    }

    func sendCallEnd() {
        send(["t": "call-end"])
    }

    func sendHeartbeat() {
        send(["t": "heartbeat"])
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        receiveLoop()
        onConnected?()
    }
}
