import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lessons, modules } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  getDocumentExtension,
  isSupportedDocumentSize,
  MAX_DOCUMENT_BYTES,
} from "@/lib/document-types";
import {
  getDocumentBucketName,
  getDocumentStorageAdmin,
  logSupabaseStorageError,
  normalizeDocumentObjectPath,
} from "@/lib/supabase-storage";

export const runtime = "nodejs";

function positiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const lessonId = positiveInteger(body.lessonId);
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number(body.fileSize);
    const contentType =
      typeof body.contentType === "string" ? body.contentType.trim().toLowerCase() : "";

    if (!lessonId || !fileName || fileName.length > 255) {
      return NextResponse.json(
        { error: "A lesson and valid file name are required" },
        { status: 400 }
      );
    }
    if (!isSupportedDocumentSize(fileSize)) {
      return NextResponse.json(
        { error: `Documents must be 25 MB or smaller (maximum ${MAX_DOCUMENT_BYTES} bytes).` },
        { status: 400 }
      );
    }
    if (!getDocumentExtension(fileName, contentType)) {
      return NextResponse.json(
        { error: "Only PDF, DOCX, TXT, and ZIP documents are supported." },
        { status: 400 }
      );
    }

    const lesson = await db
      .select({ lessonId: lessons.id })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .where(eq(lessons.id, lessonId))
      .limit(1);
    if (lesson.length === 0) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const extension = getDocumentExtension(fileName, contentType);
    if (!extension) {
      return NextResponse.json(
        { error: "The document type could not be validated." },
        { status: 400 }
      );
    }

    const safeBaseName = fileName
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || `document.${extension}`;
    const objectPath = `documents/${session.user.id}/${crypto.randomUUID()}-${safeBaseName}`;

    const { data, error } = await getDocumentStorageAdmin()
      .from(getDocumentBucketName())
      .createSignedUploadUrl(objectPath, { upsert: false });
    if (error || !data) {
      logSupabaseStorageError("Document upload URL creation failed", error);
      return NextResponse.json(
        { error: "Secure document uploads are not configured yet." },
        { status: 503 }
      );
    }

    // Supabase returns the path relative to the bucket. Keep that canonical
    // object path alongside the upload token; never store the signed URL or a
    // bucket-prefixed fullPath in resources.file_path.
    const storagePath = normalizeDocumentObjectPath(data.path, getDocumentBucketName());
    if (!storagePath || storagePath !== objectPath) {
      logSupabaseStorageError(
        "Document upload URL returned an unexpected object path",
        new Error("Supabase returned an unexpected document path")
      );
      return NextResponse.json(
        { error: "Secure document uploads are unavailable. Please try again." },
        { status: 502 }
      );
    }

    // The signed URL/token is intentionally short-lived and single-use. The
    // document bytes go from the browser directly to Supabase Storage.
    return NextResponse.json({
      path: storagePath,
      token: data.token,
      signedUrl: data.signedUrl,
      bucket: getDocumentBucketName(),
      expiresIn: 2 * 60 * 60,
    });
  } catch (error) {
    logSupabaseStorageError("Document upload URL request failed", error);
    return NextResponse.json(
      { error: "Secure document uploads are unavailable. Please try again." },
      { status: 503 }
    );
  }
}
