import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  activeStudentContent,
  archiveMetadataPatch,
  canStudentAccessLesson,
  canTargetModuleForLesson,
  restoreMetadataPatch,
  withArchiveStatus,
} from "../src/lib/content-archive";
import {
  chooseContinueLesson,
  overallProgressPercentage,
} from "../src/lib/progress";

const archivedAt = new Date("2026-10-13T12:00:00.000Z");

function lessonFixture(overrides: Record<string, unknown> = {}) {
  return {
    lessonId: 12,
    title: "Preserved lesson",
    moduleArchivedAt: null as Date | null,
    lessonArchivedAt: null as Date | null,
    archivedAt: null as Date | null,
    archivedBy: null as number | null,
    videoSource: "https://video.example.test/original.mp4",
    resources: [{ id: 61, title: "Original worksheet", filePath: "documents/worksheet.pdf" }],
    progress: { id: 81, status: "completed", completedAt: "2026-08-01T00:00:00Z" },
    ...overrides,
  };
}

test("archiving a module changes only archive metadata and preserves lessons/resources/progress", () => {
  const originalModule = {
    id: 4,
    title: "Module title",
    position: 2,
    archivedAt: null as Date | null,
    archivedBy: null as number | null,
    lessons: [lessonFixture()],
  };
  const archivedModule = {
    ...originalModule,
    ...archiveMetadataPatch(archivedAt, 9),
  };

  assert.equal(archivedModule.archivedAt, archivedAt);
  assert.equal(archivedModule.archivedBy, 9);
  assert.deepEqual(archivedModule.lessons, originalModule.lessons);
  assert.deepEqual(
    { ...archivedModule, ...restoreMetadataPatch() },
    originalModule
  );
});

test("archived modules and lessons are absent from the active student content set", () => {
  const rows = [
    lessonFixture({ lessonId: 1 }),
    lessonFixture({ lessonId: 2, moduleArchivedAt: archivedAt }),
    lessonFixture({ lessonId: 3, lessonArchivedAt: archivedAt }),
  ];

  assert.deepEqual(activeStudentContent(rows).map((row) => row.lessonId), [1]);
});

test("restoring a module returns the original IDs, title, order, and related lesson data", () => {
  const original = {
    id: 17,
    title: "Original module",
    position: 5,
    lessons: [lessonFixture({ lessonId: 98 })],
    archivedAt: null as Date | null,
    archivedBy: null as number | null,
  };
  const archived = { ...original, ...archiveMetadataPatch(archivedAt, 3) };
  const restored = { ...archived, ...restoreMetadataPatch() };

  assert.deepEqual(restored, original);
});

test("archiving a lesson preserves progress, resources, video URL, and lesson ID", () => {
  const original = lessonFixture();
  const archived = {
    ...original,
    ...archiveMetadataPatch(archivedAt, 2),
    lessonArchivedAt: archivedAt,
  };
  const restored = {
    ...archived,
    ...restoreMetadataPatch(),
    lessonArchivedAt: null,
  };

  assert.equal(archived.lessonId, original.lessonId);
  assert.equal(archived.videoSource, original.videoSource);
  assert.deepEqual(archived.resources, original.resources);
  assert.deepEqual(archived.progress, original.progress);
  assert.deepEqual(restored, original);
});

test("archived lessons are excluded from Continue Learning choices", () => {
  const visibleLessons = activeStudentContent([
    lessonFixture({ lessonId: 1, position: 1, progress: null }),
    lessonFixture({
      lessonId: 2,
      position: 2,
      lessonArchivedAt: archivedAt,
      progress: { status: "in_progress", lastWatchedAt: "2026-10-13T11:00:00Z" },
    }),
    lessonFixture({
      lessonId: 3,
      position: 3,
      progress: { status: "in_progress", lastWatchedAt: "2026-10-13T10:00:00Z" },
    }),
  ]).map((lesson) => ({
    ...lesson,
    position: Number(lesson.lessonId),
    progress: lesson.progress as { status: string; lastWatchedAt?: string } | null,
  }));

  assert.equal(chooseContinueLesson(visibleLessons)?.lessonId, 3);
});

test("archived lessons are excluded from active progress denominators", () => {
  const active = activeStudentContent([
    lessonFixture({ progress: { status: "completed", percentComplete: 100 } }),
    lessonFixture({ lessonArchivedAt: archivedAt, progress: { status: "completed", percentComplete: 100 } }),
    lessonFixture({ moduleArchivedAt: archivedAt, progress: { status: "in_progress", percentComplete: 50 } }),
  ]);

  assert.equal(active.length, 1);
  assert.equal(overallProgressPercentage(active.map((lesson) => lesson.progress)), 100);
});

test("direct student access is denied for archived lessons or archived modules", () => {
  const base = {
    role: "student",
    accessStatus: "active",
    lessonBelongsToCourse: true,
  };
  assert.equal(canStudentAccessLesson(base), true);
  assert.equal(canStudentAccessLesson({ ...base, lessonArchivedAt: archivedAt }), false);
  assert.equal(canStudentAccessLesson({ ...base, moduleArchivedAt: archivedAt }), false);
  assert.equal(canStudentAccessLesson({ ...base, accessStatus: "pending" }), false);
  assert.equal(canStudentAccessLesson({ ...base, role: null }), false);
});

test("administrator progress history keeps archived rows and their progress values", () => {
  const progressRow = {
    lessonId: 77,
    title: "Archived progress",
    status: "completed",
    percentComplete: 100,
    moduleArchivedAt: null,
    lessonArchivedAt: archivedAt,
  };
  const historyRow = withArchiveStatus(progressRow);

  assert.equal(historyRow.isArchived, true);
  assert.equal(historyRow.archiveReason, "lesson");
  assert.equal(historyRow.lessonId, progressRow.lessonId);
  assert.equal(historyRow.status, "completed");
  assert.equal(historyRow.percentComplete, 100);
});

test("lesson moves can target active modules only", () => {
  assert.equal(
    canTargetModuleForLesson({ currentModuleId: 2, targetModuleId: 3, targetModuleArchivedAt: null }),
    true
  );
  assert.equal(
    canTargetModuleForLesson({ currentModuleId: 2, targetModuleId: 3, targetModuleArchivedAt: archivedAt }),
    false
  );
  // An archived lesson may be edited without changing its existing module link.
  assert.equal(
    canTargetModuleForLesson({ currentModuleId: 2, targetModuleId: 2, targetModuleArchivedAt: archivedAt }),
    true
  );
});

test("module cards and headers use the same StorySprint purple gradient", () => {
  const css = readFileSync(resolve("src/app/globals.css"), "utf8");
  const coursePage = readFileSync(resolve("src/app/course/page.tsx"), "utf8");
  const moduleManager = readFileSync(resolve("src/app/admin/modules/ModuleManager.tsx"), "utf8");

  assert.match(css, /--storysprint-purple-gradient:\s*linear-gradient\(/);
  assert.match(css, /\.module-card-purple\{background:var\(--storysprint-purple-gradient\)/);
  assert.match(css, /\.module-outline summary\{[^}]*background:var\(--storysprint-purple-gradient\)/);
  assert.doesNotMatch(css, /\.module-outline:nth-child\(\d+\)/);
  assert.match(coursePage, /module-card-purple/);
  assert.match(moduleManager, /module-card-purple admin-module-card/);
});
