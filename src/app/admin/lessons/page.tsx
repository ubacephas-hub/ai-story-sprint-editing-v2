import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courses, modules, lessons } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminLessonsPage() {
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

  const modulesWithLessons = [];
  for (const mod of allModules) {
    const lessonList = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, mod.id))
      .orderBy(asc(lessons.position));
    modulesWithLessons.push({ module: mod, lessons: lessonList });
  }

  let lessonNum = 1;

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

        <h1 className="text-2xl font-semibold mb-6">Lessons</h1>

        <div className="grid gap-4">
          {modulesWithLessons.map((mod, mi) => (
            <div key={mod.module.id} className="card">
              <h3 className="text-lg font-semibold mb-3">
                Module {mi + 1} — {mod.module.title}
              </h3>
              <div className="grid gap-2">
                {mod.lessons.map((lesson) => {
                  const num = lessonNum++;
                  return (
                    <Link
                      key={lesson.id}
                      href={`/admin/lessons/${lesson.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-[var(--line)] hover:border-[var(--brand)] hover:bg-[#f8f7ff] transition-colors no-underline text-[var(--ink)]"
                    >
                      <div>
                        <span className="font-semibold">Lesson {num}</span> —{" "}
                        {lesson.title}
                        {lesson.videoKind !== "none" && lesson.videoSource && (
                          <span className="ml-2 text-xs text-[var(--ok)] font-bold">
                            📹 Video attached
                          </span>
                        )}
                      </div>
                      <span className="text-[var(--brand)] text-sm font-semibold">
                        Edit →
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
