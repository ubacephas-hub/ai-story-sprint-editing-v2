import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { lessons, modules } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { parseYouTubeUrl } from "@/lib/youtube";
import {
  archiveMetadataPatch,
  canTargetModuleForLesson,
  restoreMetadataPatch,
} from "@/lib/content-archive";

function positiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function boundedPosition(value: unknown, fallback = 1): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 100_000
    ? number
    : null;
}

function requiredTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim();
  return title.length >= 1 && title.length <= 240 ? title : null;
}

function optionalDescription(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const description = value.trim();
  return description.length <= 50_000 ? description || null : undefined;
}

function isYouTubeHost(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be",
      "www.youtube-nocookie.com",
    ].includes(host);
  } catch {
    return false;
  }
}

function normalizeVideoSource(value: unknown): {
  videoKind: "none" | "url" | "youtube";
  videoSource: string | null;
  error?: string;
} {
  if (value === undefined || value === null || value === "") {
    return { videoKind: "none", videoSource: null };
  }
  if (typeof value !== "string") {
    return { videoKind: "none", videoSource: null, error: "Video source is invalid" };
  }

  const source = value.trim();
  if (!source) return { videoKind: "none", videoSource: null };
  if (source.length > 2_000) {
    return { videoKind: "none", videoSource: null, error: "Video source is too long" };
  }

  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    return {
      videoKind: "none",
      videoSource: null,
      error: "Video source must be a valid HTTP or HTTPS URL",
    };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      videoKind: "none",
      videoSource: null,
      error: "Video source must use HTTP or HTTPS",
    };
  }

  if (isYouTubeHost(source)) {
    if (!parseYouTubeUrl(source)) {
      return { videoKind: "none", videoSource: null, error: "Invalid YouTube URL" };
    }
    return { videoKind: "youtube", videoSource: source };
  }

  return { videoKind: "url", videoSource: source };
}

async function requireAdmin() {
  const session = await getSession();
  return session?.user.role === "admin" ? session : null;
}

async function lessonModule(moduleId: number) {
  return db
    .select({
      id: modules.id,
      courseId: modules.courseId,
      archivedAt: modules.archivedAt,
    })
    .from(modules)
    .where(eq(modules.id, moduleId))
    .limit(1);
}

function reposition<T extends { id: number }>(
  values: T[],
  lessonId: number,
  requestedPosition: number
): T[] {
  const remaining = values.filter((value) => value.id !== lessonId);
  const insertAt = Math.min(requestedPosition - 1, remaining.length);
  const current = values.find((value) => value.id === lessonId);
  if (current) remaining.splice(insertAt, 0, current);
  return remaining;
}

