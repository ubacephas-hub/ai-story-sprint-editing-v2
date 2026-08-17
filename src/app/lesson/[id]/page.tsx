import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import VideoPlayer from "@/components/VideoPlayer";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import {
  courses,
  modules,
  lessons,
  resources,
  courseAccess,
  lessonProgress,
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import ProgressButtons from "./ProgressButtons";

export const dynamic = "force-dynamic";

interface LessonPageProps {
  params: Promise<{ id: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");

  const user = session.user;
  const lessonId = parseInt(id, 10);
  if (isNaN(lessonId)) notFound();

  // Get the lesson
  const lessonResult = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);

  if (lessonResult.length === 0) notFound();
  const lesson = lessonResult[0];

  // Get the module and course
  const moduleResult = await db
    .select()
    .from(modules)
    .where(eq(modules.id, lesson.moduleId))
    .limit(1);
  if (moduleResult.length === 0) notFound();
  const mod = moduleResult[0];

  // Check course access
  const access = await db
    .select()
    .from(courseAccess)
    .where(
      and(
        eq(courseAccess.userId, user.id),
        eq(courseAccess.courseId, mod.courseId),
        eq(courseAccess.status, "active")
      )
    )
    .limit(1);

  if (access.length === 0) {
    redirect("/dashboard");
  }

  // Get resources
  const lessonResources = await db
    .select()
    .from(resources)
    .where(eq(resources.lessonId, lessonId))
    .orderBy(asc(resources.position));

  // Get progress
  const progResult = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, user.id),
        eq(lessonProgress.lessonId, lessonId)
      )
    )
    .limit(1);
  const progress = progResult.length > 0 ? progResult[0] : null;

  // Get all lessons for navigation
  const allModules = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, mod.courseId))
    .orderBy(asc(modules.position));

  const allLessons: Array<typeof lessons.$inferSelect> = [];
  for (const m of allModules) {
    const ls = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, m.id))
      .orderBy(asc(lessons.position));
    allLessons.push(...ls);
  }

  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;
  const lessonNum = currentIndex + 1;

  return (
    <>
      <Navbar user={user} />
      <main className="w-[min(1080px,calc(100%-32px))] mx-auto py-8">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--muted)] hover:text-[var(--brand)] no-underline"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="mb-2 text-sm text-[var(--muted)]">
          Module {allModules.findIndex((m) => m.id === mod.id) + 1} —{" "}
          {mod.title}
        </div>

        <h1 className="text-2xl font-semibold mb-1">
          Lesson {lessonNum}: {lesson.title}
        </h1>

        {lesson.description && (
          <p className="text-[var(--muted)] mb-6">{lesson.description}</p>
        )}

        {/* Video Player */}
        <div className="mb-6">
          <VideoPlayer
            videoKind={lesson.videoKind}
            videoSource={lesson.videoSource}
            lessonTitle={lesson.title}
          />
        </div>

        {/* Progress */}
        <div className="card mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="font-semibold">Status: </span>
              {progress?.status === "completed" ? (
                <span className="badge completed">Completed</span>
              ) : progress?.status === "in_progress" ? (
                <span className="badge in-progress">In Progress</span>
              ) : (
                <span className="text-[var(--muted)]">Not started</span>
              )}
            </div>
            <ProgressButtons
              lessonId={lessonId}
              currentStatus={progress?.status || null}
            />
          </div>
        </div>

        {/* Resources */}
        {lessonResources.length > 0 && (
          <div className="card mb-6">
            <h3 className="text-lg font-semibold mb-3">Resources</h3>
            <div className="grid gap-2">
              {lessonResources.map((res) => (
                <div
                  key={res.id}
                  className="p-3 border border-[var(--line)] rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs uppercase font-bold text-[var(--muted)]">
                      {res.type}
                    </span>
                    <span className="font-semibold">{res.title}</span>
                  </div>
                  {res.type === "link" && res.url && (
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm"
                    >
                      {res.url}
                    </a>
                  )}
                  {res.type === "text" && res.content && (
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {res.content}
                    </p>
                  )}
                  {res.description && (
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {res.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between gap-3 flex-wrap">
          {prevLesson ? (
            <Link
              href={`/lesson/${prevLesson.id}`}
              className="btn secondary no-underline"
            >
              ← Previous Lesson
            </Link>
          ) : (
            <span />
          )}
          {nextLesson ? (
            <Link
              href={`/lesson/${nextLesson.id}`}
              className="btn no-underline"
            >
              Next Lesson →
            </Link>
          ) : (
            <Link href="/dashboard" className="btn no-underline">
              Back to Dashboard
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
