import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courseAccess, courses, lessons, modules, users } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { getAdminProgressSnapshots } from "@/lib/admin-progress";
import StudentActions from "./StudentActions";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const students = await db
    .select()
    .from(users)
    .where(eq(users.role, "student"))
    .orderBy(asc(users.name));

  const [course] = await db.select().from(courses).limit(1);
  const courseId = course?.id ?? null;
  const accessRows = courseId
    ? await db
        .select({ userId: courseAccess.userId, status: courseAccess.status, accessId: courseAccess.id })
        .from(courseAccess)
        .where(eq(courseAccess.courseId, courseId))
    : [];
  const accessByUser = new Map(accessRows.map((row) => [row.userId, row]));

  const snapshots = await getAdminProgressSnapshots();
  const snapshotByUser = new Map(snapshots.map((snapshot) => [snapshot.studentId, snapshot]));
  const [lessonCount] = courseId
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(lessons)
        .innerJoin(modules, eq(lessons.moduleId, modules.id))
        .where(eq(modules.courseId, courseId))
    : [{ count: 0 }];

  const studentsWithInfo = students.map((student) => {
    const access = accessByUser.get(student.id);
    const snapshot = snapshotByUser.get(student.id);
    return {
      id: student.id,
      name: student.name,
      email: student.email,
      accountStatus: student.accountStatus,
      accessStatus: access?.status || "none",
      accessId: access?.accessId || null,
      completedLessons: snapshot?.completedLessons || 0,
      overallPercent: snapshot?.overallPercent || 0,
      mostRecentLessonTitle: snapshot?.mostRecentLesson?.title || null,
      lastWatchedAt: snapshot?.lastWatchedAt || null,
    };
  });

  return (
    <>
      <Navbar user={session.user} />
      <main>
        <div className="app-page">
          <div className="mb-4">
            <Link
              href="/admin"
              className="text-sm text-[var(--muted)] hover:text-[var(--brand)] no-underline"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <p className="page-eyebrow">Student management</p>
          <h1 className="text-3xl font-bold mt-1 mb-2">Students</h1>
          <p className="text-[var(--muted)] mb-6">
            Progress summaries refresh automatically while this page is visible.
          </p>

          <StudentActions
            courseId={courseId}
            students={studentsWithInfo}
            totalLessons={Number(lessonCount?.count || 0)}
          />
        </div>
      </main>
    </>
  );
}
