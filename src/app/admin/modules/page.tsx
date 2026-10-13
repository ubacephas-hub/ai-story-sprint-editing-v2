import { redirect } from "next/navigation";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import Navbar from "@/components/Navbar";
import { db } from "@/db";
import { courses, lessons, modules } from "@/db/schema";
import { getSession } from "@/lib/auth";
import ModuleManager from "./ModuleManager";

export const dynamic = "force-dynamic";

export default async function ModulesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const [course] = await db.select().from(courses).limit(1);
  if (!course) redirect("/admin");

  const loadModules = async (archived: boolean) => {
    const rows = await db
      .select({
        id: modules.id,
        title: modules.title,
        position: modules.position,
        archivedAt: modules.archivedAt,
        lessonCount: sql<number>`count(${lessons.id})`,
      })
      .from(modules)
      .leftJoin(lessons, eq(lessons.moduleId, modules.id))
      .where(
        and(
          eq(modules.courseId, course.id),
          archived ? isNotNull(modules.archivedAt) : isNull(modules.archivedAt)
        )
      )
      .groupBy(modules.id)
      .orderBy(asc(modules.position), asc(modules.id));

    return rows.map((module) => ({
      ...module,
      lessonCount: Number(module.lessonCount),
    }));
  };

  const [activeModules, archivedModules] = await Promise.all([
    loadModules(false),
    loadModules(true),
  ]);

  return (
    <>
      <Navbar user={session.user} />
      <main>
        <div className="app-page">
          <p className="page-eyebrow">Course structure</p>
          <h1 className="text-3xl font-bold mb-2">Modules</h1>
          <p className="text-[var(--muted)] mb-6">
            Organize the active course, then archive modules without removing
            their lessons, resources, or student progress.
          </p>
          <ModuleManager
            courseId={course.id}
            activeModules={activeModules}
            archivedModules={archivedModules}
          />
        </div>
      </main>
    </>
  );
}
