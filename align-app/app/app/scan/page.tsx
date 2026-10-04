"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QrCode, ScanLine, Check } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";
import {
  buildScanConnectUrl,
  parseScanConnectPayload,
} from "@/lib/scanConnectPayload";
import { CHAT_PRODUCTION_URL } from "@/lib/appUrl";

type Tab = "show" | "scan";

type ConnectOk = {
  ok: true;
  status: "connected" | "already_friends";
  user: { id: string; name?: string; username?: string };
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
    };
  }
}

export default function ScanConnectPage() {
  const { tStr } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("show");
  const [meId, setMeId] = useState<string | null>(null);
  const [meName, setMeName] = useState("");
  const [qrSrc, setQrSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ConnectOk | null>(null);
  const [cameraHint, setCameraHint] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const connectingRef = useRef(false);
  const autoFromQueryRef = useRef(false);

  useEffect(() => {
    try {
      const raw = getStoredUserRaw();
      if (!raw) return;
      const u = JSON.parse(raw) as User;
      const id = u?.id != null ? String(u.id).trim() : "";
      if (!id) return;
      setMeId(id);
      setMeName((u.username || u.name || "").trim());
      const origin =
        typeof window !== "undefined" ? window.location.origin : CHAT_PRODUCTION_URL;
      const url = buildScanConnectUrl(origin, id);
      setQrSrc(
        `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(url)}`
      );
    } catch {
      /* ignore */
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current != null) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const connectWithId = useCallback(
    async (otherId: string) => {
      if (connectingRef.current) return;
      if (meId && otherId === meId) {
        setError(tStr("pages.scanConnect.errSelf"));
        return;
      }
      connectingRef.current = true;
      setBusy(true);
      setError(null);
      stopCamera();
      try {
        const res = await fetchWithAuthRetry("/api/friends/scan-connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ friend_id: otherId }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          ok?: boolean;
          status?: "connected" | "already_friends";
          user?: { id: string; name?: string; username?: string };
        };
        if (!res.ok || !data.ok || !data.user?.id) {
          const msg = data.error?.trim() || tStr("pages.scanConnect.errGeneric");
          setError(translateApiErrorMessage(msg, tStr) || msg);
          return;
        }
        setSuccess({
          ok: true,
          status: data.status === "already_friends" ? "already_friends" : "connected",
          user: data.user,
        });
        setTab("show");
      } catch {
        setError(tStr("pages.scanConnect.errGeneric"));
      } finally {
        setBusy(false);
        connectingRef.current = false;
      }
    },
    [meId, stopCamera, tStr]
  );

  /** Deep link: /app/scan?u=<id> din camera telefonului / alt QR scanner */
  useEffect(() => {
    if (autoFromQueryRef.current || !meId) return;
    const u = searchParams.get("u")?.trim();
    if (!u) return;
    autoFromQueryRef.current = true;
    void connectWithId(u);
  }, [meId, searchParams, connectWithId]);

  const startCamera = useCallback(async () => {
    setError(null);
    setCameraHint(null);
    setSuccess(null);
    stopCamera();

    if (typeof window === "undefined" || !window.BarcodeDetector) {
      setCameraHint(tStr("pages.scanConnect.cameraUnsupported"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanLoopRef.current = requestAnimationFrame(() => {
            void tick();
          });
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes[0]?.rawValue;
          if (raw) {
            const id = parseScanConnectPayload(raw);
            if (id) {
              await connectWithId(id);
              return;
            }
            setError(tStr("pages.scanConnect.errInvalidCode"));
          }
        } catch {
          /* frame skip */
        }
        scanLoopRef.current = requestAnimationFrame(() => {
          void tick();
        });
      };
      scanLoopRef.current = requestAnimationFrame(() => {
        void tick();
      });
    } catch {
      setCameraHint(tStr("pages.scanConnect.cameraDenied"));
    }
  }, [connectWithId, stopCamera, tStr]);

  useEffect(() => {
    if (tab === "scan") {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [tab, startCamera, stopCamera]);

  const displayName =
    success?.user.username || success?.user.name || tStr("appNav.anonymousUser");

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 pb-24">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
        {tStr("pages.scanConnect.title")}
      </h1>
      <p className="mt-2 text-sm text-dark-500 leading-relaxed">
        {tStr("pages.scanConnect.subtitle")}
      </p>

      <div className="mt-5 flex rounded-xl border border-dark-600 bg-dark-800/80 p-1 gap-1">
        <button
          type="button"
          onClick={() => {
            setTab("show");
            setError(null);
          }}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            tab === "show"
              ? "bg-brand-500 text-zinc-900 shadow-sm"
              : "text-dark-500 hover:text-zinc-900"
          }`}
        >
          <QrCode className="h-4 w-4 shrink-0" aria-hidden />
          {tStr("pages.scanConnect.tabShow")}
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("scan");
            setError(null);
            setSuccess(null);
          }}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            tab === "scan"
              ? "bg-brand-500 text-zinc-900 shadow-sm"
              : "text-dark-500 hover:text-zinc-900"
          }`}
        >
          <ScanLine className="h-4 w-4 shrink-0" aria-hidden />
          {tStr("pages.scanConnect.tabScan")}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {success && (
        <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <div className="flex items-start gap-2">
            <Check className="h-5 w-5 shrink-0 text-teal-600 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">
                {success.status === "already_friends"
                  ? formatTpl(tStr("pages.scanConnect.alreadyFriends"), { name: displayName })
                  : formatTpl(tStr("pages.scanConnect.connected"), { name: displayName })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/app/user/${success.user.id}`}
                  className="inline-flex min-h-10 items-center rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-zinc-900"
                >
                  {tStr("pages.scanConnect.viewProfile")}
                </Link>
                <Link
                  href={`/app/chat/${success.user.id}`}
                  className="inline-flex min-h-10 items-center rounded-lg border border-dark-600 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                >
                  {tStr("pages.scanConnect.openChat")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "show" && (
        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="rounded-2xl border border-dark-600 bg-white p-4 shadow-sm">
            {qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrSrc}
                alt={tStr("pages.scanConnect.qrAlt")}
                width={280}
                height={280}
                className="block h-[min(70vw,280px)] w-[min(70vw,280px)]"
              />
            ) : (
              <div className="flex h-[280px] w-[280px] items-center justify-center text-sm text-dark-400">
                {tStr("pages.scanConnect.loadingCode")}
              </div>
            )}
          </div>
          {meName ? (
            <p className="text-sm text-dark-500">
              {formatTpl(tStr("pages.scanConnect.yourCodeFor"), { name: meName })}
            </p>
          ) : null}
          <p className="text-center text-xs text-dark-400 max-w-sm leading-relaxed">
            {tStr("pages.scanConnect.showHint")}
          </p>
        </div>
      )}

      {tab === "scan" && (
        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="relative w-full overflow-hidden rounded-2xl border border-dark-600 bg-zinc-900 aspect-square max-h-[70vw] max-w-[420px]">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              aria-label={tStr("pages.scanConnect.cameraAria")}
            />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 text-white text-sm font-medium">
                {tStr("pages.scanConnect.connecting")}
              </div>
            )}
          </div>
          {cameraHint && (
            <p className="text-center text-sm text-dark-500 max-w-sm">{cameraHint}</p>
          )}
          <p className="text-center text-xs text-dark-400 max-w-sm leading-relaxed">
            {tStr("pages.scanConnect.scanHint")}
          </p>
          <button
            type="button"
            onClick={() => void startCamera()}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            {tStr("pages.scanConnect.retryCamera")}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => router.back()}
        className="mt-8 text-sm text-dark-500 hover:text-zinc-900"
      >
        {tStr("pages.scanConnect.back")}
      </button>
    </div>
  );
}
