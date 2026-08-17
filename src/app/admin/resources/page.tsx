import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courses, modules, lessons, resources } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import ResourceActions from "./ResourceActions";

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const user = session.user;

  const allCourses = await db.select().from(courses).limit(1);
  if (allCourses.length === 0) redirect("/admin");
  const course = allCourses[0];

  const allModules = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(modules.position));

  const allLessons: Array<{
    id: number;
    title: string;
    moduleTitle: string;
  }> = [];
  for (const mod of allModules) {
    const lessonList = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, mod.id))
      .orderBy(asc(lessons.position));
    for (const l of lessonList) {
      allLessons.push({
        id: l.id,
        title: l.title,
        moduleTitle: mod.title,
      });
    }
  }

  // Get all resources
  const allResources = await db
    .select()
    .from(resources)
    .orderBy(asc(resources.position));

  return (
    <>
      <Navbar user={user} />
      <main className="w-[min(1080px,calc(100%-32px))] mx-auto py-8">
        <div className="mb-4">
          <Link
            href="/admin"
            className="text-sm text-[var(--muted)] hover:text-[var(--brand)] no-underline"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-semibold mb-6">Resources</h1>

        <ResourceActions
          lessons={allLessons}
          resources={allResources}
        />
      </main>
    </>
  );
}
