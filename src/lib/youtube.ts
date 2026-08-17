/**
 * YouTube URL parser and validator.
 * Supports:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/shorts/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *
 * Returns the 11-character video ID or null if invalid.
 */

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const YOUTUBE_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
];

export function parseYouTubeUrl(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  // Only allow http(s)
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.includes(host)) return null;

  let videoId: string | null = null;

  if (host === "youtu.be") {
    // youtu.be/VIDEO_ID
    videoId = url.pathname.slice(1).split("/")[0] || null;
  } else {
    // /watch?v=VIDEO_ID
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    }
    // /embed/VIDEO_ID
    else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/")[2] || null;
    }
    // /shorts/VIDEO_ID
    else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/")[2] || null;
    }
  }

  if (!videoId) return null;

  // Strip any query/fragment residue
  videoId = videoId.split("?")[0].split("#")[0].split("&")[0];

  // Validate the ID format (exactly 11 chars, alphanumeric + _ -)
  if (!YOUTUBE_ID_RE.test(videoId)) return null;

  return videoId;
}

export function isYouTubeUrl(raw: string): boolean {
  return parseYouTubeUrl(raw) !== null;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
