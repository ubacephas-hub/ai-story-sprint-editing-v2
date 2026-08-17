import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import {
  courses,
  modules,
  lessons,
  courseAccess,
  lessonProgress,
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");

  const user = session.user;

  // Get course access
  const access = await db
    .select()
    .from(courseAccess)
    .innerJoin(courses, eq(courseAccess.courseId, courses.id))
    .where(eq(courseAccess.userId, user.id));

  const activeCourses = access.filter(
    (a) => a.course_access.status === "active"
  );
  const pendingCourses = access.filter(
    (a) => a.course_access.status === "pending"
  );
  const suspendedCourses = access.filter(
    (a) => a.course_access.status === "suspended"
  );

  // Get all modules and lessons for active courses
  let courseModules: Array<{
    module: typeof modules.$inferSelect;
    lessons: Array<{
      lesson: typeof lessons.$inferSelect;
      progress: (typeof lessonProgress.$inferSelect) | null;
    }>;
  }> = [];

  if (activeCourses.length > 0) {
    const courseId = activeCourses[0].courses.id;

    const mods = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, courseId))
      .orderBy(asc(modules.position));

    for (const mod of mods) {
      const lessonList = await db
        .select()
        .from(lessons)
        .where(eq(lessons.moduleId, mod.id))
        .orderBy(asc(lessons.position));

      const lessonsWithProgress = [];
      for (const lesson of lessonList) {
        const prog = await db
          .select()
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.userId, user.id),
              eq(lessonProgress.lessonId, lesson.id)
            )
          )
          .limit(1);

        lessonsWithProgress.push({
          lesson,
          progress: prog.length > 0 ? prog[0] : null,
        });
      }

      courseModules.push({ module: mod, lessons: lessonsWithProgress });
    }
  }

  const totalLessons = courseModules.reduce(
    (sum, m) => sum + m.lessons.length,
    0
  );
  const completedLessons = courseModules.reduce(
    (sum, m) =>
      sum + m.lessons.filter((l) => l.progress?.status === "completed").length,
    0
  );
  const progressPercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <>
      <Navbar user={user} />
      <main className="w-[min(1080px,calc(100%-32px))] mx-auto py-8">
        <h1 className="text-[clamp(28px,5vw,46px)] font-semibold leading-[1.05] mb-2">
          Welcome, {user.name}
        </h1>
        <p className="text-[var(--muted)] mb-8">Your learning dashboard</p>

        {pendingCourses.length > 0 && (
          <div className="alert warning mb-6">
            Your enrollment is pending. An administrator will activate your
            access soon.
          </div>
        )}

        {suspendedCourses.length > 0 && (
          <div className="alert error mb-6">
            Your course access has been suspended. Contact the administrator.
          </div>
        )}

        {activeCourses.length > 0 && (
          <>
            {/* Progress summary */}
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold m-0">Course Progress</h3>
                <span className="text-[var(--brand)] font-bold">
                  {progressPercent}%
                </span>
              </div>
              <div className="progress-bar">
                <span
                  className="progress-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-sm text-[var(--muted)] mt-2">
                {completedLessons} of {totalLessons} lessons completed
              </p>
            </div>

            {/* Modules */}
            <div className="grid gap-4">
              {courseModules.map((mod, mi) => (
                <div key={mod.module.id} className="card">
                  <h3 className="text-lg font-semibold mb-3">
                    Module {mi + 1} — {mod.module.title}
                  </h3>
                  <div className="grid gap-2">
                    {mod.lessons.map((item) => {
                      const lessonNum =
                        courseModules
                          .slice(0, mi)
                          .reduce((s, m) => s + m.lessons.length, 0) +
                        mod.lessons.indexOf(item) +
                        1;
                      return (
                        <Link
                          key={item.lesson.id}
                          href={`/lesson/${item.lesson.id}`}
                          className="flex items-center justify-between p-3 rounded-lg border border-[var(--line)] hover:border-[var(--brand)] hover:bg-[#f8f7ff] transition-colors no-underline text-[var(--ink)]"
                        >
                          <span>
                            <span className="font-semibold">
                              Lesson {lessonNum}
                            </span>{" "}
                            — {item.lesson.title}
                          </span>
                          {item.progress?.status === "completed" ? (
                            <span className="badge completed">Completed</span>
                          ) : item.progress?.status === "in_progress" ? (
                            <span className="badge in-progress">
                              In Progress
                            </span>
                          ) : (
                            <span className="text-[var(--muted)] text-sm">
                              Not started
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeCourses.length === 0 && pendingCourses.length === 0 && suspendedCourses.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-[var(--muted)]">
              You are not enrolled in any courses yet.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
