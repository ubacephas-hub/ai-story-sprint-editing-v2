"use client";

import { parseYouTubeUrl, getYouTubeEmbedUrl } from "@/lib/youtube";

interface VideoPlayerProps {
  videoKind: string;
  videoSource: string | null;
  lessonTitle: string;
}

export default function VideoPlayer({
  videoKind,
  videoSource,
  lessonTitle,
}: VideoPlayerProps) {
  if (!videoSource || videoKind === "none") {
    return (
      <div className="video-container bg-gray-900 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <svg
              className="mx-auto mb-3 opacity-40"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <p className="text-lg font-semibold opacity-60">
              Video coming soon
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if source is a YouTube URL
  const youtubeId = parseYouTubeUrl(videoSource);

  if (youtubeId || videoKind === "youtube") {
    const embedId = youtubeId || videoSource;
    const embedUrl = getYouTubeEmbedUrl(embedId);
    return (
      <div className="video-container">
        <iframe
          src={embedUrl}
          title={`${lessonTitle} — Video Lesson`}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          loading="lazy"
        />
      </div>
    );
  }

  // Direct video (MP4/HLS)
  return (
    <div className="video-container">
      <video controls preload="metadata">
        <source src={videoSource} type={videoSource.endsWith(".m3u8") ? "application/x-mpegURL" : "video/mp4"} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
