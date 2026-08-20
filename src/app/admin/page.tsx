import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { users, courses, modules, lessons, courseAccess } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const user = session.user;

  const totalStudents = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, "student"));

  const totalCourses = await db
    .select({ count: sql<number>`count(*)` })
    .from(courses);

  const totalModules = await db
    .select({ count: sql<number>`count(*)` })
    .from(modules);

  const totalLessons = await db
    .select({ count: sql<number>`count(*)` })
    .from(lessons);

  const pendingAccess = await db
    .select({ count: sql<number>`count(*)` })
    .from(courseAccess)
    .where(eq(courseAccess.status, "pending"));

  return (
    <>
      <Navbar user={user} />
      <main><div className="app-page">
        <h1 className="text-[clamp(28px,5vw,46px)] font-semibold leading-[1.05] mb-2">
          Admin Dashboard
        </h1>
        <p className="text-[var(--muted)] mb-8">
          Manage your course, students, and content.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="card text-center admin-stat bg-gradient-to-br from-white to-[#f3efff]">
            <strong className="block text-2xl">
              {Number(totalStudents[0].count)}
            </strong>
            <span className="text-[var(--muted)] text-sm">Students</span>
          </div>
          <div className="card text-center admin-stat bg-gradient-to-br from-white to-[#f3efff]">
            <strong className="block text-2xl">
              {Number(totalModules[0].count)}
            </strong>
            <span className="text-[var(--muted)] text-sm">Modules</span>
          </div>
          <div className="card text-center admin-stat bg-gradient-to-br from-white to-[#f3efff]">
            <strong className="block text-2xl">
              {Number(totalLessons[0].count)}
            </strong>
            <span className="text-[var(--muted)] text-sm">Lessons</span>
          </div>
          <div className="card text-center admin-stat bg-gradient-to-br from-white to-[#f3efff]">
            <strong className="block text-2xl text-[var(--warn)]">
              {Number(pendingAccess[0].count)}
            </strong>
            <span className="text-[var(--muted)] text-sm">
              Pending Enrollments
            </span>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/admin/students"
            className="card admin-stat hover:border-[var(--brand)] transition-colors no-underline text-[var(--ink)] bg-gradient-to-br from-white to-[#f8f6ff]"
          >
            <h3 className="text-lg font-semibold mb-1">Students</h3>
            <p className="text-sm text-[var(--muted)]">
              Add, manage, and activate student accounts.
            </p>
          </Link>
          <Link
            href="/admin/lessons"
            className="card admin-stat hover:border-[var(--brand)] transition-colors no-underline text-[var(--ink)] bg-gradient-to-br from-white to-[#f8f6ff]"
          >
            <h3 className="text-lg font-semibold mb-1">Lessons</h3>
            <p className="text-sm text-[var(--muted)]">
              Edit lesson content, videos, and descriptions.
            </p>
          </Link>
          <Link
            href="/admin/resources"
            className="card admin-stat hover:border-[var(--brand)] transition-colors no-underline text-[var(--ink)] bg-gradient-to-br from-white to-[#f8f6ff]"
          >
            <h3 className="text-lg font-semibold mb-1">Resources</h3>
            <p className="text-sm text-[var(--muted)]">
              Add links, text, and documents to lessons.
            </p>
          </Link>
        </div>
      </div></main>
    </>
  );
}
