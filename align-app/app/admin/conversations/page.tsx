"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function conversationIdFromUserIds(a: string, b: string): string {
  const x = a.trim();
  const y = b.trim();
  if (!x || !y || x === y) return "";
  return [x, y].sort().join("_");
}

function AdminConversationsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userA, setUserA] = useState("");
  const [userB, setUserB] = useState("");

  useEffect(() => {
    const withId = searchParams.get("with")?.trim();
    if (withId) setUserA(withId);
  }, [searchParams]);

  const go = () => {
    const id = conversationIdFromUserIds(userA, userB);
    if (!id) return;
    router.push("/admin/conversations/" + encodeURIComponent(id));
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Vizualizare conversație</h1>
      <p className="text-dark-400 mb-4 text-sm max-w-xl">
        Introdu <strong>ambele</strong> ID-uri de utilizator (cei doi din chat). Poți copia ID-ul din pagina de detaliu
        user (/admin/users/…) sau din rapoarte. Apoi vezi mesajele înainte de Ban / Ștergere.
      </p>
      <div className="flex flex-col gap-3 max-w-md">
        <div>
          <label className="block text-xs text-dark-500 mb-1">ID utilizator 1</label>
          <input
            type="text"
            value={userA}
            onChange={(e) => setUserA(e.target.value)}
            placeholder="ex. clxx123…"
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-dark-500 mb-1">ID utilizator 2</label>
          <input
            type="text"
            value={userB}
            onChange={(e) => setUserB(e.target.value)}
            placeholder="ex. clyy456…"
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white font-mono text-sm"
          />
        </div>
        <button
          type="button"
          onClick={go}
          disabled={!conversationIdFromUserIds(userA, userB)}
          className="px-4 py-2 rounded bg-brand-500 text-dark-900 font-medium hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed w-fit"
        >
          Vezi conversația
        </button>
      </div>
      <p className="text-dark-500 text-xs mt-6 max-w-lg">
        Alternativ (dacă știi deja șirul): poți merge direct la{" "}
        <code className="text-dark-400">/admin/conversations/id1_id2</code> (ordinea nu contează).
      </p>
    </div>
  );
}

export default function AdminConversationsListPage() {
  return (
    <Suspense fallback={<p className="text-dark-400">Se încarcă...</p>}>
      <AdminConversationsForm />
    </Suspense>
  );
}
