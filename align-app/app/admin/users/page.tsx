"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/authClient";

type UserRow = { id: string; email: string; role: string; isBanned: boolean; createdAt: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    const url = "/api/admin/users?" + q.toString();
    fetch(url, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        const list = data.users ?? [];
        setUsers(list.map((u: UserRow & { createdAt: Date }) => ({ ...u, createdAt: u.createdAt ? new Date(u.createdAt).toLocaleString() : "" })));
      })
      .catch(() => setError("Eroare incarcare."))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Useri</h1>
      <input type="text" placeholder="Cauta email sau id" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-dark-700 border border-dark-600 rounded px-3 py-2 text-white w-full max-w-md mb-4" />
      {error && <p className="text-red-400 mb-2">{error}</p>}
      {loading ? <p className="text-dark-400">Se incarca...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border border-dark-600 rounded">
            <thead><tr className="bg-dark-700 text-left">
              <th className="p-2 border-b border-dark-600">Id</th>
              <th className="p-2 border-b border-dark-600">Email</th>
              <th className="p-2 border-b border-dark-600">Rol</th>
              <th className="p-2 border-b border-dark-600">Blocat</th>
              <th className="p-2 border-b border-dark-600">Creat</th>
              <th className="p-2 border-b border-dark-600">Actiuni</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-dark-600">
                  <td className="p-2 font-mono text-sm">{u.id.slice(0, 10)}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">{u.isBanned ? "Da" : "Nu"}</td>
                  <td className="p-2 text-dark-400 text-sm">{u.createdAt}</td>
                  <td className="p-2"><Link href={"/admin/users/" + u.id} className="text-brand-400 hover:underline">Detalii</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
