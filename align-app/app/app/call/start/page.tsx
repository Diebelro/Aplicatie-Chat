"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Video, Users, Search, X, Loader2, ArrowRight } from "lucide-react";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { getConferenceRoomId } from "@/lib/videoCall";
import { displayName } from "@/lib/displayName";

type ProfileRow = {
  id: string;
  name: string;
  username: string;
  online?: boolean;
};

export default function StartConferencePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [invitees, setInvitees] = useState<ProfileRow[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ name: debounced });
    void fetchWithAuthRetry(`/api/profiles?${params}`, { cache: "no-store" })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setResults([]);
          return;
        }
        const d = (await r.json()) as { profiles?: ProfileRow[] };
        const list = Array.isArray(d.profiles) ? d.profiles : [];
        setResults(list.filter((p) => p.id).slice(0, 25));
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const addInvitee = useCallback((p: ProfileRow) => {
    setInvitees((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
  }, []);

  const removeInvitee = useCallback((id: string) => {
    setInvitees((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const startConference = useCallback(
    async (withInvites: boolean) => {
      setError(null);
      const roomId = getConferenceRoomId();
      if (withInvites && invitees.length === 0) return;
      setStarting(true);
      try {
        if (withInvites && invitees.length > 0) {
          await Promise.all(
            invitees.map((u) =>
              fetchWithAuthRetry("/api/call/ring", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  toId: u.id,
                  roomId,
                  audioOnly: false,
                }),
              })
            )
          );
        }
        router.push(`/app/call/${roomId}`);
      } catch {
        setError("Nu am putut porni conferința. Încearcă din nou.");
      } finally {
        setStarting(false);
      }
    },
    [invitees, router]
  );

  return (
    <div className="min-h-[100dvh] bg-dark-900 text-white px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        <Link href="/app/messages" className="text-brand-400 text-sm hover:underline inline-flex items-center gap-1">
          ← Înapoi la mesaje
        </Link>

        <div className="mt-6 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Conferință video</h1>
            <p className="text-dark-400 text-sm mt-1 leading-relaxed">
              Caută participanți după nume sau @username, îi inviți la apel, apoi intri în sală. Camera și microfonul se pornesc
              <span className="text-dark-300"> după ce apeși „Intră în conferință”</span> — la fel ca la apelul normal, după ce accepti.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <label className="block text-sm text-dark-400">Caută utilizatori</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Minim 2 caractere (nume sau @username)"
              className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-10 pr-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoComplete="off"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-400 animate-spin" />
            )}
          </div>
          {debounced.length > 0 && debounced.length < 2 && (
            <p className="text-dark-500 text-xs">Continuă să scrii pentru căutare…</p>
          )}
        </div>

        {invitees.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-dark-400 mb-2">Invitați ({invitees.length}) — primesc apel ca la un apel normal</p>
            <div className="flex flex-wrap gap-2">
              {invitees.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => removeInvitee(u.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 border border-brand-500/35 pl-3 pr-2 py-1.5 text-sm text-brand-100 hover:bg-brand-500/25 transition"
                >
                  <Video className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  {displayName(u.username || u.name)}
                  <X className="w-4 h-4 text-brand-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {results.filter((p) => !invitees.some((i) => i.id === p.id)).length > 0 && (
          <ul className="mt-4 rounded-xl border border-dark-600 bg-dark-800/50 divide-y divide-dark-600 max-h-60 overflow-y-auto">
            {results
              .filter((p) => !invitees.some((i) => i.id === p.id))
              .map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{displayName(p.username || p.name)}</p>
                  <p className="text-xs text-dark-500 truncate">@{p.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addInvitee(p)}
                  className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30"
                >
                  Invită
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            disabled={starting || invitees.length === 0}
            onClick={() => void startConference(true)}
            title={invitees.length === 0 ? "Adaugă mai întâi invitați din listă" : undefined}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-500 text-dark-900 font-semibold hover:bg-brand-400 disabled:opacity-50 transition"
          >
            {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            Sună invitații și intră în conferință
          </button>
          <button
            type="button"
            disabled={starting}
            onClick={() => void startConference(false)}
            className="w-full py-3 rounded-xl border border-dark-500 text-dark-300 hover:bg-dark-800 text-sm disabled:opacity-50"
          >
            Intră singur în sală (fără invitații)
          </button>
        </div>

        <p className="mt-8 text-dark-500 text-xs leading-relaxed">
          Dacă ți-a apărut mesajul despre permisiuni microfon/cameră: e setarea browserului/telefonului (lacăt în bara de adresă), nu o problemă a aplicației. După ce permiți o dată pentru acest site, merge și la conferință.
        </p>
      </div>
    </div>
  );
}