async function updateLessonOrder(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  lessonId: number,
  sourceModuleId: number,
  targetModuleId: number,
  requestedPosition: number,
  lessonIsArchived: boolean
) {
  const archiveFilter = lessonIsArchived
    ? isNotNull(lessons.archivedAt)
    : isNull(lessons.archivedAt);
  const sourceLessons = await tx
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.moduleId, sourceModuleId), archiveFilter))
    .orderBy(asc(lessons.position), asc(lessons.id));

  if (sourceModuleId === targetModuleId) {
    const ordered = reposition(sourceLessons, lessonId, requestedPosition);
    for (let index = 0; index < ordered.length; index += 1) {
      await tx
        .update(lessons)
        .set({ position: index + 1 })
        .where(eq(lessons.id, ordered[index].id));
    }
    return;
  }

  const targetLessons = await tx
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.moduleId, targetModuleId), archiveFilter))
    .orderBy(asc(lessons.position), asc(lessons.id));

  const sourceRemaining = sourceLessons.filter((lesson) => lesson.id !== lessonId);
  for (let index = 0; index < sourceRemaining.length; index += 1) {
    await tx
      .update(lessons)
      .set({ position: index + 1 })
      .where(eq(lessons.id, sourceRemaining[index].id));
  }

  const targetOrdered = [...targetLessons];
  const insertAt = Math.min(requestedPosition - 1, targetOrdered.length);
  targetOrdered.splice(insertAt, 0, { id: lessonId });
  for (let index = 0; index < targetOrdered.length; index += 1) {
    if (targetOrdered[index].id === lessonId) continue;
    await tx
      .update(lessons)
      .set({ position: index + 1 })
      .where(eq(lessons.id, targetOrdered[index].id));
  }

  await tx
    .update(lessons)
    .set({ moduleId: targetModuleId, position: insertAt + 1 })
    .where(eq(lessons.id, lessonId));
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const moduleId = positiveInteger(body.moduleId);
    const title = requiredTitle(body.title);
    const position = boundedPosition(
      body.position !== undefined ? body.position : body.order
    );
    const description = optionalDescription(
      body.description !== undefined ? body.description : body.content
    );
    if (!moduleId || !title || !position || description === undefined) {
      return NextResponse.json(
        { error: "Module, title, description, and position are required" },
        { status: 400 }
      );
    }

    const [targetModule] = await lessonModule(moduleId);
    if (!targetModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }
    if (targetModule.archivedAt) {
      return NextResponse.json(
        { error: "New lessons can only be created inside an active module" },
        { status: 409 }
      );
    }

    const video = normalizeVideoSource(body.videoSource);
    if (video.error) {
      return NextResponse.json({ error: video.error }, { status: 400 });
    }

    const [lesson] = await db.transaction(async (tx) => {
      const currentLessons = await tx
        .select({ id: lessons.id })
        .from(lessons)
        .where(and(eq(lessons.moduleId, moduleId), isNull(lessons.archivedAt)))
        .orderBy(asc(lessons.position), asc(lessons.id));
      const ordered = [...currentLessons];
      const insertAt = Math.min(position - 1, ordered.length);
      const newLesson = { id: -1 };
      ordered.splice(insertAt, 0, newLesson);

      const [created] = await tx
        .insert(lessons)
        .values({
          moduleId,
          title,
          description,
          position: insertAt + 1,
          videoKind: video.videoKind,
          videoSource: video.videoSource,
        })
        .returning();

      for (let index = 0; index < ordered.length; index += 1) {
        if (ordered[index].id === -1) continue;
        await tx
          .update(lessons)
          .set({ position: index + 1 })
          .where(eq(lessons.id, ordered[index].id));
      }
      return [created];
    });

    return NextResponse.json({ success: true, lesson }, { status: 201 });
  } catch {
    console.error("Lesson creation failed");
    return NextResponse.json(
      { error: "Lesson creation failed" },
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
    const title = requiredTitle(body.title);
    const targetModuleId = positiveInteger(body.moduleId);
    const position = boundedPosition(
      body.position !== undefined ? body.position : body.order
    );
    const description = optionalDescription(
      body.description !== undefined ? body.description : body.content
    );
    if (!id || !title || !targetModuleId || !position || description === undefined) {
      return NextResponse.json(
        { error: "Lesson, module, title, description, and position are required" },
        { status: 400 }
      );
    }

    const [targetModule] = await lessonModule(targetModuleId);
    if (!targetModule) {
      return NextResponse.json({ error: "Target module not found" }, { status: 404 });
    }

    const [currentLesson] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, id))
      .limit(1);
    if (!currentLesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const [currentModule] = await lessonModule(currentLesson.moduleId);
    if (!currentModule || currentModule.courseId !== targetModule.courseId) {
      return NextResponse.json(
        { error: "A lesson can only move within its existing course" },
        { status: 400 }
      );
    }

    if (
      !canTargetModuleForLesson({
        currentModuleId: currentLesson.moduleId,
        targetModuleId,
        targetModuleArchivedAt: targetModule.archivedAt,
      }) ||
      (currentModule.archivedAt !== null && targetModuleId !== currentLesson.moduleId)
    ) {
      return NextResponse.json(
        { error: "Lessons can only be moved between active modules. Restore the current module first." },
        { status: 400 }
      );
    }

    const video = normalizeVideoSource(body.videoSource);
    if (video.error) {
      return NextResponse.json({ error: video.error }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await updateLessonOrder(
        tx,
        currentLesson.id,
        currentLesson.moduleId,
        targetModuleId,
        position,
        currentLesson.archivedAt !== null
      );
      await tx
        .update(lessons)
        .set({
          title,
          description,
          videoKind: video.videoKind,
          videoSource: video.videoSource,
        })
        .where(eq(lessons.id, id));
    });

    return NextResponse.json({ success: true });
  } catch {
    console.error("Lesson update failed");
    return NextResponse.json(
      { error: "Lesson update failed" },
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
      return NextResponse.json({ error: "A lesson and valid action are required" }, { status: 400 });
    }

    const expectedConfirmation = action === "archive" ? "ARCHIVE LESSON" : "RESTORE LESSON";
    if (body.confirmation !== expectedConfirmation) {
      return NextResponse.json(
        { error: `Type ${expectedConfirmation} to confirm this action` },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({
        id: lessons.id,
        moduleId: lessons.moduleId,
        position: lessons.position,
        archivedAt: lessons.archivedAt,
      })
      .from(lessons)
      .where(eq(lessons.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (action === "archive") {
      if (existing.archivedAt) {
        return NextResponse.json({ success: true, alreadyArchived: true });
      }
      await db
        .update(lessons)
        .set(archiveMetadataPatch(new Date(), session.user.id))
        .where(and(eq(lessons.id, id), isNull(lessons.archivedAt)));
      return NextResponse.json({ success: true });
    }

    if (!existing.archivedAt) {
      return NextResponse.json({ success: true, alreadyActive: true });
    }
    await db.transaction(async (tx) => {
      const activeLessons = await tx
        .select({ id: lessons.id, position: lessons.position })
        .from(lessons)
        .where(
          and(eq(lessons.moduleId, existing.moduleId), isNull(lessons.archivedAt))
        )
        .orderBy(asc(lessons.position), asc(lessons.id));

      // Preserve the archived lesson's saved position and shift active siblings
      // after it, so restoration does not overwrite their order.
      for (const activeLesson of activeLessons
        .filter((lesson) => lesson.position >= existing.position)
        .sort((left, right) => right.position - left.position)) {
        await tx
          .update(lessons)
          .set({ position: activeLesson.position + 1 })
          .where(eq(lessons.id, activeLesson.id));
      }

      await tx
        .update(lessons)
        .set(restoreMetadataPatch())
        .where(eq(lessons.id, id));
    });
    return NextResponse.json({ success: true });
  } catch {
    console.error("Lesson archive/restore failed");
    return NextResponse.json(
      { error: "Lesson could not be archived or restored" },
      { status: 500 }
    );
  }
}
