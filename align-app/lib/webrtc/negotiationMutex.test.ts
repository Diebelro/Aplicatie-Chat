import { describe, expect, it, vi } from "vitest";
import { emptyGlareMetrics, resolveOfferGlare } from "@/lib/webrtc/negotiationMutex";

describe("resolveOfferGlare", () => {
  it("proceeds when not in have-local-offer", async () => {
    const pc = { signalingState: "stable" } as RTCPeerConnection;
    const m = emptyGlareMetrics();
    expect(await resolveOfferGlare(pc, true, m)).toBe("proceed");
    expect(m.glareDetectedCount).toBe(0);
  });

  it("ignore_incoming when impolite and glare", async () => {
    const pc = { signalingState: "have-local-offer" } as RTCPeerConnection;
    const m = emptyGlareMetrics();
    expect(await resolveOfferGlare(pc, false, m)).toBe("ignore_incoming");
    expect(m.glareDetectedCount).toBe(1);
    expect(m.rollbackAttemptedCount).toBe(0);
  });

  it("proceeds when polite and rollback succeeds", async () => {
    const setLocalDescription = vi.fn().mockResolvedValue(undefined);
    const pc = { signalingState: "have-local-offer", setLocalDescription } as unknown as RTCPeerConnection;
    const m = emptyGlareMetrics();
    expect(await resolveOfferGlare(pc, true, m)).toBe("proceed");
    expect(setLocalDescription).toHaveBeenCalledWith({ type: "rollback" });
    expect(m.rollbackFailedCount).toBe(0);
  });

  it("defer_incoming when rollback throws", async () => {
    const setLocalDescription = vi.fn().mockRejectedValue(new Error("InvalidStateError"));
    const pc = { signalingState: "have-local-offer", setLocalDescription } as unknown as RTCPeerConnection;
    const m = emptyGlareMetrics();
    expect(await resolveOfferGlare(pc, true, m)).toBe("defer_incoming");
    expect(m.rollbackFailedCount).toBe(1);
  });
});
