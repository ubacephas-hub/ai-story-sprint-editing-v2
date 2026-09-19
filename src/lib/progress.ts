export const PLAYBACK_SAVE_INTERVAL_MS = 12_000;
export const AUTO_COMPLETION_THRESHOLD = 0.9;
export const MAX_VIDEO_SECONDS = 24 * 60 * 60;
export const MAX_WATCH_INCREMENT_SECONDS = 45;

export type ProgressStatus = "in_progress" | "completed";

export interface PlaybackAuthorizationInput {
  role: string | null | undefined;
  accessStatus: string | null | undefined;
  lessonBelongsToCourse: boolean;
}

export function canWritePlaybackProgress({
  role,
  accessStatus,
  lessonBelongsToCourse,
}: PlaybackAuthorizationInput): boolean {
  return (
    role === "student" &&
    accessStatus === "active" &&
    lessonBelongsToCourse
  );
}

export interface ProgressLike {
  status?: string | null;
  percentComplete?: number | null;
  lastWatchedAt?: Date | string | null;
}

export interface ContinueLessonLike {
  position: number;
  progress: ProgressLike | null;
}

export function finiteNonNegative(
  value: unknown,
  maximum = MAX_VIDEO_SECONDS
): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(number) || number < 0 || number > maximum) return null;
  return number;
}

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function normalizedPercentage(
  watchedSeconds: number,
  durationSeconds: number | null | undefined
): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  return clampPercentage((Math.max(0, watchedSeconds) / durationSeconds) * 100);
}

export function displayPercentage(progress: ProgressLike | null | undefined): number {
  if (!progress) return 0;
  if (progress.status === "completed") return 100;
  return clampPercentage(progress.percentComplete || 0);
}

export function calculateWatchedDelta(
  previousPositionSeconds: number,
  currentPositionSeconds: number,
  event: string,
  activelyPlaying: boolean,
  maximumDelta = MAX_WATCH_INCREMENT_SECONDS
): number {
  if (!activelyPlaying) return 0;
  if (!["progress", "pause", "ended"].includes(event)) return 0;

  const previous = Math.max(0, previousPositionSeconds);
  const current = Math.max(0, currentPositionSeconds);
  const delta = current - previous;

  // A large forward jump is treated as seeking, not viewing. The client sends
  // a separate seeked event, which never contributes watched time.
  if (delta <= 0 || delta > maximumDelta) return 0;
  return delta;
}

export function shouldAutoComplete(
  watchedSeconds: number,
  durationSeconds: number | null | undefined
): boolean {
  if (!durationSeconds || durationSeconds <= 0) return false;
  return (
    Math.max(0, watchedSeconds) + 1e-9 >=
    durationSeconds * AUTO_COMPLETION_THRESHOLD
  );
}

export function overallProgressPercentage(
  progress: Array<ProgressLike | null | undefined>
): number {
  if (progress.length === 0) return 0;
  const total = progress.reduce((sum, item) => sum + displayPercentage(item), 0);
  // Keep a useful precision for the database/UI while avoiding floating point
  // noise such as 18.749999999999996.
  return Math.round((total / progress.length) * 100) / 100;
}

export function completedProgressCount(
  progress: Array<ProgressLike | null | undefined>
): number {
  return progress.filter((item) => item?.status === "completed").length;
}

export function chooseContinueLesson<T extends ContinueLessonLike>(
  lessons: T[]
): T | null {
  const incomplete = lessons.filter((item) => item.progress?.status !== "completed");
  if (incomplete.length === 0) return null;

  const watched = incomplete
    .filter((item) => item.progress?.lastWatchedAt)
    .sort((left, right) => {
      const leftTime = new Date(String(left.progress?.lastWatchedAt)).getTime();
      const rightTime = new Date(String(right.progress?.lastWatchedAt)).getTime();
      return rightTime - leftTime;
    });

  return watched[0] || incomplete.slice().sort((left, right) => left.position - right.position)[0];
}

export function formatPlaybackTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "--:--";
  }
  const rounded = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = rounded % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
