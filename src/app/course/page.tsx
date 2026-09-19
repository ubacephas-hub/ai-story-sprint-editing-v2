import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courseAccess, courses, lessons, lessonProgress, modules } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import {
  completedProgressCount,
  displayPercentage,
  overallProgressPercentage,
} from "@/lib/progress";

export const dynamic = "force-dynamic";

type ProgressView = {
  status: string | null;
  percentComplete: number;
  lastWatchedAt: Date | null;
};

export default async function CoursePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "student") redirect("/admin");

  const [access] = await db
    .select()
    .from(courseAccess)
    .innerJoin(courses, eq(courseAccess.courseId, courses.id))
    .where(
      and(
        eq(courseAccess.userId, session.user.id),
        eq(courseAccess.status, "active")
      )
    )
    .limit(1);
  if (!access) redirect("/dashboard");

  const rows = await db
    .select({
      moduleId: modules.id,
      moduleTitle: modules.title,
      modulePosition: modules.position,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      lessonPosition: lessons.position,
      progressId: lessonProgress.id,
      progressStatus: lessonProgress.status,
      percentComplete: lessonProgress.percentComplete,
      lastWatchedAt: lessonProgress.lastWatchedAt,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        eq(lessonProgress.userId, session.user.id)
      )
    )
    .where(eq(modules.courseId, access.courses.id))
    .orderBy(asc(modules.position), asc(lessons.position), asc(lessons.id));

  const grouped = new Map<number, { id: number; title: string; position: number; lessons: Array<{ id: number; title: string; position: number; progress: ProgressView | null }> }>();
  for (const row of rows) {
    const current = grouped.get(row.moduleId) || {
      id: row.moduleId,
      title: row.moduleTitle,
      position: row.modulePosition,
      lessons: [],
    };
    current.lessons.push({
      id: row.lessonId,
      title: row.lessonTitle,
      position: row.lessonPosition,
      progress: row.progressId
        ? {
            status: row.progressStatus,
            percentComplete: row.percentComplete || 0,
            lastWatchedAt: row.lastWatchedAt,
          }
        : null,
    });
    grouped.set(row.moduleId, current);
  }
  const data = [...grouped.values()];
  const flat = data.flatMap((item) => item.lessons);
  const completed = completedProgressCount(flat.map((item) => item.progress));
  const percent = overallProgressPercentage(flat.map((item) => item.progress));

  return (
    <>
      <Navbar user={session.user} />
      <main>
        <div className="app-page">
          <p className="page-eyebrow">My Course</p>
          <div className="flex justify-between items-end gap-4 flex-wrap mb-6">
            <div>
              <h1 className="text-3xl font-bold">{access.courses.title}</h1>
              <p className="text-[var(--muted)]">{access.courses.description}</p>
            </div>
            <div className="text-right">
              <strong className="text-2xl text-[var(--brand)]">{Math.round(percent)}%</strong>
              <p className="text-sm text-[var(--muted)]">
                {completed} of {flat.length} lessons complete
              </p>
            </div>
          </div>

          <div className="course-page-layout">
            <aside className="course-outline-panel">
              <h2>Course Outline</h2>
              {data.map((courseModule, moduleIndex) => (
                <details key={courseModule.id} open={moduleIndex === 0}>
                  <summary>
                    <span>
                      Module {moduleIndex + 1}
                      <strong>{courseModule.title}</strong>
                    </span>
                    <span>›</span>
                  </summary>
                  <div>
                    {courseModule.lessons.map((lesson, lessonIndex) => (
                      <Link href={`/lesson/${lesson.id}`} key={lesson.id}>
                        <span className={`lesson-status-dot ${lesson.progress?.status || ""}`} />
                        <span>
                          <small>Lesson {lessonIndex + 1}</small>
                          {lesson.title}
                        </span>
                        <strong className="ml-auto text-xs">{Math.round(displayPercentage(lesson.progress))}%</strong>
                      </Link>
                    ))}
                  </div>
                </details>
              ))}
            </aside>

            <section className="course-focus">
              <div className="soft-card continue-card">
                <span className="page-eyebrow">Learning path</span>
                <h2 className="text-2xl font-bold mt-2">Choose any lesson from the course outline</h2>
                <p className="text-[var(--muted)] mt-2">
                  Move through the {data.length} modules at your own pace. Your progress is saved automatically across devices.
                </p>
                <div className="progress-bar mt-6">
                  <span className="progress-bar-fill" style={{ width: `${percent}%` }} />
                </div>
                <p className="text-sm text-[var(--muted)] mt-2">{Math.round(percent)}% overall watched</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                {data.map((courseModule, index) => {
                  const modulePercent = overallProgressPercentage(
                    courseModule.lessons.map((lesson) => lesson.progress)
                  );
                  const moduleCompleted = completedProgressCount(
                    courseModule.lessons.map((lesson) => lesson.progress)
                  );
                  return (
                    <div className="soft-card" key={courseModule.id}>
                      <div className="module-icon">{["✓", "▱", "▯", "☷"][index % 4]}</div>
                      <span className="page-eyebrow">Module {index + 1}</span>
                      <h3 className="text-lg font-bold">{courseModule.title}</h3>
                      <p className="text-sm text-[var(--muted)]">
                        {moduleCompleted} of {courseModule.lessons.length} lessons completed · {Math.round(modulePercent)}% watched
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
