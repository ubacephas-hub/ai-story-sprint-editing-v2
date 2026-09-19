"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModuleOption {
  id: number;
  title: string;
  position: number;
}

interface LessonItem {
  id: number;
  moduleId: number;
  title: string;
  description: string | null;
  position: number;
  videoKind: string;
  videoSource: string | null;
}

interface Props {
  modules: ModuleOption[];
  lessonsByModule: Array<{ module: ModuleOption; lessons: LessonItem[] }>;
}

export default function LessonManager({ modules, lessonsByModule }: Props) {
  const router = useRouter();
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState(1);
  const [videoSource, setVideoSource] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function createLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          title,
          description,
          position,
          videoSource,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Lesson could not be created.");
        return;
      }
      setTitle("");
      setDescription("");
      setPosition(1);
      setVideoSource("");
      setSuccess("Lesson created. It is now visible in the lesson list.");
      router.refresh();
    } catch {
      setError("The lesson request failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-1">Create lesson</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Choose any module, set the order, and optionally attach a YouTube or
          direct video URL. The lesson is added without changing existing IDs
          or student progress.
        </p>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}
        {modules.length === 0 ? (
          <p className="text-[var(--muted)]">
            Create a module before adding lessons.
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
                YouTube or direct video URL
                <span className="text-sm text-[var(--muted)] font-normal">
                  {" "}
                  (optional)
                </span>
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

      <div className="grid gap-4">
        {lessonsByModule.map(({ module, lessons }) => (
          <section key={module.id} className="card">
            <div className="flex justify-between gap-3 items-center mb-3">
              <h2 className="text-lg font-semibold">
                Module {module.position} — {module.title}
              </h2>
              <span className="badge">{lessons.length} lessons</span>
            </div>
            {lessons.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No lessons yet.</p>
            ) : (
              <div className="grid gap-2">
                {lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/admin/lessons/${lesson.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--line)] hover:border-[var(--brand)] hover:bg-[#f8f7ff] transition-colors no-underline text-[var(--ink)]"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold">{lesson.position}. {lesson.title}</span>
                      {lesson.videoSource && (
                        <span className="ml-2 text-xs text-[var(--ok)] font-bold">
                          Video attached
                        </span>
                      )}
                      {lesson.description && (
                        <p className="text-sm text-[var(--muted)] truncate mt-1">
                          {lesson.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[var(--brand)] text-sm font-semibold shrink-0">
                      Edit →
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
