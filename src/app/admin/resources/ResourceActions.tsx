"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LessonOption {
  id: number;
  title: string;
  moduleTitle: string;
}

interface Resource {
  id: number;
  lessonId: number;
  type: string;
  title: string;
  url: string | null;
  content: string | null;
  description: string | null;
}

interface Props {
  lessons: LessonOption[];
  resources: Resource[];
}

export default function ResourceActions({ lessons, resources }: Props) {
  const router = useRouter();
  const [type, setType] = useState("link");
  const [lessonId, setLessonId] = useState(
    lessons.length > 0 ? lessons[0].id : 0
  );
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          lessonId,
          title,
          url: type === "link" ? url : undefined,
          content: type === "text" ? content : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add resource");
      } else {
        setSuccess("Resource added successfully");
        setTitle("");
        setUrl("");
        setContent("");
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  async function handleDelete(resourceId: number) {
    if (!confirm("Delete this resource?")) return;
    try {
      await fetch("/api/admin/resources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resourceId }),
      });
      router.refresh();
    } catch {
      alert("Failed to delete");
    }
  }

  // Group resources by lesson
  const byLesson = new Map<number, Resource[]>();
  for (const r of resources) {
    const arr = byLesson.get(r.lessonId) || [];
    arr.push(r);
    byLesson.set(r.lessonId, arr);
  }

  return (
    <>
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-3">Add Resource</h3>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}
        <form onSubmit={handleAdd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="form-group mb-0">
              <label>Lesson</label>
              <select
                value={lessonId}
                onChange={(e) => setLessonId(Number(e.target.value))}
              >
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.moduleTitle} — {l.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group mb-0">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="link">Link</option>
                <option value="text">Text</option>
                <option value="document">Document</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {type === "link" && (
            <div className="form-group">
              <label>URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
          )}

          {type === "text" && (
            <div className="form-group">
              <label>Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                required
              />
            </div>
          )}

          <button type="submit" className="btn small" disabled={loading}>
            {loading ? "Adding…" : "Add Resource"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-3">All Resources</h3>
        {resources.length === 0 ? (
          <p className="text-[var(--muted)]">No resources added yet.</p>
        ) : (
          <div className="grid gap-3">
            {lessons.map((lesson) => {
              const lessonResources = byLesson.get(lesson.id);
              if (!lessonResources || lessonResources.length === 0) return null;
              return (
                <div key={lesson.id}>
                  <h4 className="text-sm font-bold text-[var(--muted)] mb-2">
                    {lesson.moduleTitle} — {lesson.title}
                  </h4>
                  {lessonResources.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 border border-[var(--line)] rounded-lg mb-2"
                    >
                      <div>
                        <span className="badge text-xs mr-2">{r.type}</span>
                        <span className="font-semibold">{r.title}</span>
                        {r.url && (
                          <span className="text-sm text-[var(--muted)] ml-2">
                            {r.url}
                          </span>
                        )}
                      </div>
                      <button
                        className="btn small danger"
                        onClick={() => handleDelete(r.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
