"use client";

import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Dashboard Admin</h1>
      <ul className="space-y-2">
        <li>
          <Link href="/admin/users" className="text-brand-400 hover:underline">
            Gestionează useri
          </Link>
        </li>
        <li>
          <Link href="/admin/reports" className="text-brand-400 hover:underline">
            Rapoarte
          </Link>
        </li>
        <li>
          <Link href="/admin/logs" className="text-brand-400 hover:underline">
            Loguri acțiuni admin
          </Link>
        </li>
        <li>
          <Link href="/admin/conversations" className="text-brand-400 hover:underline">
            Vizualizare conversație (id: userId1_userId2)
          </Link>
        </li>
      </ul>
    </div>
  );
}
