import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { parseYouTubeUrl } from "@/lib/youtube";

/** Check if a URL hostname belongs to YouTube */
function looksLikeYouTube(raw: string): boolean {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase();
    return (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be" ||
      host === "www.youtube-nocookie.com"
    );
  } catch {
    return false;
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, description, videoSource } = body;

    if (!id || !title) {
      return NextResponse.json(
        { error: "Lesson ID and title are required" },
        { status: 400 }
      );
    }

    // Determine video kind
    let videoKind = "none";
    let finalVideoSource: string | null = null;

    if (videoSource && videoSource.trim()) {
      const trimmed = videoSource.trim();

      if (looksLikeYouTube(trimmed)) {
        // It's a YouTube domain — must have a valid video ID
        const videoId = parseYouTubeUrl(trimmed);
        if (!videoId) {
          return NextResponse.json(
            {
              error:
                "Invalid YouTube URL. Supported formats: youtube.com/watch?v=VIDEO_ID, youtu.be/VIDEO_ID, youtube.com/shorts/VIDEO_ID, youtube.com/embed/VIDEO_ID",
            },
            { status: 400 }
          );
        }
        videoKind = "url";
        finalVideoSource = trimmed;
      } else {
        // Treat as direct video URL (MP4/HLS)
        videoKind = "url";
        finalVideoSource = trimmed;
      }
    }

    await db
      .update(lessons)
      .set({
        title: title.trim(),
        description: description?.trim() || null,
        videoKind,
        videoSource: finalVideoSource,
      })
      .where(eq(lessons.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update lesson error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
