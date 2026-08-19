"use client";

import { useState } from "react";
import PasswordField from "@/components/PasswordField";

export default function SetupPage() {
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("");
    try {
      const res = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret }) });
      const data = await res.json();
      if (!res.ok) setMessage(data.error || "Setup failed");
      else setMessage(`Setup complete: ${data.totals.courses} course, ${data.totals.modules} modules, ${data.totals.lessons} lessons, ${data.totals.users} users.`);
    } catch { setMessage("Setup failed. Check the deployment logs."); }
    setLoading(false);
  }

  return <main className="px-4 py-16"><div className="card max-w-md mx-auto">
    <h1 className="text-2xl font-semibold mb-2">Database setup</h1>
    <p className="text-[var(--muted)] mb-6">Enter the private SETUP_SECRET configured in Vercel. This operation is safe to run more than once.</p>
    <form onSubmit={submit}>
      <PasswordField label="Setup secret" id="secret" value={secret} onChange={e=>setSecret(e.target.value)} required />
      {message && <div className="alert mb-4">{message}</div>}
      <button className="btn w-full" type="submit" disabled={loading}>{loading ? "Setting up…" : "Initialize database"}</button>
    </form>
  </div></main>;
}
