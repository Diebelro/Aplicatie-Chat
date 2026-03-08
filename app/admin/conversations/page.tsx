"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminConversationsListPage() {
  const router = useRouter();
  const [id, setId] = useState("");

  const go = () => {
    const v = id.trim();
    if (!v) return;
    router.push("/admin/conversations/" + encodeURIComponent(v));
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Vizualizare conversatie</h1>
      <p className="text-dark-400 mb-2">Introdu ID-ul conversatiei (format: userId1_userId2)</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="ex. clxx123_clyy456"
          className="bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white flex-1 max-w-md"
        />
        <button onClick={go} className="px-4 py-2 rounded bg-brand-500 text-dark-900 font-medium hover:bg-brand-400">
          Vezi conversatia
        </button>
      </div>
    </div>
  );
}
