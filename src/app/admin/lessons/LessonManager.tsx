"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModuleOption {
  id: number;
  title: string;
  position: number;
  archivedAt: Date | string | null;
}

interface LessonItem {
  id: number;
  moduleId: number;
  title: string;
  description: string | null;
  position: number;
  videoKind: string;
  videoSource: string | null;
  archivedAt: Date | string | null;
}

interface Props {
  modules: ModuleOption[];
  lessonsByModule: Array<{ module: ModuleOption; lessons: LessonItem[] }>;
}

type Tab = "active" | "archived";

export default function LessonManager({ modules, lessonsByModule }: Props) {
  const router = useRouter();
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState(1);
  const [videoSource, setVideoSource] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const activeGroups = lessonsByModule
    .filter(({ module }) => !module.archivedAt)
    .map(({ module, lessons }) => ({
      module,
      lessons: lessons.filter((lesson) => !lesson.archivedAt),
    }));
  const archivedGroups = lessonsByModule
    .map(({ module, lessons }) => ({
      module,
      lessons: lessons.filter((lesson) => Boolean(module.archivedAt || lesson.archivedAt)),
    }))
    .filter(({ lessons }) => lessons.length > 0);
  const activeCount = activeGroups.reduce((sum, group) => sum + group.lessons.length, 0);
  const archivedCount = archivedGroups.reduce((sum, group) => sum + group.lessons.length, 0);

  async function request(
    method: "POST" | "PATCH",
    body: object,
    successMessage: string
  ): Promise<boolean> {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/lessons", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Lesson changes could not be saved.");
        return false;
      }
      setSuccess(successMessage);
      router.refresh();
      return true;
    } catch {
      setError("The lesson request failed. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!moduleId) return;
    if (
      await request(
        "POST",
        { moduleId, title, description, position, videoSource },
        "Lesson created. It is now visible in the active lesson list."
      )
    ) {
      setTitle("");
      setDescription("");
      setPosition(1);
      setVideoSource("");
    }
  }

  async function archiveLesson(lesson: LessonItem) {
    const typedConfirmation = window.prompt(
      `Archiving “${lesson.title}” hides it from students and preserves its progress and resources. Type ARCHIVE LESSON to continue.`
    );
    if (typedConfirmation !== "ARCHIVE LESSON") {
      setSuccess("Lesson was not archived. No content was changed.");
      return;
    }
    await request(
      "PATCH",
      { id: lesson.id, action: "archive", confirmation: typedConfirmation },
      `“${lesson.title}” was archived. Its video, resources, and progress are preserved.`
    );
  }

  async function restoreLesson(lesson: LessonItem, parentArchived: boolean) {
    if (!window.confirm(`Restore “${lesson.title}” as an active lesson?`)) {
      setSuccess("Lesson was not restored.");
      return;
    }
    const restored = await request(
      "PATCH",
      { id: lesson.id, action: "restore", confirmation: "RESTORE LESSON" },
      parentArchived
        ? `“${lesson.title}” was restored. It will remain hidden until its module is restored.`
        : `“${lesson.title}” was restored with its saved content and progress.`
    );
    if (restored) setTab(parentArchived ? "archived" : "active");
  }

  return (
    <>
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-1">Create lesson</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Choose an active module, set the order, and optionally attach a
          YouTube or direct video URL. Existing lesson IDs and progress are not
          changed.
        </p>
        {error && <div className="alert error" role="alert">{error}</div>}
        {success && <div className="alert success" role="status">{success}</div>}
        {modules.length === 0 ? (
          <p className="text-[var(--muted)]">
            There are no active modules. <Link href="/admin/modules">Create or restore a module</Link> first.
          </p>
        ) : (
          <form onSubmit={createLesson}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
                <label htmlFor="lesson-module">Module</label>
                <select
                  id="lesson-module"
                  value={moduleId}
                  onChange={(event) => setModuleId(Number(event.target.value))}
                >
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      Module {module.position} — {module.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="lesson-position">Order</label>
                <input
                  id="lesson-position"
                  type="number"
                  min={1}
                  value={position}
                  onChange={(event) => setPosition(Number(event.target.value))}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="lesson-title">Lesson title</label>
              <input
                id="lesson-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={240}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="lesson-description">Description / content</label>
              <textarea
                id="lesson-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={50_000}
                placeholder="Add the lesson description or supporting content"
              />
            </div>
            <div className="form-group">
              <label htmlFor="lesson-video">
                YouTube or direct video URL{" "}
                <span className="text-sm text-[var(--muted)] font-normal">(optional)</span>
              </label>
              <input
                id="lesson-video"
                type="url"
                value={videoSource}
                onChange={(event) => setVideoSource(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Creating…" : "Create lesson"}
            </button>
          </form>
        )}
      </div>

      <div className="content-tabs" role="tablist" aria-label="Lesson status">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "active"}
          className={tab === "active" ? "content-tab active" : "content-tab"}
          onClick={() => setTab("active")}
        >
          Active <span>{activeCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "archived"}
          className={tab === "archived" ? "content-tab active" : "content-tab"}
          onClick={() => setTab("archived")}
        >
          Archived <span>{archivedCount}</span>
        </button>
      </div>

      {tab === "active" ? (
        activeGroups.length === 0 ? (
          <div className="soft-card text-center text-[var(--muted)]">
            No active modules are available. Restore a module or create one above.
          </div>
        ) : (
          <div className="grid gap-4">
            {activeGroups.map(({ module, lessons }) => (
              <section key={module.id} className="card">
                <div className="flex justify-between gap-3 items-center mb-3">
                  <h2 className="text-lg font-semibold">
                    Module {module.position} — {module.title}
                  </h2>
                  <span className="badge">{lessons.length} active lessons</span>
                </div>
                {lessons.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No active lessons yet.</p>
                ) : (
                  <div className="grid gap-2">
                    {lessons.map((lesson) => (
                      <div className="lesson-admin-row" key={lesson.id}>
                        <Link href={`/admin/lessons/${lesson.id}`} className="lesson-admin-edit">
                          <span className="min-w-0">
                            <span className="font-semibold">{lesson.position}. {lesson.title}</span>
                            {lesson.videoSource && (
                              <span className="ml-2 text-xs text-[var(--ok)] font-bold">Video attached</span>
                            )}
                            {lesson.description && (
                              <span className="block text-sm text-[var(--muted)] truncate mt-1">
                                {lesson.description}
                              </span>
                            )}
                          </span>
                          <span className="text-[var(--brand)] text-sm font-semibold shrink-0">Edit →</span>
                        </Link>
                        <button
                          type="button"
                          className="btn small danger"
                          disabled={saving}
                          onClick={() => void archiveLesson(lesson)}
                        >
                          Archive
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )
      ) : archivedGroups.length === 0 ? (
        <div className="soft-card text-center text-[var(--muted)]">
          <strong className="block text-[var(--ink)]">No archived lessons</strong>
          Archived lessons and lessons inside archived modules will appear here.
        </div>
      ) : (
        <div className="grid gap-4">
          {archivedGroups.map(({ module, lessons }) => (
            <section key={module.id} className="card">
              <div className="flex justify-between gap-3 items-center mb-3">
                <div>
                  {module.archivedAt && <span className="badge archived-badge">Module archived</span>}
                  <h2 className="text-lg font-semibold mt-1">
                    Module {module.position} — {module.title}
                  </h2>
                </div>
                <span className="badge">{lessons.length} archived lessons</span>
              </div>
              <div className="grid gap-2">
                {lessons.map((lesson) => (
                  <div className="lesson-admin-row archived-content-card" key={lesson.id}>
                    <Link href={`/admin/lessons/${lesson.id}`} className="lesson-admin-edit">
                      <span className="min-w-0">
                        <span className="badge archived-badge">
                          {lesson.archivedAt ? "Archived lesson" : "Hidden by archived module"}
                        </span>
                        <span className="block font-semibold mt-1">{lesson.position}. {lesson.title}</span>
                        {lesson.videoSource && (
                          <span className="text-xs text-[var(--ok)] font-bold">Video attached</span>
                        )}
                        {lesson.description && (
                          <span className="block text-sm text-[var(--muted)] truncate mt-1">
                            {lesson.description}
                          </span>
                        )}
                      </span>
                      <span className="text-[var(--brand)] text-sm font-semibold shrink-0">Inspect →</span>
                    </Link>
                    {lesson.archivedAt && (
                      <button
                        type="button"
                        className="btn small"
                        disabled={saving}
                        onClick={() => void restoreLesson(lesson, Boolean(module.archivedAt))}
                      >
                        Restore lesson
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
