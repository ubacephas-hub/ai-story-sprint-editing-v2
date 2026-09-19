import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { lessons, modules } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import LessonEditForm from "./LessonEditForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminLessonEditPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const lessonId = Number(id);
  if (!Number.isSafeInteger(lessonId) || lessonId <= 0) notFound();

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) notFound();

  const [currentModule] = await db
    .select()
    .from(modules)
    .where(eq(modules.id, lesson.moduleId))
    .limit(1);
  if (!currentModule) notFound();

  const availableModules = await db
    .select({ id: modules.id, title: modules.title, position: modules.position })
    .from(modules)
    .where(eq(modules.courseId, currentModule.courseId))
    .orderBy(asc(modules.position), asc(modules.id));

  return (
    <>
      <Navbar user={session.user} />
      <main>
        <div className="app-page">
          <div className="mb-4">
            <Link
              href="/admin/lessons"
              className="text-sm text-[var(--muted)] hover:text-[var(--brand)] no-underline"
            >
              ← Back to Lessons
            </Link>
          </div>

          <p className="page-eyebrow">Course structure</p>
          <h1 className="text-3xl font-bold mt-1">Edit lesson</h1>
          <p className="text-[var(--muted)] mb-6">
            Update the lesson content, order, module assignment, and video source.
          </p>

          <LessonEditForm lesson={lesson} modules={availableModules} />
        </div>
      </main>
    </>
  );
}
