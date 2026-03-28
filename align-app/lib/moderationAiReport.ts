/**
 * Raport AI pentru moderare: doar clasificare / note pentru revizuire umană.
 * Nu declanșează sancțiuni; apelurile se fac doar server-side.
 */

export type AiModerationFlag =
  | "none"
  | "threats"
  | "sexual"
  | "insults"
  | "minors"
  | "spam"
  | "harassment"
  | "scams"
  | "illegal_trade"
  | "bot_automation";

export type AiModerationItem = {
  id: string;
  flags: AiModerationFlag[];
  note_ro: string;
};

function parseItems(raw: unknown): AiModerationItem[] {
  if (!raw || typeof raw !== "object") return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: AiModerationItem[] = [];
  const valid: AiModerationFlag[] = [
    "none",
    "threats",
    "sexual",
    "insults",
    "minors",
    "spam",
    "harassment",
    "scams",
    "illegal_trade",
    "bot_automation",
  ];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const id = String((it as { id?: unknown }).id ?? "");
    if (!id) continue;
    const flagsRaw = (it as { flags?: unknown }).flags;
    const flags: AiModerationFlag[] = Array.isArray(flagsRaw)
      ? flagsRaw
          .filter((f): f is AiModerationFlag => typeof f === "string" && valid.includes(f as AiModerationFlag))
      : ["none"];
    const note_roRaw = (it as { note_ro?: unknown }).note_ro;
    const note_ro = typeof note_roRaw === "string" ? note_roRaw.slice(0, 200) : "";
    out.push({ id, flags: flags.length ? flags : ["none"], note_ro });
  }
  return out;
}

export function isOpenAiModerationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Severitate de sortare/filtrare (euristică din etichete; nu înlocuiește judecata moderatorului). */
export function deriveAiSeverity(flags: AiModerationFlag[]): "low" | "medium" | "high" {
  const f = new Set(flags);
  if (
    f.has("minors") ||
    f.has("threats") ||
    f.has("scams") ||
    f.has("illegal_trade")
  ) {
    return "high";
  }
  if (
    f.has("sexual") ||
    f.has("harassment") ||
    f.has("insults") ||
    f.has("bot_automation")
  ) {
    return "medium";
  }
  if (f.has("spam")) return "low";
  return "low";
}

export type ThreadBriefResult = {
  summary_ro: string;
  concerns: string[];
  severity_hint: "low" | "medium" | "high";
};

function parseThreadBrief(raw: unknown): ThreadBriefResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const summary_ro = typeof o.summary_ro === "string" ? o.summary_ro.trim().slice(0, 1200) : "";
  const sevRaw = o.severity_hint;
  const severity_hint: "low" | "medium" | "high" =
    sevRaw === "high" || sevRaw === "medium" || sevRaw === "low" ? sevRaw : "low";
  const concernsRaw = o.concerns;
  const concerns: string[] = Array.isArray(concernsRaw)
    ? concernsRaw
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (!summary_ro && concerns.length === 0) return null;
  return { summary_ro, concerns, severity_hint };
}

/**
 * Rezumat contextual pentru moderator din transcript anonimizat (participant_left / participant_right).
 */
export async function openAiModerationThreadBrief(transcript: string): Promise<ThreadBriefResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY lipsă");

  let t = transcript.trim();
  if (t.length > 14000) t = t.slice(-14000);

  const model =
    process.env.OPENAI_MODERATION_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Ești asistent pentru un moderator uman (app dating, română).
Primești un transcript: linii cu [ISO] participant_left / participant_right (ordine stabilă după ID, nu nume reale).
Răspunde DOAR JSON: {"summary_ro":"2-4 propoziții în română","concerns":["max 6 puncte scurte"],"severity_hint":"low"|"medium"|"high"}.
severity_hint: high = amenințări, minori/grooming, înșelăciune/țeapă, droguri sau comerț ilegal clar, furt de bunuri; medium = insulte repetate, presiune, conținut sexual inadecvat, conturi ce par bot/script/AI sau mesaje evident automate; low = conflict minor sau transcript benign.
Nu inventa mesaje absente. Nu recomanda sancțiuni penale; doar descrie ce apare.`,
        },
        { role: "user", content: t },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 280)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") throw new Error("Răspuns AI gol");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Răspuns AI nu e JSON valid");
  }

  const brief = parseThreadBrief(parsed);
  if (!brief) throw new Error("Format rezumat invalid");
  return brief;
}

export async function openAiModerationClassifyBatch(
  items: { id: string; text: string }[]
): Promise<AiModerationItem[]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY lipsă");

  const truncated = items.map((i) => ({
    id: i.id,
    text: i.text.slice(0, 800),
  }));

  const model =
    process.env.OPENAI_MODERATION_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Ești asistent pentru un moderator uman al unei aplicații de dating/chat în română.
Primești JSON: {"messages":[{"id":"...","text":"..."}]}.
Răspunde DOAR cu JSON valid: {"items":[{"id":"același id","flags":["none"|"threats"|"sexual"|"insults"|"minors"|"spam"|"harassment"|"scams"|"illegal_trade"|"bot_automation"],"note_ro":"max 100 caractere, română"}]}.
Reguli obligatorii:
- Nu recomanzi sancțiuni sau ștergeri — doar clasifici pentru revizuire umană.
- "minors" doar pentru indicii serioși (vârstă minoră explicată, grooming, solicitări inappropriate față de minori).
- "scams": înșelăciune, țeapă, cereri de bani/card/OTP, investiții false, mosteniri suspecte, phishing.
- "illegal_trade": droguri, dealeri, cumpărare/vânzare substanțe, arme, bunuri furate, acte false — doar dacă e explicit sau foarte probabil.
- "bot_automation": mesajele par generate automat, script, chatbot, recunoaște că nu e om, tool-uri de masă (selenium etc.), sau tipar tip șabloane de scam combinat cu lipsă umană evidentă.
- Mesaj benign: flags ["none"] și note_ro foarte scurt.
- Un singur rând în items pentru fiecare id din intrare; nu omiți id-uri.`,
        },
        { role: "user", content: JSON.stringify({ messages: truncated }) },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 280)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") throw new Error("Răspuns AI gol");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Răspuns AI nu e JSON valid");
  }

  return parseItems(parsed);
}
