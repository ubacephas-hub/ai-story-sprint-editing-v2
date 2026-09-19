"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPlaybackTime } from "@/lib/progress";

interface LessonProgressRow {
  lessonId: number;
  title: string;
  moduleTitle: string;
  modulePosition: number;
  lessonPosition: number;
  status: string | null;
  playbackPositionSeconds: number;
  durationSeconds: number | null;
  watchedSeconds: number;
  percentComplete: number;
  lastWatchedAt: string | Date | null;
}

interface Snapshot {
  studentId: number;
  overallPercent: number;
  completedLessons: number;
  totalLessons: number;
  mostRecentLesson: {
    lessonId: number;
    title: string;
    percentComplete: number;
    status: string | null;
    lastWatchedAt: string | Date;
  } | null;
  lastWatchedAt: string | Date | null;
  lessons: LessonProgressRow[];
}

function formatDate(value: string | Date | null): string {
  if (!value) return "Not watched";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not watched" : date.toLocaleString();
}

function statusLabel(status: string | null, percent: number): string {
  if (status === "completed") return "Completed";
  if (status === "in_progress" || percent > 0) return "In progress";
  return "Not started";
}

export default function StudentProgressLive({
  studentId,
  initialSnapshot,
}: {
  studentId: number;
  initialSnapshot: Snapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/admin/progress?studentId=${studentId}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { snapshots?: Snapshot[] };
      if (data.snapshots?.[0]) setSnapshot(data.snapshots[0]);
    } finally {
      setRefreshing(false);
    }
  }, [studentId]);

  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      if (timer) window.clearInterval(timer);
      timer = undefined;
      if (document.visibilityState === "visible") {
        timer = window.setInterval(() => void refresh(), 20_000);
      }
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, [refresh]);

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="soft-card">
          <span className="text-sm text-[var(--muted)]">Overall progress</span>
          <strong className="block text-2xl">{Math.round(snapshot.overallPercent)}%</strong>
        </div>
        <div className="soft-card">
          <span className="text-sm text-[var(--muted)]">Lessons completed</span>
          <strong className="block text-2xl">{snapshot.completedLessons}/{snapshot.totalLessons}</strong>
        </div>
        <div className="soft-card">
          <span className="text-sm text-[var(--muted)]">Most recent lesson</span>
          <strong className="block truncate">{snapshot.mostRecentLesson?.title || "Not started"}</strong>
        </div>
        <div className="soft-card">
          <span className="text-sm text-[var(--muted)]">Last watched</span>
          <strong className="block text-sm">{formatDate(snapshot.lastWatchedAt)}</strong>
        </div>
      </div>

      <div className="soft-card mb-5">
        <div className="flex justify-between items-center gap-3">
          <strong>Course progress</strong>
          <span>{Math.round(snapshot.overallPercent)}%</span>
        </div>
        <div className="progress-bar mt-3">
          <span className="progress-bar-fill" style={{ width: `${snapshot.overallPercent}%` }} />
        </div>
        <div className="flex justify-between gap-3 flex-wrap mt-3 text-sm text-[var(--muted)]">
          <span>Completed lessons: {snapshot.completedLessons}</span>
          <span>Auto-refresh: every 20 seconds while visible</span>
          <button className="btn small secondary" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      </div>

      <section className="soft-card">
        <h2 className="text-xl font-bold mb-4">Lesson progress</h2>
        <div className="grid gap-2">
          {snapshot.lessons.map((lesson) => {
            const label = statusLabel(lesson.status, lesson.percentComplete);
            return (
              <div key={lesson.lessonId} className="p-3 border border-[var(--line)] rounded-lg">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <small className="text-[var(--muted)]">
                      {lesson.moduleTitle} · Lesson {lesson.lessonPosition}
                    </small>
                    <strong className="block">{lesson.title}</strong>
                  </div>
                  <span className={`badge ${label === "In progress" ? "in-progress" : label.toLowerCase()}`}>
                    {label}
                  </span>
                </div>
                <div className="flex justify-between gap-3 flex-wrap mt-3 text-sm text-[var(--muted)]">
                  <span>
                    {formatPlaybackTime(lesson.playbackPositionSeconds)} / {formatPlaybackTime(lesson.durationSeconds)}
                  </span>
                  <strong className="text-[var(--brand)]">{Math.round(lesson.percentComplete)}% watched</strong>
                  <span>Last watched: {formatDate(lesson.lastWatchedAt)}</span>
                </div>
                <div className="progress-bar mt-2">
                  <span className="progress-bar-fill" style={{ width: `${lesson.percentComplete}%` }} />
                </div>
              </div>
            );
          })}
          {snapshot.lessons.length === 0 && (
            <p className="text-[var(--muted)]">No lessons are available for this course.</p>
          )}
        </div>
      </section>
    </>
  );
}
