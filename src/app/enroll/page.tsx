"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PasswordField from "@/components/PasswordField";

export default function EnrollPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (password !== confirmPassword) {
      setError("Passwords do not match"); setLoading(false); return;
    }

    try {
      const res = await fetch("/api/auth/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Enrollment failed");
        setLoading(false);
        return;
      }

      router.push("/pending");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="px-4 py-10">
        <div className="max-w-md mx-auto">
          <div className="card">
            <form onSubmit={handleSubmit}>
              <h2 className="text-2xl font-semibold mb-2">Enroll Now</h2>
              <p className="text-[var(--muted)] mb-6">
                Create your student account. Access starts as pending until an
                administrator activates it.
              </p>

              {error && <div className="alert error">{error}</div>}

              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <PasswordField label="Password" id="password" value={password} onChange={(e)=>setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              <PasswordField label="Confirm password" id="confirmPassword" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />

              <button
                type="submit"
                className="btn w-full mt-2"
                disabled={loading}
              >
                {loading ? "Creating account…" : "Enroll"}
              </button>

              <p className="mt-4 text-center text-sm text-[var(--muted)]">
                Already registered?{" "}
                <Link href="/login" className="font-semibold">
                  Login
                </Link>
              </p>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
