/** Serializes SDP/ICE mutations per peer to avoid glare and half-applied states during ICE restart. */
export function createNegotiationMutex(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return function withNegotiationLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn, fn) as Promise<T>;
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}

export type GlareMetrics = {
  glareDetectedCount: number;
  rollbackAttemptedCount: number;
  rollbackFailedCount: number;
};

export function emptyGlareMetrics(): GlareMetrics {
  return { glareDetectedCount: 0, rollbackAttemptedCount: 0, rollbackFailedCount: 0 };
}

export type OfferGlareResolution = "proceed" | "ignore_incoming" | "defer_incoming";

/**
 * Perfect negotiation helper: polite peer rolls back local offer on glare.
 * If rollback throws (Safari / invalid state), defer applying the remote offer until `stable`.
 * Impolite peer ignores the colliding inbound offer while holding a local offer.
 */
export async function resolveOfferGlare(
  pc: RTCPeerConnection,
  polite: boolean,
  metrics: GlareMetrics
): Promise<OfferGlareResolution> {
  if (pc.signalingState !== "have-local-offer") return "proceed";
  metrics.glareDetectedCount += 1;
  if (!polite) return "ignore_incoming";
  metrics.rollbackAttemptedCount += 1;
  try {
    await pc.setLocalDescription({ type: "rollback" });
    return "proceed";
  } catch {
    metrics.rollbackFailedCount += 1;
    return "defer_incoming";
  }
}
