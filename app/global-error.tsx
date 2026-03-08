"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ro">
      <body style={{ margin: 0, fontFamily: "system-ui", background: "#0f0f0f", color: "#e5e5e5", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: 8 }}>Eroare aplicație</h1>
        <p style={{ color: "#737373", fontSize: 14, marginBottom: 24, textAlign: "center" }}>
          A apărut o eroare gravă. Reîmprospătează pagina.
        </p>
        <button
          onClick={() => reset()}
          style={{ padding: "8px 16px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontSize: 14, cursor: "pointer" }}
        >
          Reîmprospătează
        </button>
      </body>
    </html>
  );
}
