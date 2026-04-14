import { describe, expect, it } from "vitest";
import {
  findVideoRemoteInboundForOutbound,
  uplinkBitrateFromOutboundBytes,
} from "@/lib/webrtc/sampleCallQuality";

function mockReport(entries: Array<[string, unknown]>): RTCStatsReport {
  const m = new Map<string, unknown>();
  for (const [id, v] of entries) m.set(id, v);
  return m as unknown as RTCStatsReport;
}

describe("findVideoRemoteInboundForOutbound", () => {
  it("links remote-inbound-rtp to outbound-rtp via localId", () => {
    const report = mockReport([
      [
        "out1",
        {
          type: "outbound-rtp",
          id: "out1",
          kind: "video",
          bytesSent: 1000,
        },
      ],
      [
        "rim1",
        {
          type: "remote-inbound-rtp",
          id: "rim1",
          kind: "video",
          localId: "out1",
          packetsLost: 2,
          jitter: 0.01,
          roundTripTime: 0.08,
        },
      ],
    ]);
    const rim = findVideoRemoteInboundForOutbound(report, "out1");
    expect(rim).not.toBeNull();
    expect((rim as { packetsLost?: number }).packetsLost).toBe(2);
    expect((rim as { localId?: string }).localId).toBe("out1");
  });

  it("returns null when no remote-inbound matches", () => {
    const report = mockReport([
      ["out1", { type: "outbound-rtp", id: "out1", kind: "video", bytesSent: 1 }],
    ]);
    expect(findVideoRemoteInboundForOutbound(report, "out1")).toBeNull();
  });
});

describe("uplinkBitrateFromOutboundBytes", () => {
  it("computes bitrate from bytesSent delta", () => {
    const bps = uplinkBitrateFromOutboundBytes(12_500, 2500, 1);
    expect(bps).toBe(80_000);
  });

  it("returns 0 for non-positive dt", () => {
    expect(uplinkBitrateFromOutboundBytes(100, 0, 0)).toBe(0);
  });
});
