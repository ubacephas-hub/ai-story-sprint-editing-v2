import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { courses, lessonProgress, lessons, modules, users } from "@/db/schema";
import {
  displayPercentage,
  overallProgressPercentage,
} from "@/lib/progress";

export interface AdminLessonProgress {
  lessonId: number;
  title: string;
  moduleTitle: string;
  modulePosition: number;
  lessonPosition: number;
  status: string | null;
  playbackPositionSeconds: number;
  furthestPositionSeconds: number;
  durationSeconds: number | null;
  watchedSeconds: number;
  percentComplete: number;
  updatedAt: Date | null;
  lastWatchedAt: Date | null;
}

export interface AdminProgressSnapshot {
  studentId: number;
  overallPercent: number;
  completedLessons: number;
  totalLessons: number;
  mostRecentLesson: {
    lessonId: number;
    title: string;
    percentComplete: number;
    status: string | null;
    lastWatchedAt: Date;
  } | null;
  lastWatchedAt: Date | null;
  lessons: AdminLessonProgress[];
}

function progressPercent(status: string | null, percentComplete: number | null): number {
  return displayPercentage({ status, percentComplete: percentComplete || 0 });
}

export async function getAdminProgressSnapshots(
  studentId?: number
): Promise<AdminProgressSnapshot[]> {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .limit(1);
  if (!course) return [];

  const studentRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      studentId
        ? and(eq(users.id, studentId), eq(users.role, "student"))
        : eq(users.role, "student")
    );
  if (studentRows.length === 0) return [];

  const courseLessons = await db
    .select({
      lessonId: lessons.id,
      title: lessons.title,
      moduleTitle: modules.title,
      modulePosition: modules.position,
      lessonPosition: lessons.position,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(modules.position), asc(lessons.position), asc(lessons.id));

  const userIds = studentRows.map((student) => student.id);
  const progressRows = await db
    .select({
      userId: lessonProgress.userId,
      lessonId: lessonProgress.lessonId,
      status: lessonProgress.status,
      playbackPositionSeconds: lessonProgress.playbackPositionSeconds,
      furthestPositionSeconds: lessonProgress.furthestPositionSeconds,
      durationSeconds: lessonProgress.durationSeconds,
      watchedSeconds: lessonProgress.watchedSeconds,
      percentComplete: lessonProgress.percentComplete,
      updatedAt: lessonProgress.updatedAt,
      lastWatchedAt: lessonProgress.lastWatchedAt,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(
        eq(modules.courseId, course.id),
        inArray(lessonProgress.userId, userIds)
      )
    );

  const progressByStudent = new Map<string, (typeof progressRows)[number]>();
  for (const row of progressRows) {
    progressByStudent.set(`${row.userId}:${row.lessonId}`, row);
  }

  return studentRows.map((student) => {
    const studentLessons: AdminLessonProgress[] = courseLessons.map((lesson) => {
      const row = progressByStudent.get(`${student.id}:${lesson.lessonId}`);
      return {
        lessonId: lesson.lessonId,
        title: lesson.title,
        moduleTitle: lesson.moduleTitle,
        modulePosition: lesson.modulePosition,
        lessonPosition: lesson.lessonPosition,
        status: row?.status || null,
        playbackPositionSeconds: row?.playbackPositionSeconds || 0,
        furthestPositionSeconds: row?.furthestPositionSeconds || 0,
        durationSeconds: row?.durationSeconds || null,
        watchedSeconds: row?.watchedSeconds || 0,
        percentComplete: progressPercent(row?.status || null, row?.percentComplete || 0),
        updatedAt: row?.updatedAt || null,
        lastWatchedAt: row?.lastWatchedAt || null,
      };
    });

    const watchedLessons = studentLessons
      .filter((lesson) => lesson.lastWatchedAt)
      .sort(
        (left, right) =>
          right.lastWatchedAt!.getTime() - left.lastWatchedAt!.getTime()
      );
    const mostRecent = watchedLessons[0];
    const progressValues = studentLessons.map((lesson) => ({
      status: lesson.status,
      percentComplete: lesson.percentComplete,
    }));

    return {
      studentId: student.id,
      overallPercent: overallProgressPercentage(progressValues),
      completedLessons: studentLessons.filter((lesson) => lesson.status === "completed").length,
      totalLessons: studentLessons.length,
      mostRecentLesson: mostRecent?.lastWatchedAt
        ? {
            lessonId: mostRecent.lessonId,
            title: mostRecent.title,
            percentComplete: mostRecent.percentComplete,
            status: mostRecent.status,
            lastWatchedAt: mostRecent.lastWatchedAt,
          }
        : null,
      lastWatchedAt: mostRecent?.lastWatchedAt || null,
      lessons: studentLessons,
    };
  });
}
