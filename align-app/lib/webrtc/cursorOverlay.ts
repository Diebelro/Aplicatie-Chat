/**
 * Cursor overlay (dot + label) over a shared video element via WebRTC DataChannel.
 * - Sender: normalized x/y in [0..1] relative to `containerEl`.
 * - Receiver: dot + label on `overlayHostEl` (wrapper over `<video>`).
 * - Throttle ~20fps + auto-hide + hide on mouseleave / cursor-hide message.
 *
 * Requires a negotiated DataChannel in the peer connection (not wired here).
 */

export type CursorMsg =
  | { t: "cursor"; x: number; y: number; label?: string }
  | { t: "cursor-hide" };

let cursorEnabled = false;

export function setCursorEnabled(enabled: boolean): void {
  cursorEnabled = enabled;
}

function isCursorMsg(raw: unknown): raw is CursorMsg {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as { t?: string };
  if (o.t === "cursor-hide") return true;
  if (o.t !== "cursor") return false;
  const x = (raw as { x?: unknown }).x;
  const y = (raw as { y?: unknown }).y;
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y);
}

export function attachCursorSender(opts: {
  dc: RTCDataChannel;
  containerEl: HTMLElement;
  label?: string;
  fps?: number;
}): () => void {
  const { dc, containerEl, label, fps = 20 } = opts;
  const minDt = 1000 / fps;
  let lastSend = 0;

  function send(msg: CursorMsg): void {
    if (dc.readyState !== "open") return;
    try {
      dc.send(JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }

  function onMove(e: MouseEvent): void {
    if (!cursorEnabled) return;
    if (dc.readyState !== "open") return;

    const now = performance.now();
    if (now - lastSend < minDt) return;
    lastSend = now;

    const r = containerEl.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (x < 0 || y < 0 || x > 1 || y > 1) return;

    send({ t: "cursor", x, y, label });
  }

  function onLeave(): void {
    if (!cursorEnabled) return;
    send({ t: "cursor-hide" });
  }

  containerEl.addEventListener("mousemove", onMove);
  containerEl.addEventListener("mouseleave", onLeave);

  return () => {
    containerEl.removeEventListener("mousemove", onMove);
    containerEl.removeEventListener("mouseleave", onLeave);
    send({ t: "cursor-hide" });
  };
}

export function attachCursorReceiver(opts: {
  dc: RTCDataChannel;
  overlayHostEl: HTMLElement;
  color?: string;
  hideAfterMs?: number;
  defaultLabel?: string;
}): () => void {
  const {
    dc,
    overlayHostEl,
    color = "#ff2d55",
    hideAfterMs = 1200,
    defaultLabel = "Prezentator",
  } = opts;

  const cs = getComputedStyle(overlayHostEl);
  if (cs.position === "static") overlayHostEl.style.position = "relative";

  const cursor = document.createElement("div");
  cursor.style.position = "absolute";
  cursor.style.left = "0";
  cursor.style.top = "0";
  cursor.style.transform = "translate(-9999px, -9999px)";
  cursor.style.pointerEvents = "none";
  cursor.style.zIndex = "9999";
  cursor.style.display = "none";

  const dot = document.createElement("div");
  dot.style.width = "12px";
  dot.style.height = "12px";
  dot.style.borderRadius = "9999px";
  dot.style.background = color;
  dot.style.boxShadow = "0 2px 10px rgba(0,0,0,0.35)";

  const tag = document.createElement("div");
  tag.style.marginTop = "6px";
  tag.style.padding = "2px 8px";
  tag.style.fontSize = "12px";
  tag.style.lineHeight = "16px";
  tag.style.borderRadius = "9999px";
  tag.style.background = "rgba(0,0,0,0.65)";
  tag.style.color = "white";
  tag.style.whiteSpace = "nowrap";
  tag.style.maxWidth = "220px";
  tag.style.overflow = "hidden";
  tag.style.textOverflow = "ellipsis";
  tag.style.display = "inline-block";

  cursor.appendChild(dot);
  cursor.appendChild(tag);
  overlayHostEl.appendChild(cursor);

  let hideTimer: number | null = null;

  function scheduleHide(): void {
    if (hideTimer != null) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      cursor.style.display = "none";
      hideTimer = null;
    }, hideAfterMs);
  }

  function hide(): void {
    cursor.style.display = "none";
    if (hideTimer != null) window.clearTimeout(hideTimer);
    hideTimer = null;
  }

  function showAt(nx: number, ny: number, label?: string): void {
    const xNorm = Math.min(1, Math.max(0, nx));
    const yNorm = Math.min(1, Math.max(0, ny));

    const r = overlayHostEl.getBoundingClientRect();
    const x = Math.round(xNorm * r.width);
    const y = Math.round(yNorm * r.height);

    const txt = label && label.trim().length ? label.trim() : defaultLabel;
    tag.textContent = txt;

    cursor.style.display = "block";
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    scheduleHide();
  }

  function onMessage(e: MessageEvent): void {
    let raw: unknown;
    try {
      raw = JSON.parse(String(e.data));
    } catch {
      return;
    }
    if (!isCursorMsg(raw)) return;

    if (raw.t === "cursor") showAt(raw.x, raw.y, raw.label);
    if (raw.t === "cursor-hide") hide();
  }

  dc.addEventListener("message", onMessage);

  return () => {
    dc.removeEventListener("message", onMessage);
    hide();
    cursor.remove();
  };
}
