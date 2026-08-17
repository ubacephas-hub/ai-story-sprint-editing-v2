import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { users, courseAccess, courses, lessonProgress, lessons } from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import StudentActions from "./StudentActions";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const user = session.user;

  // Get all students with their access status
  const students = await db
    .select()
    .from(users)
    .where(eq(users.role, "student"))
    .orderBy(asc(users.name));

  const course = await db.select().from(courses).limit(1);
  const courseId = course.length > 0 ? course[0].id : null;

  // Get access and progress for each student
  const studentsWithInfo = [];
  for (const student of students) {
    let accessStatus = "none";
    let accessId: number | null = null;

    if (courseId) {
      const access = await db
        .select()
        .from(courseAccess)
        .where(
          and(
            eq(courseAccess.userId, student.id),
            eq(courseAccess.courseId, courseId)
          )
        )
        .limit(1);
      if (access.length > 0) {
        accessStatus = access[0].status;
        accessId = access[0].id;
      }
    }

    // Count completed lessons
    const completed = await db
      .select({ count: sql<number>`count(*)` })
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, student.id),
          eq(lessonProgress.status, "completed")
        )
      );

    studentsWithInfo.push({
      ...student,
      accessStatus,
      accessId,
      completedLessons: Number(completed[0].count),
    });
  }

  const totalLessons = await db
    .select({ count: sql<number>`count(*)` })
    .from(lessons);

  return (
    <>
      <Navbar user={user} />
      <main className="w-[min(1080px,calc(100%-32px))] mx-auto py-8">
        <div className="mb-4">
          <Link
            href="/admin"
            className="text-sm text-[var(--muted)] hover:text-[var(--brand)] no-underline"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-semibold mb-6">Students</h1>

        {/* Add student form */}
        <StudentActions
          courseId={courseId}
          students={studentsWithInfo}
          totalLessons={Number(totalLessons[0].count)}
        />
      </main>
    </>
  );
}
