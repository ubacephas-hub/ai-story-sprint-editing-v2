import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courseAccess } from "@/db/schema";
import { eq } from "drizzle-orm";
export const dynamic="force-dynamic";
export default async function PendingPage(){const session=await getSession();if(!session)redirect("/login");const access=await db.select().from(courseAccess).where(eq(courseAccess.userId,session.user.id)).limit(1);if(access[0]?.status==="active")redirect("/dashboard");return <main className="min-h-screen grid place-items-center p-4"><div className="soft-card max-w-md text-center py-10"><div className="w-20 h-20 rounded-full bg-[#f2edff] grid place-items-center text-4xl mx-auto mb-5">◷</div><h1 className="text-2xl font-bold">Your enrollment is pending</h1><p className="text-[var(--muted)] mt-3">Thank you! Your account has been created and is awaiting approval. You’ll be able to access the course as soon as your enrollment is approved.</p><Link className="btn mt-6 no-underline" href="/dashboard">Go to Dashboard</Link><p className="mt-4"><Link href="/">Return home</Link></p></div></main>}
