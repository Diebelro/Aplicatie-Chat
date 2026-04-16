"use client";

import type { Dispatch, SetStateAction } from "react";

export type CursorDcRefs = {
  p2pCursorDcRef: { current: RTCDataChannel | null };
};

/**
 * P2P: `align-cursor` DataChannel — extras din useWebRtcCall (Checkpoint 1).
 * Conectat în useWebRtcCall la Checkpoint 3C; până atunci acest modul nu e importat.
 */
export function bindP2pCursorDataChannel(params: {
  pc: RTCPeerConnection;
  cursorChannelOfferer: boolean;
  refs: CursorDcRefs;
  setCursorDataChannel: Dispatch<SetStateAction<RTCDataChannel | null>>;
}): void {
  const { pc, cursorChannelOfferer, refs, setCursorDataChannel } = params;

  const bindCursorDc = (dc: RTCDataChannel) => {
    refs.p2pCursorDcRef.current = dc;
    const markOpen = () => {
      if (dc.readyState === "open") setCursorDataChannel(dc);
    };
    dc.addEventListener("open", markOpen);
    markOpen();
  };

  if (cursorChannelOfferer) {
    try {
      const cdc = pc.createDataChannel("align-cursor", { ordered: false });
      bindCursorDc(cdc);
    } catch (e) {
      console.warn("[RTC] align-cursor DataChannel create failed", e);
    }
  } else {
    pc.ondatachannel = (ev: RTCDataChannelEvent) => {
      if (ev.channel.label !== "align-cursor") return;
      bindCursorDc(ev.channel);
    };
  }
}
