import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courses, lessons, modules, resources } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import ResourceActions from "./ResourceActions";

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage() {
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

  const allLessons: Array<{ id: number; title: string; moduleTitle: string }> = [];
  for (const courseModule of allModules) {
    const moduleLessons = await db
      .select({ id: lessons.id, title: lessons.title })
      .from(lessons)
      .where(eq(lessons.moduleId, courseModule.id))
      .orderBy(asc(lessons.position), asc(lessons.id));
    for (const lesson of moduleLessons) {
      allLessons.push({
        id: lesson.id,
        title: lesson.title,
        moduleTitle: courseModule.title,
      });
    }
  }

  const allResources = await db
    .select({
      id: resources.id,
      lessonId: resources.lessonId,
      type: resources.type,
      title: resources.title,
      url: resources.url,
      content: resources.content,
      filePath: resources.filePath,
      description: resources.description,
      position: resources.position,
    })
    .from(resources)
    .innerJoin(lessons, eq(resources.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(resources.position), asc(resources.id));

  return (
    <>
      <Navbar user={session.user} />
      <main>
        <div className="app-page">
          <div className="mb-4">
            <Link
              href="/admin"
              className="text-sm text-[var(--muted)] hover:text-[var(--brand)] no-underline"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <p className="page-eyebrow">Course library</p>
          <h1 className="text-3xl font-bold mt-1">Resources</h1>
          <p className="text-[var(--muted)] mb-6">
            Add links, notes, and private documents to any lesson. Students see
            only resources belonging to their active course access.
          </p>

          <ResourceActions lessons={allLessons} resources={allResources} />
        </div>
      </main>
    </>
  );
}
