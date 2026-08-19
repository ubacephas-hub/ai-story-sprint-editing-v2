import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lessonProgress, lessons, modules, courseAccess } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { lessonId, status } = body;

    if (!lessonId || !["in_progress", "completed"].includes(status)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const allowed = await db.select({ lessonId: lessons.id }).from(lessons).innerJoin(modules, eq(lessons.moduleId, modules.id)).innerJoin(courseAccess, and(eq(courseAccess.courseId, modules.courseId), eq(courseAccess.userId, session.user.id), eq(courseAccess.status, "active"))).where(eq(lessons.id, lessonId)).limit(1);
    if (!allowed.length) return NextResponse.json({ error: "Active course access is required" }, { status: 403 });

    const existing = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, session.user.id),
          eq(lessonProgress.lessonId, lessonId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(lessonProgress)
        .set({
          status,
          updatedAt: new Date(),
          completedAt: status === "completed" ? new Date() : null,
        })
        .where(eq(lessonProgress.id, existing[0].id));
    } else {
      await db.insert(lessonProgress).values({
        userId: session.user.id,
        lessonId,
        status,
        completedAt: status === "completed" ? new Date() : null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Progress error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
