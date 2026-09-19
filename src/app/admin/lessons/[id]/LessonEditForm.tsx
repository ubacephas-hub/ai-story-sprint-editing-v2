"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getYouTubeEmbedUrl, parseYouTubeUrl } from "@/lib/youtube";

interface Lesson {
  id: number;
  moduleId: number;
  title: string;
  description: string | null;
  position: number;
  videoKind: string;
  videoSource: string | null;
}

interface ModuleOption {
  id: number;
  title: string;
  position: number;
}

interface Props {
  lesson: Lesson;
  modules: ModuleOption[];
}

export default function LessonEditForm({ lesson, modules }: Props) {
  const router = useRouter();
  const [moduleId, setModuleId] = useState(lesson.moduleId);
  const [position, setPosition] = useState(Math.max(1, lesson.position));
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description || "");
  const [videoSource, setVideoSource] = useState(lesson.videoSource || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoError, setVideoError] = useState("");

  const youtubeId = videoSource ? parseYouTubeUrl(videoSource) : null;
  const isYouTube = youtubeId !== null;

  function handleVideoSourceChange(value: string) {
    setVideoSource(value);
    setVideoError("");
    if (!value.trim()) return;

    try {
      const url = new URL(value.trim());
      const host = url.hostname.toLowerCase();
      const looksLikeYouTube =
        host === "youtube.com" ||
        host === "www.youtube.com" ||
        host === "m.youtube.com" ||
        host === "youtu.be" ||
        host === "www.youtube-nocookie.com";
      if (looksLikeYouTube && !parseYouTubeUrl(value)) {
        setVideoError("This YouTube URL is not recognized.");
      }
    } catch {
      setVideoError("Enter a valid HTTP or HTTPS URL.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/lessons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lesson.id,
          moduleId,
          position,
          title,
          description,
          videoSource: videoSource.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Lesson could not be saved.");
      } else {
        setSuccess("Lesson saved successfully.");
        router.refresh();
      }
    } catch {
      setError("Something went wrong while saving the lesson.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="form-group">
            <label htmlFor="edit-lesson-module">Module</label>
            <select
              id="edit-lesson-module"
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
            <label htmlFor="edit-lesson-position">Order</label>
            <input
              id="edit-lesson-position"
              type="number"
              min={1}
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="edit-lesson-title">Title</label>
          <input
            id="edit-lesson-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={240}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-lesson-description">Description / content</label>
          <textarea
            id="edit-lesson-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={7}
            maxLength={50_000}
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-lesson-video">
            Video source{" "}
            <span className="text-sm text-[var(--muted)] font-normal">
              (YouTube URL or direct MP4/HLS URL)
            </span>
          </label>
          <input
            id="edit-lesson-video"
            type="url"
            value={videoSource}
            onChange={(event) => handleVideoSourceChange(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=... or https://example.com/video.mp4"
          />
          {videoError && (
            <p className="text-sm text-[var(--danger)] mt-1 font-semibold">
              {videoError}
            </p>
          )}
          {isYouTube && (
            <p className="text-sm text-[var(--ok)] mt-1 font-semibold">
              Valid YouTube video detected (ID: {youtubeId})
            </p>
          )}
          {videoSource.trim() && !isYouTube && !videoError && (
            <p className="text-sm text-[var(--muted)] mt-1">
              This will be treated as a direct video source.
            </p>
          )}
        </div>

        {isYouTube && (
          <div className="mb-4">
            <label className="block font-semibold mb-2 text-sm">Preview</label>
            <div className="video-container">
              <iframe
                src={getYouTubeEmbedUrl(youtubeId)}
                title={`${title} — Preview`}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                loading="lazy"
              />
            </div>
          </div>
        )}

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Saving…" : "Save lesson"}
        </button>
      </form>
    </div>
  );
}
