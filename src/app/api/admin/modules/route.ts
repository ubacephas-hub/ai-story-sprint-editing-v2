import { NextRequest, NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { courses, lessons, modules } from "@/db/schema";
import { getSession } from "@/lib/auth";

function positiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function titleValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim();
  return title.length >= 1 && title.length <= 160 ? title : null;
}

async function requireAdmin() {
  const session = await getSession();
  return session?.user.role === "admin" ? session : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const courseId = positiveInteger(body.courseId);
    const title = titleValue(body.title);
    if (!courseId || !title) {
      return NextResponse.json(
        { error: "A valid course and module title are required" },
        { status: 400 }
      );
    }

    const course = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (course.length === 0) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const [maxPosition] = await db
      .select({ position: sql<number>`coalesce(max(${modules.position}), 0)` })
      .from(modules)
      .where(eq(modules.courseId, courseId));

    const [createdModule] = await db
      .insert(modules)
      .values({
        courseId,
        title,
        position: Number(maxPosition?.position || 0) + 1,
      })
      .returning();

    return NextResponse.json({ success: true, module: createdModule }, { status: 201 });
  } catch {
    console.error("Module creation failed");
    return NextResponse.json(
      { error: "Module creation failed" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = positiveInteger(body.id);
    const title = titleValue(body.title);
    const requestedPosition = positiveInteger(
      body.position !== undefined ? body.position : body.order
    );
    if (!id || !title || !requestedPosition) {
      return NextResponse.json(
        { error: "A valid module, title, and position are required" },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(modules)
      .where(eq(modules.id, id))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const current = existing[0];
    await db.transaction(async (tx) => {
      const ordered = await tx
        .select({ id: modules.id })
        .from(modules)
        .where(eq(modules.courseId, current.courseId))
        .orderBy(asc(modules.position), asc(modules.id));

      const remaining = ordered.filter((item) => item.id !== id);
      const insertAt = Math.min(requestedPosition - 1, remaining.length);
      remaining.splice(insertAt, 0, { id });

      // Reassign positions in one transaction. IDs and lesson relationships do
      // not change, and every module receives a unique, contiguous position.
      for (let index = 0; index < remaining.length; index += 1) {
        await tx
          .update(modules)
          .set({ position: index + 1 })
          .where(eq(modules.id, remaining[index].id));
      }

      await tx
        .update(modules)
        .set({ title })
        .where(eq(modules.id, id));
    });

    return NextResponse.json({ success: true });
  } catch {
    console.error("Module update failed");
    return NextResponse.json(
      { error: "Module update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = positiveInteger(body.id);
    if (!id || body.confirmation !== "DELETE EMPTY MODULE") {
      return NextResponse.json(
        { error: "Explicit confirmation is required" },
        { status: 400 }
      );
    }

    const existing = await db
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.id, id))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const [dependentLessons] = await db
      .select({ count: sql<number>`count(*)` })
      .from(lessons)
      .where(eq(lessons.moduleId, id));
    if (Number(dependentLessons?.count || 0) > 0) {
      return NextResponse.json(
        { error: "This module contains lessons and cannot be deleted." },
        { status: 409 }
      );
    }

    await db.delete(modules).where(eq(modules.id, id));
    return NextResponse.json({ success: true });
  } catch {
    console.error("Module deletion failed");
    return NextResponse.json(
      { error: "Module deletion failed" },
      { status: 500 }
    );
  }
}
