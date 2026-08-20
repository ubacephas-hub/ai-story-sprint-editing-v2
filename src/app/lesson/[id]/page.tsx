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
    <><Navbar user={user}/><main><div className="app-page">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-5"><Link href="/dashboard">Dashboard</Link><span>›</span><span>{mod.title}</span><span>›</span><span>Lesson {lessonNum} of {allLessons.length}</span></div>
      <div className="lesson-grid">
        <section>
          <VideoPlayer videoKind={lesson.videoKind} videoSource={lesson.videoSource} lessonTitle={lesson.title}/>
          <div className="soft-card mt-4"><div className="flex justify-between items-start gap-4 flex-wrap"><div><p className="page-eyebrow">Module {allModules.findIndex(m=>m.id===mod.id)+1} · {mod.title}</p><h1 className="text-2xl font-bold mt-1">Lesson {lessonNum} — {lesson.title}</h1></div>{progress?.status==="completed"?<span className="badge completed">Completed</span>:progress?.status==="in_progress"?<span className="badge in-progress">In progress</span>:<span className="badge">Not started</span>}</div>{lesson.description&&<p className="text-[var(--muted)] mt-4">{lesson.description}</p>}</div>
        </section>
        <aside className="soft-card h-fit"><p className="page-eyebrow">Lesson overview</p><h2 className="text-xl font-bold mt-1 mb-3">{lesson.title}</h2><p className="text-sm text-[var(--muted)]">Work through the video and supporting resources, then mark the lesson complete when you’re ready.</p><div className="mt-6"><ProgressButtons lessonId={lessonId} currentStatus={progress?.status||null}/></div></aside>
      </div>

      <div className="section-heading"><h2>Lesson Resources</h2><Link href="/resources" className="text-sm font-semibold">All resources</Link></div>
      {lessonResources.length?<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{lessonResources.map(res=><article key={res.id} className="soft-card resource-tile"><span className="resource-icon">{res.type==="link"?"↗":res.type==="text"?"☷":"□"}</span><span className="page-eyebrow">{res.type}</span><strong>{res.title}</strong>{res.description&&<p className="text-sm text-[var(--muted)]">{res.description}</p>}{res.type==="text"&&res.content&&<p className="text-sm mt-2">{res.content}</p>}<div className="resource-action">{res.type==="link"&&res.url&&<a className="btn secondary small" target="_blank" rel="noopener noreferrer" href={res.url}>Open resource ↗</a>}{res.type==="document"&&res.filePath&&<a className="btn secondary small" href={res.filePath}>Open document</a>}</div></article>)}</div>:<div className="soft-card text-center text-[var(--muted)]">No resources have been added for this lesson yet.</div>}

      <div className="flex justify-between gap-3 flex-wrap mt-7">{prevLesson?<Link href={`/lesson/${prevLesson.id}`} className="btn secondary no-underline">← Previous Lesson</Link>:<span/>}{nextLesson?<Link href={`/lesson/${nextLesson.id}`} className="btn no-underline">Next Lesson →</Link>:<Link href="/dashboard" className="btn no-underline">Back to Dashboard</Link>}</div>
    </div></main></>
  );
}
