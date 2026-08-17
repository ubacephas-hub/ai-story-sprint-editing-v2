import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { lessons, modules } from "@/db/schema";
import { eq } from "drizzle-orm";
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

  const user = session.user;
  const lessonId = parseInt(id, 10);
  if (isNaN(lessonId)) notFound();

  const lessonResult = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);

  if (lessonResult.length === 0) notFound();
  const lesson = lessonResult[0];

  const moduleResult = await db
    .select()
    .from(modules)
    .where(eq(modules.id, lesson.moduleId))
    .limit(1);
  const mod = moduleResult[0];

  return (
    <>
      <Navbar user={user} />
      <main className="w-[min(1080px,calc(100%-32px))] mx-auto py-8">
        <div className="mb-4">
          <Link
            href="/admin/lessons"
            className="text-sm text-[var(--muted)] hover:text-[var(--brand)] no-underline"
          >
            ← Back to Lessons
          </Link>
        </div>

        <h1 className="text-2xl font-semibold mb-1">Edit Lesson</h1>
        <p className="text-[var(--muted)] mb-6">
          Module: {mod?.title} — {lesson.title}
        </p>

        <LessonEditForm lesson={lesson} />
      </main>
    </>
  );
}
