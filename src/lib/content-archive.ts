export type ArchiveTimestamp = Date | string | null | undefined;

export interface ArchiveState {
  archivedAt: ArchiveTimestamp;
  archivedBy?: number | null;
}

export interface StudentContentArchiveState {
  moduleArchivedAt?: ArchiveTimestamp;
  lessonArchivedAt?: ArchiveTimestamp;
}

export interface ArchiveMetadataPatch {
  archivedAt: Date | null;
  archivedBy: number | null;
}

export function archiveMetadataPatch(
  archivedAt: Date,
  archivedBy: number
): ArchiveMetadataPatch {
  return { archivedAt, archivedBy };
}

export function restoreMetadataPatch(): ArchiveMetadataPatch {
  return { archivedAt: null, archivedBy: null };
}

export function isStudentContentActive({
  moduleArchivedAt,
  lessonArchivedAt,
}: StudentContentArchiveState): boolean {
  return moduleArchivedAt == null && lessonArchivedAt == null;
}

export interface StudentLessonAuthorizationInput extends StudentContentArchiveState {
  role: string | null | undefined;
  accessStatus: string | null | undefined;
  lessonBelongsToCourse: boolean;
}

export function canStudentAccessLesson({
  role,
  accessStatus,
  lessonBelongsToCourse,
  moduleArchivedAt,
  lessonArchivedAt,
}: StudentLessonAuthorizationInput): boolean {
  return (
    role === "student" &&
    accessStatus === "active" &&
    lessonBelongsToCourse &&
    isStudentContentActive({ moduleArchivedAt, lessonArchivedAt })
  );
}

export function activeStudentContent<T extends StudentContentArchiveState>(
  content: T[]
): T[] {
  return content.filter(isStudentContentActive);
}

export type ArchiveReason = "lesson" | "module" | null;

export function withArchiveStatus<T extends StudentContentArchiveState>(
  content: T
): T & { isArchived: boolean; archiveReason: ArchiveReason } {
  const archiveReason: ArchiveReason =
    content.lessonArchivedAt != null
      ? "lesson"
      : content.moduleArchivedAt != null
        ? "module"
        : null;

  return {
    ...content,
    isArchived: archiveReason !== null,
    archiveReason,
  };
}

export interface LessonMoveTargetInput {
  currentModuleId: number;
  targetModuleId: number;
  targetModuleArchivedAt?: ArchiveTimestamp;
}

/**
 * An archived module is only an acceptable target when the lesson is already
 * assigned to that same module (for metadata edits that preserve its relation).
 * Actual moves must always target an active module.
 */
export function canTargetModuleForLesson({
  currentModuleId,
  targetModuleId,
  targetModuleArchivedAt,
}: LessonMoveTargetInput): boolean {
  return (
    targetModuleArchivedAt == null || currentModuleId === targetModuleId
  );
}
