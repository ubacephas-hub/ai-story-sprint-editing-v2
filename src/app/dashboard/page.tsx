import { redirect } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courses, courseAccess, lessons, lessonProgress, modules } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import {
  chooseContinueLesson,
  completedProgressCount,
  displayPercentage,
  overallProgressPercentage,
} from "@/lib/progress";

export const dynamic = "force-dynamic";

type ProgressView = {
  status: string | null;
  playbackPositionSeconds: number;
  furthestPositionSeconds: number;
  durationSeconds: number | null;
  watchedSeconds: number;
  percentComplete: number;
  lastWatchedAt: Date | null;
};

type CourseModuleView = {
  module: { id: number; title: string; position: number };
  lessons: Array<{
    lesson: { id: number; title: string; position: number };
    progress: ProgressView | null;
  }>;
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  const user = session.user;

  const access = await db
    .select()
    .from(courseAccess)
    .innerJoin(courses, eq(courseAccess.courseId, courses.id))
    .where(eq(courseAccess.userId, user.id));
  const active = access.find((item) => item.course_access.status === "active");
  const pending = access.some((item) => item.course_access.status === "pending");
  const suspended = access.some((item) => item.course_access.status === "suspended");

  const courseModules: CourseModuleView[] = [];
  if (active) {
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
        playbackPositionSeconds: lessonProgress.playbackPositionSeconds,
        furthestPositionSeconds: lessonProgress.furthestPositionSeconds,
        durationSeconds: lessonProgress.durationSeconds,
        watchedSeconds: lessonProgress.watchedSeconds,
        percentComplete: lessonProgress.percentComplete,
        lastWatchedAt: lessonProgress.lastWatchedAt,
      })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .leftJoin(
        lessonProgress,
        and(
          eq(lessonProgress.lessonId, lessons.id),
          eq(lessonProgress.userId, user.id)
        )
      )
      .where(eq(modules.courseId, active.courses.id))
      .orderBy(asc(modules.position), asc(lessons.position), asc(lessons.id));

    const grouped = new Map<number, CourseModuleView>();
    for (const row of rows) {
      const current = grouped.get(row.moduleId) || {
        module: {
          id: row.moduleId,
          title: row.moduleTitle,
          position: row.modulePosition,
        },
        lessons: [],
      };
      current.lessons.push({
        lesson: {
          id: row.lessonId,
          title: row.lessonTitle,
          position: row.lessonPosition,
        },
        progress: row.progressId
          ? {
              status: row.progressStatus,
              playbackPositionSeconds: row.playbackPositionSeconds || 0,
              furthestPositionSeconds: row.furthestPositionSeconds || 0,
              durationSeconds: row.durationSeconds,
              watchedSeconds: row.watchedSeconds || 0,
              percentComplete: row.percentComplete || 0,
              lastWatchedAt: row.lastWatchedAt,
            }
          : null,
      });
      grouped.set(row.moduleId, current);
    }
    courseModules.push(...grouped.values());
  }

  const flat = courseModules.flatMap((courseModule, moduleIndex) =>
    courseModule.lessons.map((item, lessonIndex) => ({
      ...item,
      module: courseModule.module,
      position:
        courseModules
          .slice(0, moduleIndex)
          .reduce((sum, previous) => sum + previous.lessons.length, 0) +
        lessonIndex +
        1,
    }))
  );
  const completed = completedProgressCount(flat.map((item) => item.progress));
  const percent = overallProgressPercentage(flat.map((item) => item.progress));
  const allComplete = flat.length > 0 && completed === flat.length;
  const next = chooseContinueLesson(flat) || (allComplete ? flat[0] : null);
  const icons = ["✓", "▱", "▯", "☷"];

  return (
    <>
      <Navbar user={user} />
      <main>
        <div className="app-page">
          <div className="mb-6">
            <p className="page-eyebrow">Student home</p>
            <h1 className="text-3xl font-bold mt-1">Welcome back, {user.name}! 👋</h1>
            <p className="text-[var(--muted)]">
              Let’s continue your AI StorySprint Editing journey.
            </p>
          </div>

          {pending && (
            <div className="soft-card text-center py-10">
              <div className="text-5xl mb-4">◷</div>
              <h2 className="text-2xl font-bold">Your enrollment is pending</h2>
              <p className="text-[var(--muted)] max-w-lg mx-auto mt-2">
                Your account is ready. We’ll let you know as soon as your course access is approved.
              </p>
            </div>
          )}
          {suspended && (
            <div className="alert error">
              Your course access is currently suspended. Please contact the course administrator.
            </div>
          )}

          {active && (
            <>
              <div className="grid lg:grid-cols-[1.6fr_.8fr] gap-4">
                <section className="soft-card continue-card">
                  <span className="badge in-progress">
                    {allComplete ? "Course completed" : "Continue learning"}
                  </span>
                  {next ? (
                    <>
                      <h2 className="text-2xl font-bold mt-4">
                        Lesson {next.position} — {next.lesson.title}
                      </h2>
                      <p className="text-[var(--muted)]">
                        Module {courseModules.findIndex((item) => item.module.id === next.module.id) + 1} · {next.module.title}
                      </p>
                      <div className="progress-bar my-5">
                        <span
                          className="progress-bar-fill"
                          style={{ width: `${displayPercentage(next.progress)}%` }}
                        />
                      </div>
                      <p className="text-sm text-[var(--muted)] mb-4">
                        {Math.round(displayPercentage(next.progress))}% watched
                      </p>
                      <Link className="btn no-underline" href={`/lesson/${next.lesson.id}`}>
                        {allComplete ? "Review Course" : "Continue Lesson"} →
                      </Link>
                    </>
                  ) : (
                    <p className="mt-4">Your lessons will appear here.</p>
                  )}
                </section>

                <section className="soft-card">
                  <h2 className="text-lg font-bold">Your Progress</h2>
                  <div className="flex items-center gap-5 my-4">
                    <div className="progress-ring" style={{ "--p": percent } as CSSProperties}>
                      <strong>{Math.round(percent)}%</strong>
                    </div>
                    <div>
                      <strong>{completed} of {flat.length}</strong>
                      <p className="text-sm text-[var(--muted)]">lessons completed</p>
                      <p className="text-sm text-[var(--muted)]">including partial playback</p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {courseModules.map((courseModule, index) => {
                      const moduleCompleted = completedProgressCount(
                        courseModule.lessons.map((item) => item.progress)
                      );
                      const modulePercent = overallProgressPercentage(
                        courseModule.lessons.map((item) => item.progress)
                      );
                      return (
                        <div className="flex justify-between text-sm" key={courseModule.module.id}>
                          <span>
                            <span style={{ color: moduleCompleted === courseModule.lessons.length ? "var(--ok)" : "var(--brand)" }}>●</span>{" "}
                            Module {index + 1}
                          </span>
                          <strong>{Math.round(modulePercent)}%</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div id="course" className="section-heading">
                <h2>Your Course</h2>
                <span className="text-sm text-[var(--muted)]">
                  {completed}/{flat.length} lessons complete · {Math.round(percent)}% overall
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {courseModules.map((courseModule, index) => {
                  const moduleCompleted = completedProgressCount(
                    courseModule.lessons.map((item) => item.progress)
                  );
                  const state =
                    moduleCompleted === courseModule.lessons.length
                      ? "Completed"
                      : moduleCompleted || overallProgressPercentage(courseModule.lessons.map((item) => item.progress)) > 0
                        ? "In progress"
                        : "Not started";
                  return (
                    <details
                      className="module-outline"
                      key={courseModule.module.id}
                      open={courseModule.lessons.some((item) => item.progress?.status === "in_progress")}
                    >
                      <summary>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3">
                            <div className="module-icon mb-0">{icons[index % icons.length]}</div>
                            <div>
                              <strong className="text-sm text-[var(--muted)]">Module {index + 1}</strong>
                              <h3 className="font-bold text-lg">{courseModule.module.title}</h3>
                              <p className="text-xs text-[var(--muted)]">
                                {moduleCompleted} of {courseModule.lessons.length} lessons · {Math.round(overallProgressPercentage(courseModule.lessons.map((item) => item.progress)))}% watched
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`badge ${state.toLowerCase().replace(" ", "-")}`}>{state}</span>
                            <span className="module-chevron">›</span>
                          </div>
                        </div>
                      </summary>
                      <div className="lesson-outline">
                        {courseModule.lessons.map((item, lessonIndex) => {
                          const globalPosition = courseModules
                            .slice(0, index)
                            .reduce((sum, previous) => sum + previous.lessons.length, 0) + lessonIndex + 1;
                          return (
                            <Link href={`/lesson/${item.lesson.id}`} key={item.lesson.id}>
                              <span className="flex items-center gap-3">
                                <span className={`lesson-status-dot ${item.progress?.status || ""}`} />
                                <span>
                                  <small className="block text-[var(--muted)]">Lesson {globalPosition}</small>
                                  <strong>{item.lesson.title}</strong>
                                </span>
                              </span>
                              <span>{Math.round(displayPercentage(item.progress))}% →</span>
                            </Link>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
