import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { courses, lessons, modules } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  archiveMetadataPatch,
  restoreMetadataPatch,
} from "@/lib/content-archive";

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

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const [maxPosition] = await db
      .select({ position: sql<number>`coalesce(max(${modules.position}), 0)` })
      .from(modules)
      .where(and(eq(modules.courseId, courseId), isNull(modules.archivedAt)));

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

    const [current] = await db
      .select()
      .from(modules)
      .where(eq(modules.id, id))
      .limit(1);
    if (!current) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    if (current.archivedAt) {
      await db
        .update(modules)
        .set({ title, position: requestedPosition })
        .where(eq(modules.id, id));
      return NextResponse.json({ success: true });
    }

    await db.transaction(async (tx) => {
      const ordered = await tx
        .select({ id: modules.id })
        .from(modules)
        .where(and(eq(modules.courseId, current.courseId), isNull(modules.archivedAt)))
        .orderBy(asc(modules.position), asc(modules.id));

      const remaining = ordered.filter((item) => item.id !== id);
      const insertAt = Math.min(requestedPosition - 1, remaining.length);
      remaining.splice(insertAt, 0, { id });

      // Reorder only active modules. Archived rows and every lesson relationship
      // keep their IDs and stored content unchanged.
      for (let index = 0; index < remaining.length; index += 1) {
        await tx
          .update(modules)
          .set({ position: index + 1 })
          .where(eq(modules.id, remaining[index].id));
      }

      await tx.update(modules).set({ title }).where(eq(modules.id, id));
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

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = positiveInteger(body.id);
    const action = body.action;
    if (!id || (action !== "archive" && action !== "restore")) {
      return NextResponse.json({ error: "A module and valid action are required" }, { status: 400 });
    }

    const expectedConfirmation = action === "archive" ? "ARCHIVE MODULE" : "RESTORE MODULE";
    if (body.confirmation !== expectedConfirmation) {
      return NextResponse.json(
        { error: `Type ${expectedConfirmation} to confirm this action` },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({
        id: modules.id,
        courseId: modules.courseId,
        position: modules.position,
        archivedAt: modules.archivedAt,
      })
      .from(modules)
      .where(eq(modules.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    if (action === "archive") {
      if (existing.archivedAt) {
        return NextResponse.json({ success: true, alreadyArchived: true });
      }
      await db
        .update(modules)
        .set(archiveMetadataPatch(new Date(), session.user.id))
        .where(and(eq(modules.id, id), isNull(modules.archivedAt)));
      return NextResponse.json({ success: true });
    }

    if (!existing.archivedAt) {
      return NextResponse.json({ success: true, alreadyActive: true });
    }
    await db.transaction(async (tx) => {
      const activeModules = await tx
        .select({ id: modules.id, position: modules.position })
        .from(modules)
        .where(
          and(eq(modules.courseId, existing.courseId), isNull(modules.archivedAt))
        )
        .orderBy(asc(modules.position), asc(modules.id));

      // Keep the archived module's saved order. Shift active neighbors after
      // that slot without changing their relative order.
      for (const activeModule of activeModules
        .filter((module) => module.position >= existing.position)
        .sort((left, right) => right.position - left.position)) {
        await tx
          .update(modules)
          .set({ position: activeModule.position + 1 })
          .where(eq(modules.id, activeModule.id));
      }

      await tx
        .update(modules)
        .set(restoreMetadataPatch())
        .where(eq(modules.id, id));
    });
    return NextResponse.json({ success: true });
  } catch {
    console.error("Module archive/restore failed");
    return NextResponse.json(
      { error: "Module could not be archived or restored" },
      { status: 500 }
    );
  }
}

/** Retain the legacy empty-module deletion route; populated modules are never
 * deleted (the lesson-count guard prevents cascading content deletion). */
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

    const [existing] = await db
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.id, id))
      .limit(1);
    if (!existing) {
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
