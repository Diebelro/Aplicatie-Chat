/**
 * Moderare imagini de PROFIL: blochează nuditate / conținut sexual pe profil public.
 * Nu se folosește pentru chat (acolo e liber).
 * 1) OpenAI omni-moderation dacă există OPENAI_API_KEY
 * 2) Altfel: heuristică locală (skin-tone + sharp)
 */

import sharp from "sharp";

export type ImageModerationResult =
  | { ok: true }
  | { ok: false; reason: "nsfw" | "unavailable" | "invalid"; message: string };

const NSFW_MSG = "Imaginea conține conținut sexual / nuditate și nu este permisă.";

function dataUrlToBuffer(dataUrl: string): { mime: string; buf: Buffer } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return { mime: m[1].toLowerCase(), buf: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

function isSexualFlagged(
  categories: Record<string, boolean> | undefined,
  scores: Record<string, number> | undefined
): boolean {
  if (!categories && !scores) return false;
  const sexualKeys = ["sexual", "sexual/minors"];
  for (const k of sexualKeys) {
    if (categories?.[k] === true) return true;
    const score = scores?.[k];
    if (typeof score === "number" && score >= 0.55) return true;
  }
  return false;
}

/** Skin în spațiul YCbCr (interval clasic pentru piele). */
function isSkinYCbCr(r: number, g: number, b: number): boolean {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 40 && y < 240 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

/**
 * Heuristică locală: raport piele ridicat + centru saturat cu piele
 * (tipic poze genitale / nuditate frontală). Nu e ML — OpenAI e preferat.
 */
export async function localHeuristicLikelyNsfw(imageBuf: Buffer): Promise<boolean> {
  const { data, info } = await sharp(imageBuf)
    .rotate()
    .resize(96, 96, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const channels = info.channels;
  if (channels < 3 || w < 8 || h < 8) return false;

  let skin = 0;
  let total = 0;
  let centerSkin = 0;
  let centerTotal = 0;
  const x0 = Math.floor(w * 0.25);
  const x1 = Math.floor(w * 0.75);
  const y0 = Math.floor(h * 0.2);
  const y1 = Math.floor(h * 0.85);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const skinPx = isSkinYCbCr(r, g, b);
      total += 1;
      if (skinPx) skin += 1;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        centerTotal += 1;
        if (skinPx) centerSkin += 1;
      }
    }
  }

  const skinRatio = skin / total;
  const centerRatio = centerTotal > 0 ? centerSkin / centerTotal : 0;

  // Praguri conservatoare: blochează doar cazuri foarte clare
  if (skinRatio >= 0.72 && centerRatio >= 0.78) return true;
  if (skinRatio >= 0.68 && centerRatio >= 0.82) return true;
  return false;
}

async function resolveImageBuffer(imageUrl: string): Promise<Buffer | null> {
  const url = String(imageUrl ?? "").trim();
  if (!url) return null;
  if (url.startsWith("data:")) {
    const parsed = dataUrlToBuffer(url);
    if (!parsed || parsed.buf.length < 32) return null;
    if (parsed.buf.length > 6_000_000) return null;
    return parsed.buf;
  }
  let fetchUrl = url;
  if (url.startsWith("/") && !url.startsWith("//")) {
    const { getPublicAppUrl } = await import("@/lib/appUrl");
    fetchUrl = `${getPublicAppUrl().replace(/\/$/, "")}${url}`;
  }
  if (!/^https?:\/\//i.test(fetchUrl)) return null;
  try {
    const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 32 || ab.byteLength > 6_000_000) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function moderateWithOpenAI(inputUrl: string, apiKey: string): Promise<ImageModerationResult | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: [{ type: "image_url", image_url: { url: inputUrl } }],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[imageNsfw] moderation HTTP", res.status, text.slice(0, 300));
      return null; // fallback local
    }

    const data = (await res.json()) as {
      results?: Array<{
        flagged?: boolean;
        categories?: Record<string, boolean>;
        category_scores?: Record<string, number>;
      }>;
    };
    const result = data.results?.[0];
    if (isSexualFlagged(result?.categories, result?.category_scores)) {
      return { ok: false, reason: "nsfw", message: NSFW_MSG };
    }
    return { ok: true };
  } catch (e) {
    console.error("[imageNsfw] moderation error", e);
    return null;
  }
}

/**
 * Verifică o imagine (data URL sau URL http(s) / path public).
 */
export async function moderateImageUrl(imageUrl: string): Promise<ImageModerationResult> {
  const url = String(imageUrl ?? "").trim();
  if (!url) return { ok: false, reason: "invalid", message: "Imagine invalidă." };

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  // OpenAI preferat (când e setat)
  if (apiKey) {
    let openaiUrl = url;
    if (url.startsWith("/") && !url.startsWith("//")) {
      const { getPublicAppUrl } = await import("@/lib/appUrl");
      openaiUrl = `${getPublicAppUrl().replace(/\/$/, "")}${url}`;
    }
    if (url.startsWith("data:")) {
      const parsed = dataUrlToBuffer(url);
      if (!parsed) return { ok: false, reason: "invalid", message: "Imagine invalidă." };
      if (parsed.buf.length > 4_000_000) {
        return { ok: false, reason: "invalid", message: "Imaginea este prea mare." };
      }
      openaiUrl = `data:${parsed.mime};base64,${parsed.buf.toString("base64")}`;
    }
    const openaiResult = await moderateWithOpenAI(openaiUrl, apiKey);
    if (openaiResult) return openaiResult;
  } else {
    console.warn("[imageNsfw] OPENAI_API_KEY lipsește — folosesc heuristică locală");
  }

  // Fallback local (și când OpenAI e down)
  const buf = await resolveImageBuffer(url);
  if (!buf) {
    return { ok: false, reason: "invalid", message: "Imagine invalidă." };
  }
  try {
    const bad = await localHeuristicLikelyNsfw(buf);
    if (bad) return { ok: false, reason: "nsfw", message: NSFW_MSG };
    return { ok: true };
  } catch (e) {
    console.error("[imageNsfw] local heuristic error", e);
    return {
      ok: false,
      reason: "unavailable",
      message: "Nu am putut verifica imaginea. Încearcă din nou.",
    };
  }
}

/** Verifică o listă de poze (data URL / URL). Oprește la primul NSFW. */
export async function moderateImageList(urls: string[]): Promise<ImageModerationResult> {
  for (const u of urls) {
    if (typeof u !== "string" || !u.trim()) continue;
    if (u.startsWith("/avatars/") || u.startsWith("/icons/")) continue;
    const r = await moderateImageUrl(u);
    if (!r.ok) return r;
  }
  return { ok: true };
}
