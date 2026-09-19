import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseAccess, lessons, modules, resources } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { isSafeStoragePath } from "@/lib/document-types";
import { getDocumentBucketName, getDocumentStorageAdmin } from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function positiveInteger(value: string): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function storedObjectPath(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (isSafeStoragePath(trimmed)) return trimmed;

  // Keep older metadata readable when it contains a Supabase Storage object
  // URL, but never redirect to an arbitrary external URL.
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const objectIndex = parts.indexOf("object");
    const bucket = getDocumentBucketName();
    if (
      objectIndex >= 0 &&
      parts[objectIndex + 1] &&
      ["public", "authenticated", "sign"].includes(parts[objectIndex + 1]) &&
      parts[objectIndex + 2] === bucket
    ) {
      const path = parts.slice(objectIndex + 3).map(decodeURIComponent).join("/");
      return isSafeStoragePath(path) ? path : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: Props) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
    }

    const { id } = await params;
    const resourceId = positiveInteger(id);
    if (!resourceId) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const [resource] = await db
      .select({
        id: resources.id,
        type: resources.type,
        filePath: resources.filePath,
        courseId: modules.courseId,
      })
      .from(resources)
      .innerJoin(lessons, eq(resources.lessonId, lessons.id))
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .where(eq(resources.id, resourceId))
      .limit(1);

    if (!resource || resource.type !== "document" || !resource.filePath) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (session.user.role !== "admin") {
      const [access] = await db
        .select({ id: courseAccess.id })
        .from(courseAccess)
        .where(
          and(
            eq(courseAccess.userId, session.user.id),
            eq(courseAccess.courseId, resource.courseId),
            eq(courseAccess.status, "active")
          )
        )
        .limit(1);
      if (!access) {
        return NextResponse.json(
          { error: "Active course access is required" },
          { status: 403 }
        );
      }
    }

    const objectPath = storedObjectPath(resource.filePath);
    if (!objectPath) {
      return NextResponse.json({ error: "Document is unavailable" }, { status: 404 });
    }

    const { data, error } = await getDocumentStorageAdmin()
      .from(getDocumentBucketName())
      .createSignedUrl(objectPath, 5 * 60, { download: true });
    if (error || !data) {
      console.error("Document signed download URL creation failed");
      return NextResponse.json({ error: "Document is unavailable" }, { status: 404 });
    }

    const response = NextResponse.redirect(data.signedUrl, 302);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    console.error("Document download failed");
    return NextResponse.json({ error: "Document download failed" }, { status: 500 });
  }
}
