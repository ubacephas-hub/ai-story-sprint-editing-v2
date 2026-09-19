import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courses, lessons, modules } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import LessonManager from "./LessonManager";

export const dynamic = "force-dynamic";

export default async function AdminLessonsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const [course] = await db.select().from(courses).limit(1);
  if (!course) redirect("/admin");

  const allModules = await db
    .select({ id: modules.id, title: modules.title, position: modules.position })
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(modules.position), asc(modules.id));

  const lessonsByModule = [];
  for (const courseModule of allModules) {
    const moduleLessons = await db
      .select({
        id: lessons.id,
        moduleId: lessons.moduleId,
        title: lessons.title,
        description: lessons.description,
        position: lessons.position,
        videoKind: lessons.videoKind,
        videoSource: lessons.videoSource,
      })
      .from(lessons)
      .where(eq(lessons.moduleId, courseModule.id))
      .orderBy(asc(lessons.position), asc(lessons.id));
    lessonsByModule.push({ module: courseModule, lessons: moduleLessons });
  }

  return (
    <>
      <Navbar user={session.user} />
      <main>
        <div className="app-page">
          <div className="flex justify-between items-start gap-4 flex-wrap mb-4">
            <div>
              <Link
                href="/admin"
                className="text-sm text-[var(--muted)] hover:text-[var(--brand)] no-underline"
              >
                ← Back to Dashboard
              </Link>
              <p className="page-eyebrow mt-4">Course structure</p>
              <h1 className="text-3xl font-bold mt-1">Lessons</h1>
              <p className="text-[var(--muted)] mt-2">
                Create, edit, reorder, and move lessons between modules. Existing
                lesson IDs and student progress are preserved.
              </p>
            </div>
            <Link href="/admin/modules" className="btn secondary no-underline">
              Manage modules
            </Link>
          </div>

          <LessonManager
            modules={allModules}
            lessonsByModule={lessonsByModule}
          />
        </div>
      </main>
    </>
  );
}
