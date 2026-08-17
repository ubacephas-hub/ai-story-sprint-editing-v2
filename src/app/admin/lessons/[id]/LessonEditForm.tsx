"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseYouTubeUrl, getYouTubeEmbedUrl } from "@/lib/youtube";

interface Lesson {
  id: number;
  title: string;
  description: string | null;
  videoKind: string;
  videoSource: string | null;
}

interface Props {
  lesson: Lesson;
}

export default function LessonEditForm({ lesson }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description || "");
  const [videoSource, setVideoSource] = useState(lesson.videoSource || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoError, setVideoError] = useState("");

  // Live YouTube preview
  const youtubeId = videoSource ? parseYouTubeUrl(videoSource) : null;
  const isYouTube = youtubeId !== null;

  function handleVideoSourceChange(val: string) {
    setVideoSource(val);
    setVideoError("");

    if (val.trim() === "") {
      setVideoError("");
      return;
    }

    // Check if it looks like a YouTube URL but is invalid
    const lower = val.toLowerCase();
    if (
      lower.includes("youtube") ||
      lower.includes("youtu.be")
    ) {
      const parsed = parseYouTubeUrl(val);
      if (!parsed) {
        setVideoError(
          "This looks like a YouTube link but the format is not recognized. Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/..., youtube.com/embed/..."
        );
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Validate YouTube URL if provided
    if (videoSource.trim()) {
      const lower = videoSource.toLowerCase();
      if (lower.includes("youtube") || lower.includes("youtu.be")) {
        const parsed = parseYouTubeUrl(videoSource);
        if (!parsed) {
          setError(
            "Invalid YouTube URL. Please use a standard YouTube link format."
          );
          setLoading(false);
          return;
        }
      }
    }

    try {
      const res = await fetch("/api/admin/lessons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lesson.id,
          title,
          description,
          videoSource: videoSource.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
      } else {
        setSuccess("Lesson saved successfully");
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div className="form-group">
          <label>
            Video / Protected URL{" "}
            <span className="text-sm text-[var(--muted)] font-normal">
              (YouTube URL, or direct MP4/HLS URL)
            </span>
          </label>
          <input
            type="text"
            value={videoSource}
            onChange={(e) => handleVideoSourceChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... or https://example.com/video.mp4"
          />
          {videoError && (
            <p className="text-sm text-[var(--danger)] mt-1 font-semibold">
              {videoError}
            </p>
          )}
          {isYouTube && (
            <p className="text-sm text-[var(--ok)] mt-1 font-semibold">
              ✓ Valid YouTube video detected (ID: {youtubeId})
            </p>
          )}
          {videoSource.trim() && !isYouTube && !videoError && (
            <p className="text-sm text-[var(--muted)] mt-1">
              Will be treated as a direct video source (MP4/HLS)
            </p>
          )}
        </div>

        {/* YouTube Preview */}
        {isYouTube && (
          <div className="mb-4">
            <label className="block font-semibold mb-2 text-sm">
              Preview:
            </label>
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
          {loading ? "Saving…" : "Save Lesson"}
        </button>
      </form>
    </div>
  );
}
