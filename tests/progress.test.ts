import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_COMPLETION_THRESHOLD,
  calculateWatchedDelta,
  canWritePlaybackProgress,
  chooseContinueLesson,
  completedProgressCount,
  displayPercentage,
  finiteNonNegative,
  normalizedPercentage,
  overallProgressPercentage,
  shouldAutoComplete,
} from "../src/lib/progress";

test("normalizes watched percentage and caps it at 100", () => {
  assert.equal(normalizedPercentage(50, 200), 25);
  assert.equal(normalizedPercentage(300, 200), 100);
  assert.equal(normalizedPercentage(30, null), 0);
  assert.equal(displayPercentage({ status: "completed", percentComplete: 0 }), 100);
  assert.equal(displayPercentage({ status: "in_progress", percentComplete: 125 }), 100);
});

test("rejects invalid playback values before they reach persistence", () => {
  assert.equal(finiteNonNegative(-1), null);
  assert.equal(finiteNonNegative(Number.NaN), null);
  assert.equal(finiteNonNegative(Infinity), null);
  assert.equal(finiteNonNegative(true), null);
  assert.equal(finiteNonNegative(24 * 60 * 60 + 1), null);
  assert.equal(finiteNonNegative("12.5"), 12.5);
});

test("rejects negative or implausibly large watch jumps", () => {
  assert.equal(calculateWatchedDelta(10, 5, "progress", true), 0);
  assert.equal(calculateWatchedDelta(10, 1000, "progress", true), 0);
  assert.equal(calculateWatchedDelta(10, 20, "seeked", true), 0);
  assert.equal(calculateWatchedDelta(10, 20, "progress", false), 0);
  assert.equal(calculateWatchedDelta(10, 20, "progress", true), 10);
  assert.equal(calculateWatchedDelta(80, 100, "ended", true), 20);
});

test("uses a genuine-watch threshold for automatic completion", () => {
  assert.equal(shouldAutoComplete(89, 100), false);
  assert.equal(shouldAutoComplete(90, 100), true);
  assert.equal(shouldAutoComplete(90, 90 / AUTO_COMPLETION_THRESHOLD), true);
  assert.equal(shouldAutoComplete(100, null), false);
});

test("completed rows remain complete and are counted once", () => {
  assert.equal(completedProgressCount([
    { status: "completed", percentComplete: 0 },
    { status: "in_progress", percentComplete: 100 },
    null,
  ]), 1);
  assert.equal(overallProgressPercentage([
    { status: "completed", percentComplete: 0 },
    { status: "in_progress", percentComplete: 50 },
    null,
    null,
  ]), 37.5);
  assert.equal(overallProgressPercentage([
    { status: "completed", percentComplete: 100 },
    { status: "in_progress", percentComplete: 50 },
    { status: "in_progress", percentComplete: 0 },
    { status: "in_progress", percentComplete: 0 },
    { status: "in_progress", percentComplete: 0 },
    { status: "in_progress", percentComplete: 0 },
    { status: "in_progress", percentComplete: 0 },
    { status: "in_progress", percentComplete: 0 },
  ]), 18.75);
});

test("authorization requires a student, active access, and lesson ownership", () => {
  assert.equal(canWritePlaybackProgress({ role: "student", accessStatus: "active", lessonBelongsToCourse: true }), true);
  assert.equal(canWritePlaybackProgress({ role: "admin", accessStatus: "active", lessonBelongsToCourse: true }), false);
  assert.equal(canWritePlaybackProgress({ role: "student", accessStatus: "suspended", lessonBelongsToCourse: true }), false);
  assert.equal(canWritePlaybackProgress({ role: "student", accessStatus: "active", lessonBelongsToCourse: false }), false);
});

test("continue learning chooses the most recently watched incomplete lesson", () => {
  const lessons = [
    { position: 1, progress: null },
    { position: 2, progress: { status: "in_progress", lastWatchedAt: "2026-09-19T08:00:00Z" } },
    { position: 3, progress: { status: "in_progress", lastWatchedAt: "2026-09-19T09:00:00Z" } },
    { position: 4, progress: { status: "completed", lastWatchedAt: "2026-09-19T10:00:00Z" } },
  ];
  assert.equal(chooseContinueLesson(lessons)?.position, 3);
  assert.equal(chooseContinueLesson(lessons.slice(0, 2))?.position, 2);
  assert.equal(chooseContinueLesson([{ position: 1, progress: { status: "completed" } }]), null);
});
