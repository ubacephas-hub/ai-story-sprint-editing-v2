"use client";

import { StorageClient } from "@supabase/storage-js";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DOCUMENT_BUCKET,
  getDocumentExtension,
  getDocumentMimeType,
  isSupportedDocumentSize,
  MAX_DOCUMENT_BYTES,
} from "@/lib/document-types";

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
  filePath: string | null;
  description: string | null;
  position: number;
}

interface Props {
  lessons: LessonOption[];
  resources: Resource[];
}

interface UploadResponse {
  path: string;
  token: string;
  bucket: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

function uploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The document upload failed. Check the file and try again.";
}

export default function ResourceActions({ lessons, resources }: Props) {
  const router = useRouter();
  const [type, setType] = useState("link");
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Resource | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTitle("");
    setUrl("");
    setContent("");
    setDescription("");
    setPosition(0);
    setFile(null);
  }

  async function requestUploadUrl(selectedFile: File): Promise<UploadResponse> {
    const response = await fetch("/api/admin/resources/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        contentType: selectedFile.type,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "A secure upload URL could not be created.");
    }
    return data as UploadResponse;
  }

  async function uploadDirectly(
    selectedFile: File,
    upload: UploadResponse
  ): Promise<void> {
    if (!SUPABASE_URL) {
      throw new Error("Document uploads are not configured for this preview.");
    }

    // This browser client has no service key. The one-time token is accepted
    // directly by Supabase Storage, so the document body never crosses Vercel.
    const extension = getDocumentExtension(selectedFile.name, selectedFile.type);
    const contentType = extension
      ? getDocumentMimeType(extension)
      : selectedFile.type || "application/octet-stream";
    const storage = new StorageClient(
      `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1`
    );
    const { error: uploadError } = await storage
      .from(upload.bucket || DOCUMENT_BUCKET)
      .uploadToSignedUrl(upload.path, upload.token, selectedFile, {
        contentType,
      });
    if (uploadError) {
      throw new Error("Supabase could not store the document.");
    }
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setStatus("");
    setSaving(true);

    try {
      let filePath: string | undefined;
      if (type === "document") {
        if (!file) throw new Error("Choose a PDF, DOCX, TXT, or ZIP file first.");
        if (!isSupportedDocumentSize(file.size)) {
          throw new Error(
            `Documents must be ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB or smaller.`
          );
        }
        if (!getDocumentExtension(file.name, file.type)) {
          throw new Error("Only PDF, DOCX, TXT, and ZIP documents are supported.");
        }
        setStatus("Requesting a secure upload URL…");
        const upload = await requestUploadUrl(file);
        setStatus("Uploading directly to private storage…");
        await uploadDirectly(file, upload);
        filePath = upload.path;
      }

      setStatus("Saving resource details…");
      const response = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          lessonId,
          title,
          url: type === "link" ? url : undefined,
          content: type === "text" ? content : undefined,
          filePath,
          description,
          position,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Resource could not be added.");
      }

      setSuccess("Resource added successfully.");
      resetForm();
      setStatus("");
      router.refresh();
    } catch (caught) {
      setError(uploadErrorMessage(caught));
      setStatus("");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    setSuccess("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const nextTitle = String(form.get("edit-title") || "");
    const nextDescription = String(form.get("edit-description") || "");
    const nextPosition = Number(form.get("edit-position") || 0);
    const nextLessonId = Number(form.get("edit-lesson") || 0);
    const nextUrl = String(form.get("edit-url") || "");
    const nextContent = String(form.get("edit-content") || "");

    try {
      const response = await fetch("/api/admin/resources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          lessonId: nextLessonId,
          title: nextTitle,
          description: nextDescription,
          position: nextPosition,
          url: editing.type === "link" ? nextUrl : undefined,
          content: editing.type === "text" ? nextContent : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Resource could not be updated.");
      setEditing(null);
      setSuccess("Resource updated successfully.");
      router.refresh();
    } catch (caught) {
      setError(uploadErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(resourceId: number) {
    if (!confirm("Delete this resource? This also removes its private document file.")) {
      return;
    }
    setError("");
    try {
      const response = await fetch("/api/admin/resources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resourceId, confirmation: "DELETE RESOURCE" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Resource could not be deleted.");
      setSuccess("Resource deleted.");
      router.refresh();
    } catch (caught) {
      setError(uploadErrorMessage(caught));
    }
  }

  const byLesson = new Map<number, Resource[]>();
  for (const resource of resources) {
    const current = byLesson.get(resource.lessonId) || [];
    current.push(resource);
    byLesson.set(resource.lessonId, current);
  }

  return (
    <>
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-1">Add resource</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Links and notes stay in the database. Documents are sent directly from
          this browser to the private Supabase bucket.
        </p>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}
        {status && <div className="alert warning">{status}</div>}
        {lessons.length === 0 ? (
          <p className="text-[var(--muted)]">
            Create a lesson before adding a resource.
          </p>
        ) : (
          <form onSubmit={handleAdd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
                <label htmlFor="resource-lesson">Lesson</label>
                <select
                  id="resource-lesson"
                  value={lessonId}
                  onChange={(event) => setLessonId(Number(event.target.value))}
                  disabled={saving}
                >
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.moduleTitle} — {lesson.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="resource-type">Type</label>
                <select
                  id="resource-type"
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value);
                    setFile(null);
                  }}
                  disabled={saving}
                >
                  <option value="link">Link</option>
                  <option value="text">Text</option>
                  <option value="document">Document</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="resource-title">Title</label>
              <input
                id="resource-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={240}
                required
                disabled={saving}
              />
            </div>

            {type === "link" && (
              <div className="form-group">
                <label htmlFor="resource-url">URL</label>
                <input
                  id="resource-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/resource"
                  required
                  disabled={saving}
                />
              </div>
            )}

            {type === "text" && (
              <div className="form-group">
                <label htmlFor="resource-content">Content</label>
                <textarea
                  id="resource-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={5}
                  maxLength={100_000}
                  required
                  disabled={saving}
                />
              </div>
            )}

            {type === "document" && (
              <div className="form-group">
                <label htmlFor="resource-file">Document file</label>
                <input
                  id="resource-file"
                  type="file"
                  accept=".pdf,.docx,.txt,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  required
                  disabled={saving}
                />
                <p className="text-sm text-[var(--muted)] mt-1">
                  PDF, DOCX, TXT, or ZIP. Maximum 25 MB. The bucket remains private.
                </p>
                {file && (
                  <p className="text-sm text-[var(--ok)] mt-1">
                    Selected: {file.name} ({Math.ceil(file.size / 1024)} KB)
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
              <div className="form-group">
                <label htmlFor="resource-description">Description (optional)</label>
                <input
                  id="resource-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2_000}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="resource-position">Order</label>
                <input
                  id="resource-position"
                  type="number"
                  min={0}
                  value={position}
                  onChange={(event) => setPosition(Number(event.target.value))}
                  disabled={saving}
                />
              </div>
            </div>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Saving…" : "Add resource"}
            </button>
          </form>
        )}
      </div>

      {editing && (
        <div className="card mb-6" id="edit-resource">
          <div className="flex justify-between gap-3 items-start mb-3">
            <div>
              <h2 className="text-lg font-semibold">Edit resource</h2>
              <p className="text-sm text-[var(--muted)]">
                Change its lesson assignment, title, description, order, or text/link value.
              </p>
            </div>
            <button
              type="button"
              className="btn small secondary"
              onClick={() => setEditing(null)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
          <form onSubmit={saveEdit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
                <label htmlFor="edit-lesson">Lesson</label>
                <select id="edit-lesson" name="edit-lesson" defaultValue={editing.lessonId} required>
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.moduleTitle} — {lesson.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-position">Order</label>
                <input id="edit-position" name="edit-position" type="number" min={0} defaultValue={editing.position} required />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="edit-title">Title</label>
              <input id="edit-title" name="edit-title" defaultValue={editing.title} maxLength={240} required />
            </div>
            {editing.type === "link" && (
              <div className="form-group">
                <label htmlFor="edit-url">URL</label>
                <input id="edit-url" name="edit-url" type="url" defaultValue={editing.url || ""} required />
              </div>
            )}
            {editing.type === "text" && (
              <div className="form-group">
                <label htmlFor="edit-content">Content</label>
                <textarea id="edit-content" name="edit-content" defaultValue={editing.content || ""} rows={5} required />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="edit-description">Description</label>
              <input id="edit-description" name="edit-description" defaultValue={editing.description || ""} maxLength={2_000} />
            </div>
            <button className="btn" disabled={saving}>
              {saving ? "Saving…" : "Save resource"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">All resources</h2>
        {resources.length === 0 ? (
          <p className="text-[var(--muted)]">No resources added yet.</p>
        ) : (
          <div className="grid gap-4">
            {lessons.map((lesson) => {
              const lessonResources = byLesson.get(lesson.id);
              if (!lessonResources?.length) return null;
              return (
                <section key={lesson.id}>
                  <h3 className="text-sm font-bold text-[var(--muted)] mb-2">
                    {lesson.moduleTitle} — {lesson.title}
                  </h3>
                  {lessonResources.map((resource) => (
                    <div
                      key={resource.id}
                      className="flex items-center justify-between gap-3 p-3 border border-[var(--line)] rounded-lg mb-2 flex-wrap"
                    >
                      <div className="min-w-0">
                        <span className="badge text-xs mr-2">{resource.type}</span>
                        <span className="font-semibold">{resource.title}</span>
                        {resource.type === "document" && (
                          <p className="text-xs text-[var(--muted)] mt-1">
                            Private document stored in Supabase Storage
                          </p>
                        )}
                        {resource.url && (
                          <p className="text-sm text-[var(--muted)] truncate mt-1">
                            {resource.url}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {resource.type === "document" && (
                          <a
                            className="btn small secondary no-underline"
                            href={`/api/resources/${resource.id}/download`}
                          >
                            Download
                          </a>
                        )}
                        <button
                          className="btn small secondary"
                          onClick={() => {
                            setEditing(resource);
                            window.setTimeout(() => document.getElementById("edit-resource")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn small danger"
                          onClick={() => handleDelete(resource.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
