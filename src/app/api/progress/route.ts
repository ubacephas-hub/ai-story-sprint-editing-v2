import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseAccess, lessonProgress, lessons, modules } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  calculateWatchedDelta,
  canWritePlaybackProgress,
  finiteNonNegative,
  normalizedPercentage,
  shouldAutoComplete,
  MAX_VIDEO_SECONDS,
  MAX_WATCH_INCREMENT_SECONDS,
} from "@/lib/progress";

const PLAYBACK_EVENTS = new Set([
  "play",
  "progress",
  "pause",
  "seeked",
  "ended",
  "hidden",
  "unmount",
]);

function positiveInteger(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function optionalPlaybackNumber(
  body: Record<string, unknown>,
  key: string
): { value: number | null; valid: boolean } {
  if (body[key] === undefined || body[key] === null || body[key] === "") {
    return { value: null, valid: true };
  }
  const value = finiteNonNegative(body[key], MAX_VIDEO_SECONDS);
  return { value, valid: value !== null };
}

function numberOrZero(value: number | null | undefined): number {
  return Number.isFinite(value) && value !== null && value !== undefined
    ? Math.max(0, value)
    : 0;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "student") {
      return NextResponse.json(
        { error: "Student access is required" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const lessonId = positiveInteger(body.lessonId);
    if (!lessonId) {
      return NextResponse.json({ error: "A valid lesson is required" }, { status: 400 });
    }

    const [lesson] = await db
      .select({ lessonId: lessons.id, courseId: modules.courseId })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .innerJoin(
        courseAccess,
        and(
          eq(courseAccess.courseId, modules.courseId),
          eq(courseAccess.userId, session.user.id),
          eq(courseAccess.status, "active")
        )
      )
      .where(eq(lessons.id, lessonId))
      .limit(1);

    if (
      !canWritePlaybackProgress({
        role: session.user.role,
        accessStatus: lesson ? "active" : "none",
        lessonBelongsToCourse: Boolean(lesson),
      })
    ) {
      return NextResponse.json(
        { error: "Active course access is required" },
        { status: 403 }
      );
    }

    const requestedStatus = body.status;
    const hasManualStatus = requestedStatus !== undefined;
    if (
      hasManualStatus &&
      requestedStatus !== "in_progress" &&
      requestedStatus !== "completed"
    ) {
      return NextResponse.json({ error: "Invalid progress status" }, { status: 400 });
    }

    const requestedEvent = typeof body.event === "string" ? body.event : null;
    const event = requestedEvent || (hasManualStatus ? "manual" : "progress");
    if (!PLAYBACK_EVENTS.has(event) && event !== "manual") {
      return NextResponse.json({ error: "Invalid progress event" }, { status: 400 });
    }

    const positionInput = optionalPlaybackNumber(body, "positionSeconds");
    const durationInput = optionalPlaybackNumber(body, "durationSeconds");
    const furthestInput = optionalPlaybackNumber(body, "furthestPositionSeconds");
    const watchedInput = optionalPlaybackNumber(body, "watchedSeconds");
    const percentInput =
      body.percentComplete === undefined || body.percentComplete === null || body.percentComplete === ""
        ? { value: null, valid: true }
        : (() => {
            const value = finiteNonNegative(body.percentComplete, 100);
            return { value, valid: value !== null };
          })();
    const timestampInput = body.timestamp;
    const timestampValid =
      timestampInput === undefined ||
      (typeof timestampInput === "string" && Number.isFinite(Date.parse(timestampInput)));
    if (
      !positionInput.valid ||
      !durationInput.valid ||
      !furthestInput.valid ||
      !watchedInput.valid ||
      !percentInput.valid ||
      !timestampValid
    ) {
      return NextResponse.json(
        { error: "Playback values must be finite, non-negative, and reasonable" },
        { status: 400 }
      );
    }

    const isPlaybackEvent = event !== "manual";
    const telemetryFields = [
      "status",
      "durationSeconds",
      "furthestPositionSeconds",
      "watchedSeconds",
      "percentComplete",
      "timestamp",
      "activelyPlaying",
    ];
    if (
      isPlaybackEvent &&
      !telemetryFields.every((field) => Object.prototype.hasOwnProperty.call(body, field))
    ) {
      return NextResponse.json(
        { error: "Complete playback telemetry is required" },
        { status: 400 }
      );
    }
    if (isPlaybackEvent && positionInput.value === null) {
      return NextResponse.json(
        { error: "A playback position is required" },
        { status: 400 }
      );
    }
    if (
      body.activelyPlaying !== undefined &&
      typeof body.activelyPlaying !== "boolean"
    ) {
      return NextResponse.json({ error: "Invalid playback state" }, { status: 400 });
    }

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      // Insert a default row first, then read the unique row. This makes repeat
      // events safe even when two browser tabs start at nearly the same time.
      await tx
        .insert(lessonProgress)
        .values({ userId: session.user.id, lessonId })
        .onConflictDoNothing({
          target: [lessonProgress.userId, lessonProgress.lessonId],
        });

      const [existing] = await tx
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, session.user.id),
            eq(lessonProgress.lessonId, lessonId)
          )
        )
        .limit(1)
        .for("update");

      if (!existing) throw new Error("Progress row could not be loaded");

      const alreadyCompleted = existing.status === "completed";
      const existingPosition = numberOrZero(existing.playbackPositionSeconds);
      const existingFurthest = numberOrZero(existing.furthestPositionSeconds);
      const existingWatched = numberOrZero(existing.watchedSeconds);
      const duration = durationInput.value ?? existing.durationSeconds ?? null;
      const currentPosition = isPlaybackEvent
        ? Math.min(positionInput.value ?? 0, duration || MAX_VIDEO_SECONDS)
        : existingPosition;
      const activelyPlaying = body.activelyPlaying === true;

      if (event === "manual") {
        const manuallyCompleted = requestedStatus === "completed";
        const nextStatus = alreadyCompleted || manuallyCompleted
          ? "completed"
          : "in_progress";
        const nextPercent = nextStatus === "completed"
          ? 100
          : normalizedPercentage(existingWatched, duration);

        const [updated] = await tx
          .update(lessonProgress)
          .set({
            status: nextStatus,
            durationSeconds: duration,
            percentComplete: nextPercent,
            completedAt:
              nextStatus === "completed"
                ? existing.completedAt || now
                : existing.completedAt,
            updatedAt: now,
          })
          .where(eq(lessonProgress.id, existing.id))
          .returning();
        return { progress: updated, automaticallyCompleted: false };
      }

      const elapsedSinceLastSave = existing.lastWatchedAt
        ? Math.max(0, (now.getTime() - existing.lastWatchedAt.getTime()) / 1000)
        : MAX_WATCH_INCREMENT_SECONDS;
      const serverDeltaLimit = Math.min(
        MAX_WATCH_INCREMENT_SECONDS,
        Math.max(5, elapsedSinceLastSave + 5)
      );
      const watchedDelta = calculateWatchedDelta(
        existingPosition,
        currentPosition,
        event,
        activelyPlaying,
        serverDeltaLimit
      );
      const watchedSeconds = Math.min(
        existingWatched + watchedDelta,
        duration || MAX_VIDEO_SECONDS
      );
      const furthestPositionSeconds = Math.max(
        existingFurthest,
        currentPosition
      );
      const percentComplete = normalizedPercentage(watchedSeconds, duration);
      const hasMeaningfulWatch =
        activelyPlaying ||
        existing.startedAt !== null ||
        existingWatched > 0;
      const automaticallyCompleted =
        !alreadyCompleted && shouldAutoComplete(watchedSeconds, duration);
      const nextStatus = alreadyCompleted || automaticallyCompleted
        ? "completed"
        : "in_progress";

      const [updated] = await tx
        .update(lessonProgress)
        .set({
          status: nextStatus,
          playbackPositionSeconds: currentPosition,
          furthestPositionSeconds,
          durationSeconds: duration,
          watchedSeconds,
          percentComplete: alreadyCompleted ? 100 : percentComplete,
          startedAt: hasMeaningfulWatch ? existing.startedAt || now : existing.startedAt,
          lastWatchedAt: hasMeaningfulWatch ? now : existing.lastWatchedAt,
          completedAt:
            nextStatus === "completed"
              ? existing.completedAt || now
              : existing.completedAt,
          updatedAt: now,
        })
        .where(eq(lessonProgress.id, existing.id))
        .returning();

      return { progress: updated, automaticallyCompleted };
    });

    return NextResponse.json({
      success: true,
      automaticallyCompleted: result.automaticallyCompleted,
      savedAt: result.progress.lastWatchedAt || result.progress.updatedAt || now,
      progress: result.progress,
    });
  } catch (error) {
    console.error("Progress save failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Progress could not be saved" }, { status: 500 });
  }
}
