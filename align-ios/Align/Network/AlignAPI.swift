import Foundation

enum AlignAPIError: Error {
    case badStatus(Int, String)
    case decode
}

enum AlignAPI {
    static func fetchSignalingToken(session: String, userId: String) async throws -> String {
        let url = URL(string: "\(AlignConfig.apiBase)/api/call/signaling-token")!
        var req = URLRequest(url: url)
        req.addValue(session, forHTTPHeaderField: "x-session-token")
        req.addValue(userId, forHTTPHeaderField: "x-user-id")
        let (data, res) = try await URLSession.shared.data(for: req)
        guard let http = res as? HTTPURLResponse else { throw AlignAPIError.decode }
        guard http.statusCode == 200 else {
            throw AlignAPIError.badStatus(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let token = obj?["token"] as? String else { throw AlignAPIError.decode }
        return token
    }

    static func fetchIceServers(session: String, userId: String) async throws -> [[String: Any]] {
        let url = URL(string: "\(AlignConfig.apiBase)/api/call/ice-config")!
        var req = URLRequest(url: url)
        req.addValue(session, forHTTPHeaderField: "x-session-token")
        req.addValue(userId, forHTTPHeaderField: "x-user-id")
        let (data, res) = try await URLSession.shared.data(for: req)
        guard let http = res as? HTTPURLResponse, http.statusCode == 200 else {
            throw AlignAPIError.badStatus((res as? HTTPURLResponse)?.statusCode ?? 0, "")
        }
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let arr = obj?["iceServers"] as? [[String: Any]] else { throw AlignAPIError.decode }
        return arr
    }

    static func ringCallee(session: String, userId: String, toId: String, roomId: String, audioOnly: Bool) async throws {
        let url = URL(string: "\(AlignConfig.apiBase)/api/call/ring")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.addValue("application/json", forHTTPHeaderField: "Content-Type")
        req.addValue(session, forHTTPHeaderField: "x-session-token")
        req.addValue(userId, forHTTPHeaderField: "x-user-id")
        let body: [String: Any] = [
            "toId": toId,
            "roomId": roomId,
            "audioOnly": audioOnly,
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, res) = try await URLSession.shared.data(for: req)
        guard let http = res as? HTTPURLResponse else { throw AlignAPIError.decode }
        guard (200 ..< 300).contains(http.statusCode) else {
            throw AlignAPIError.badStatus(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
    }

    static func registerVoipToken(session: String, userId: String, voipToken: String) async throws {
        let url = URL(string: "\(AlignConfig.apiBase)/api/me/push-token")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.addValue("application/json", forHTTPHeaderField: "Content-Type")
        req.addValue(session, forHTTPHeaderField: "x-session-token")
        req.addValue(userId, forHTTPHeaderField: "x-user-id")
        let body: [String: Any] = ["apnsVoipToken": voipToken, "platform": "ios"]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, res) = try await URLSession.shared.data(for: req)
        guard let http = res as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            throw AlignAPIError.badStatus((res as? HTTPURLResponse)?.statusCode ?? 0, "")
        }
    }
}
