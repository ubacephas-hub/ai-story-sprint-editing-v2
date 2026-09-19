import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courseAccess, courses, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminProgressSnapshots } from "@/lib/admin-progress";
import StudentProgressLive from "./StudentProgressLive";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const studentId = Number(id);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) notFound();

  const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
  if (!student || student.role !== "student") notFound();

  const [access] = await db
    .select({
      status: courseAccess.status,
      createdAt: courseAccess.createdAt,
      approvedAt: courseAccess.approvedAt,
      courseTitle: courses.title,
    })
    .from(courseAccess)
    .innerJoin(courses, eq(courseAccess.courseId, courses.id))
    .where(eq(courseAccess.userId, studentId))
    .limit(1);

  const [snapshot] = await getAdminProgressSnapshots(studentId);
  const initialSnapshot = snapshot || {
    studentId,
    overallPercent: 0,
    completedLessons: 0,
    totalLessons: 0,
    mostRecentLesson: null,
    lastWatchedAt: null,
    lessons: [],
  };

  return (
    <>
      <Navbar user={session.user} />
      <main>
        <div className="app-page">
          <div className="mb-4">
            <Link
              href="/admin/students"
              className="text-sm text-[var(--muted)] hover:text-[var(--brand)] no-underline"
            >
              ← Back to Students
            </Link>
          </div>
          <div className="flex justify-between items-start gap-4 flex-wrap mb-6">
            <div>
              <p className="page-eyebrow">Student progress</p>
              <h1 className="text-3xl font-bold mt-1">{student.name}</h1>
              <p className="text-[var(--muted)]">{student.email}</p>
              {student.accountStatus === "disabled" && (
                <span className="badge suspended mt-2 inline-block">Historical record · removed account</span>
              )}
            </div>
            <span className={`badge ${student.accountStatus === "disabled" ? "suspended" : access?.status || "pending"}`}>
              {student.accountStatus === "disabled" ? "Removed" : access?.status || "No enrollment"}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="soft-card">
              <span className="text-sm text-[var(--muted)]">Joined</span>
              <strong className="block">{new Date(student.createdAt).toLocaleDateString()}</strong>
            </div>
            <div className="soft-card">
              <span className="text-sm text-[var(--muted)]">Last login</span>
              <strong className="block text-sm">{student.lastLoginAt ? new Date(student.lastLoginAt).toLocaleString() : "Not recorded"}</strong>
            </div>
            <div className="soft-card">
              <span className="text-sm text-[var(--muted)]">Enrollment</span>
              <strong className="block">{access?.status || "No enrollment"}</strong>
            </div>
            <div className="soft-card">
              <span className="text-sm text-[var(--muted)]">Course</span>
              <strong className="block truncate">{access?.courseTitle || "Course"}</strong>
            </div>
          </div>
          {access?.approvedAt && (
            <p className="text-sm text-[var(--muted)] mb-5">Approved {new Date(access.approvedAt).toLocaleString()}</p>
          )}

          <StudentProgressLive studentId={studentId} initialSnapshot={initialSnapshot} />
        </div>
      </main>
    </>
  );
}
