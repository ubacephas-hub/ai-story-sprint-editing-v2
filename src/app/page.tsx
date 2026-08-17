import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let user = null;
  try {
    const session = await getSession();
    user = session?.user ?? null;
  } catch {
    // DB not yet ready — show public page
  }

  return (
    <>
      <Navbar user={user} />
      <main className="px-4">
        <section className="min-h-[70vh] grid place-items-center text-center">
          <div className="max-w-[700px]">
            <p className="text-[var(--brand)] font-extrabold uppercase tracking-[0.08em] text-xs mb-3">
              Online video course
            </p>
            <h1 className="text-[clamp(28px,5vw,46px)] font-semibold leading-[1.05] mb-4">
              AI StorySprint Editing
            </h1>
            <p className="text-lg text-[var(--muted)]">
              Master the AI StorySprint editing workflow.
            </p>
            <div className="flex flex-wrap gap-3 mt-6 justify-center">
              <Link href="/enroll" className="btn no-underline">
                Enroll Now
              </Link>
              <Link href="/login" className="btn secondary no-underline">
                Login
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-10">
              <div className="bg-white border border-[var(--line)] rounded-xl p-5">
                <strong className="block text-xl">4</strong>
                <span className="text-[var(--muted)] text-sm">Modules</span>
              </div>
              <div className="bg-white border border-[var(--line)] rounded-xl p-5">
                <strong className="block text-xl">8</strong>
                <span className="text-[var(--muted)] text-sm">
                  Video Lessons
                </span>
              </div>
              <div className="bg-white border border-[var(--line)] rounded-xl p-5">
                <strong className="block text-xl">2</strong>
                <span className="text-[var(--muted)] text-sm">
                  Laptop + Phone Workflows
                </span>
              </div>
              <div className="bg-white border border-[var(--line)] rounded-xl p-5">
                <strong className="block text-xl">✓</strong>
                <span className="text-[var(--muted)] text-sm">
                  Supporting Resources
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
