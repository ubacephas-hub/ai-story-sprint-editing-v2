import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseAccess, lessons, modules, resources } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canDownloadDocument } from "@/lib/document-access";
import {
  getDocumentBucketName,
  getDocumentStorageAdmin,
  logSupabaseStorageError,
  normalizeDocumentObjectPath,
} from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function positiveInteger(value: string): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
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

    let courseAccessStatus: string | null = null;
    if (session.user.role !== "admin") {
      const [access] = await db
        .select({ status: courseAccess.status })
        .from(courseAccess)
        .where(
          and(
            eq(courseAccess.userId, session.user.id),
            eq(courseAccess.courseId, resource.courseId)
          )
        )
        .limit(1);
      courseAccessStatus = access?.status || null;
    }

    if (
      !canDownloadDocument({
        role: session.user.role,
        accountStatus: session.user.accountStatus,
        courseAccessStatus,
      })
    ) {
      return NextResponse.json(
        { error: "Active course access is required" },
        { status: 403 }
      );
    }

    const objectPath = normalizeDocumentObjectPath(
      resource.filePath,
      getDocumentBucketName()
    );
    if (!objectPath) {
      return NextResponse.json(
        { error: "Document metadata is unavailable" },
        { status: 404 }
      );
    }

    const { data, error } = await getDocumentStorageAdmin()
      .from(getDocumentBucketName())
      .createSignedUrl(objectPath, 5 * 60, { download: true });
    if (error || !data) {
      logSupabaseStorageError("Document signed download URL creation failed", error);
      return NextResponse.json(
        { error: "Document download is temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }

    const response = NextResponse.redirect(data.signedUrl, 302);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    logSupabaseStorageError("Document download failed", error);
    return NextResponse.json({ error: "Document download failed" }, { status: 500 });
  }
}
