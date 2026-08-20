"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PasswordField from "@/components/PasswordField";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20_000);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({ email: email.trim(), password }),
      });
      window.clearTimeout(timeout);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      if (data.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof DOMException && err.name === "AbortError"
        ? "Login timed out. Check the database connection and try again."
        : "Something went wrong. Please try again.");
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
              <h2 className="text-2xl font-semibold mb-2">Welcome back</h2>
              <p className="text-[var(--muted)] mb-6">
                Log in to continue your course.
              </p>

              {error && <div className="alert error">{error}</div>}

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

              <PasswordField label="Password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />

              <button
                type="submit"
                className="btn w-full mt-2"
                disabled={loading}
              >
                {loading ? "Logging in…" : "Login"}
              </button>

              <p className="mt-4 text-center text-sm"><Link href="/forgot-password" className="font-semibold">Forgot password?</Link></p>
              <p className="mt-3 text-center text-sm text-[var(--muted)]">
                New here?{" "}
                <Link href="/enroll" className="font-semibold">
                  Create an account
                </Link>
              </p>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
