import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import Navbar from "@/components/Navbar";
import VideoPlayer from "@/components/VideoPlayer";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import {
  courseAccess,
  lessonProgress,
  lessons,
  modules,
  resources,
} from "@/db/schema";
import { canStudentAccessLesson } from "@/lib/content-archive";
import ProgressButtons from "./ProgressButtons";

export const dynamic = "force-dynamic";

interface LessonPageProps {
  params: Promise<{ id: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "student") redirect("/admin");

  const lessonId = Number(id);
  if (!Number.isSafeInteger(lessonId) || lessonId <= 0) notFound();

  const [content] = await db
    .select({ lesson: lessons, module: modules })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!content) notFound();
  const { lesson, module: courseModule } = content;

  const [access] = await db
    .select({ id: courseAccess.id })
    .from(courseAccess)
    .where(
      and(
        eq(courseAccess.userId, session.user.id),
        eq(courseAccess.courseId, courseModule.courseId),
        eq(courseAccess.status, "active")
      )
    )
    .limit(1);
  if (!access) redirect("/dashboard");

  if (
    !canStudentAccessLesson({
      role: session.user.role,
      accessStatus: "active",
      lessonBelongsToCourse: true,
      moduleArchivedAt: courseModule.archivedAt,
      lessonArchivedAt: lesson.archivedAt,
    })
  ) {
    notFound();
  }

  const lessonResources = await db
    .select()
    .from(resources)
    .where(eq(resources.lessonId, lessonId))
    .orderBy(asc(resources.position), asc(resources.id));

  const [progress] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, session.user.id),
        eq(lessonProgress.lessonId, lessonId)
      )
    )
    .limit(1);

  const allModules = await db
    .select({ id: modules.id, title: modules.title, position: modules.position })
    .from(modules)
    .where(and(eq(modules.courseId, courseModule.courseId), isNull(modules.archivedAt)))
    .orderBy(asc(modules.position), asc(modules.id));

  const allLessons = await db
    .select({ id: lessons.id, title: lessons.title, moduleId: lessons.moduleId })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(
        eq(modules.courseId, courseModule.courseId),
        isNull(modules.archivedAt),
        isNull(lessons.archivedAt)
      )
    )
    .orderBy(asc(modules.position), asc(lessons.position), asc(lessons.id));

  const currentIndex = allLessons.findIndex((item) => item.id === lessonId);
  if (currentIndex < 0) notFound();
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1
    ? allLessons[currentIndex + 1]
    : null;
  const lessonNum = currentIndex + 1;
  const moduleNum = allModules.findIndex((item) => item.id === courseModule.id) + 1;

  return (
    <>
      <Navbar user={session.user} />
      <main>
        <div className="app-page">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-5">
            <Link href="/dashboard">Dashboard</Link>
            <span>›</span>
            <span>{courseModule.title}</span>
            <span>›</span>
            <span>Lesson {lessonNum} of {allLessons.length}</span>
          </div>

          <div className="lesson-grid">
            <section>
              <VideoPlayer
                lessonId={lessonId}
                videoKind={lesson.videoKind}
                videoSource={lesson.videoSource}
                lessonTitle={lesson.title}
                initialProgress={
                  progress
                    ? {
                        status: progress.status,
                        playbackPositionSeconds: progress.playbackPositionSeconds,
                        furthestPositionSeconds: progress.furthestPositionSeconds,
                        durationSeconds: progress.durationSeconds,
                        watchedSeconds: progress.watchedSeconds,
                        percentComplete: progress.percentComplete,
                      }
                    : null
                }
              />
              <div className="soft-card mt-4">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div>
                    <p className="page-eyebrow">Module {moduleNum} · {courseModule.title}</p>
                    <h1 className="text-2xl font-bold mt-1">
                      Lesson {lessonNum} — {lesson.title}
                    </h1>
                  </div>
                  {progress?.status === "completed" ? (
                    <span className="badge completed">Completed</span>
                  ) : progress?.status === "in_progress" ? (
                    <span className="badge in-progress">In progress</span>
                  ) : (
                    <span className="badge">Not started</span>
                  )}
                </div>
                {lesson.description && (
                  <p className="text-[var(--muted)] mt-4">{lesson.description}</p>
                )}
              </div>
            </section>

            <aside className="soft-card h-fit">
              <p className="page-eyebrow">Lesson overview</p>
              <h2 className="text-xl font-bold mt-1 mb-3">{lesson.title}</h2>
              <p className="text-sm text-[var(--muted)]">
                Work through the video and supporting resources, then mark the
                lesson complete when you’re ready.
              </p>
              <div className="mt-6">
                <ProgressButtons lessonId={lessonId} currentStatus={progress?.status || null} />
              </div>
            </aside>
          </div>

          <div className="section-heading">
            <h2>Lesson Resources</h2>
            <Link href="/resources" className="text-sm font-semibold">All resources</Link>
          </div>
          {lessonResources.length ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lessonResources.map((resource) => (
                <article key={resource.id} className="soft-card resource-tile">
                  <span className="resource-icon">
                    {resource.type === "link" ? "↗" : resource.type === "text" ? "☷" : "□"}
                  </span>
                  <span className="page-eyebrow">{resource.type}</span>
                  <strong>{resource.title}</strong>
                  {resource.description && (
                    <p className="text-sm text-[var(--muted)]">{resource.description}</p>
                  )}
                  {resource.type === "text" && resource.content && (
                    <p className="text-sm mt-2">{resource.content}</p>
                  )}
                  <div className="resource-action">
                    {resource.type === "link" && resource.url && (
                      <a className="btn secondary small" target="_blank" rel="noopener noreferrer" href={resource.url}>
                        Open resource ↗
                      </a>
                    )}
                    {resource.type === "document" && resource.filePath && (
                      <a
                        className="btn secondary small"
                        href={`/api/resources/${resource.id}/download`}
                        data-no-route-loading
                      >
                        Open document
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="soft-card text-center text-[var(--muted)]">
              No resources have been added for this lesson yet.
            </div>
          )}

          <div className="flex justify-between gap-3 flex-wrap mt-7">
            {prevLesson ? (
              <Link href={`/lesson/${prevLesson.id}`} className="btn secondary no-underline">
                ← Previous Lesson
              </Link>
            ) : <span />}
            {nextLesson ? (
              <Link href={`/lesson/${nextLesson.id}`} className="btn no-underline">
                Next Lesson →
              </Link>
            ) : (
              <Link href="/dashboard" className="btn no-underline">Back to Dashboard</Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
