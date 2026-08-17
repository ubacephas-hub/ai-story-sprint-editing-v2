"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface NavbarProps {
  user?: {
    name: string;
    role: string;
  } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-[var(--line)] sticky top-0 z-50">
      <nav className="w-[min(1080px,calc(100%-32px))] mx-auto min-h-[66px] flex items-center gap-5">
        <Link
          href="/"
          className="font-extrabold text-[var(--ink)] mr-auto no-underline"
        >
          AI StorySprint Editing
        </Link>
        <div className="flex gap-2 items-center">
          {user ? (
            <>
              {user.role === "admin" ? (
                <Link
                  href="/admin"
                  className="px-3 py-2.5 text-[var(--muted)] font-semibold rounded-lg hover:bg-[var(--bg)] hover:text-[var(--ink)] no-underline"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="px-3 py-2.5 text-[var(--muted)] font-semibold rounded-lg hover:bg-[var(--bg)] hover:text-[var(--ink)] no-underline"
                >
                  Dashboard
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-2.5 text-[var(--muted)] font-semibold rounded-lg hover:bg-[var(--bg)] hover:text-[var(--ink)] cursor-pointer bg-transparent border-0 text-[15px]"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/enroll"
                className="px-3 py-2.5 text-[var(--muted)] font-semibold rounded-lg hover:bg-[var(--bg)] hover:text-[var(--ink)] no-underline"
              >
                Enroll
              </Link>
              <Link
                href="/login"
                className="px-3 py-2.5 text-[var(--muted)] font-semibold rounded-lg hover:bg-[var(--bg)] hover:text-[var(--ink)] no-underline"
              >
                Login
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
