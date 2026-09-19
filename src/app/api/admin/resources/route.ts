import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lessons, modules, resources } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getDocumentBucketName, getDocumentStorageAdmin } from "@/lib/supabase-storage";
import { getDocumentExtension, isSafeStoragePath } from "@/lib/document-types";

const RESOURCE_TYPES = ["link", "text", "document"] as const;
type ResourceType = (typeof RESOURCE_TYPES)[number];

function positiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function displayOrder(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 0;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= 100_000
    ? number
    : null;
}

function textValue(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length <= maxLength ? result || null : null;
}

function resourceType(value: unknown): ResourceType | null {
  return typeof value === "string" && RESOURCE_TYPES.includes(value as ResourceType)
    ? (value as ResourceType)
    : null;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const valueTrimmed = value.trim();
  if (valueTrimmed.length > 2_000) return null;
  try {
    const url = new URL(valueTrimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return valueTrimmed;
  } catch {
    return null;
  }
}

async function requireAdmin() {
  const session = await getSession();
  return session?.user.role === "admin" ? session : null;
}

async function findLesson(lessonId: number) {
  return db
    .select({ lessonId: lessons.id, moduleId: lessons.moduleId })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.id, lessonId))
    .limit(1);
}

async function findResource(id: number) {
  return db
    .select({
      id: resources.id,
      lessonId: resources.lessonId,
      type: resources.type,
      title: resources.title,
      url: resources.url,
      content: resources.content,
      filePath: resources.filePath,
      description: resources.description,
      position: resources.position,
    })
    .from(resources)
    .innerJoin(lessons, eq(resources.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(resources.id, id))
    .limit(1);
}

function validateDocumentPath(filePath: unknown, adminId: number): string | null {
  if (typeof filePath !== "string" || !isSafeStoragePath(filePath)) return null;
  if (!filePath.startsWith(`documents/${adminId}/`)) return null;
  if (!getDocumentExtension(filePath, null)) return null;
  return filePath;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const type = resourceType(body.type);
    const lessonId = positiveInteger(body.lessonId);
    const title = textValue(body.title, 240);
    const description = textValue(body.description, 2_000);
    const position = displayOrder(
      body.position !== undefined ? body.position : body.order
    );
    if (!type || !lessonId || !title || position === null) {
      return NextResponse.json(
        { error: "Type, lesson, title, and a valid display order are required" },
        { status: 400 }
      );
    }

    if ((await findLesson(lessonId)).length === 0) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    let url: string | null = null;
    let content: string | null = null;
    let filePath: string | null = null;

    if (type === "link") {
      url = httpUrl(body.url);
      if (!url) {
        return NextResponse.json(
          { error: "A valid HTTP or HTTPS URL is required for link resources" },
          { status: 400 }
        );
      }
    } else if (type === "text") {
      content = textValue(body.content, 100_000);
      if (!content) {
        return NextResponse.json(
          { error: "Content is required for text resources" },
          { status: 400 }
        );
      }
    } else {
      filePath = validateDocumentPath(body.filePath, session.user.id);
      if (!filePath) {
        return NextResponse.json(
          { error: "Upload the document through the secure upload control first" },
          { status: 400 }
        );
      }
    }

    const [resource] = await db
      .insert(resources)
      .values({
        lessonId,
        type,
        title,
        url,
        content,
        filePath,
        description,
        position,
      })
      .returning();

    return NextResponse.json({ success: true, resource }, { status: 201 });
  } catch {
    console.error("Add resource failed");
    return NextResponse.json(
      { error: "Resource could not be added" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = positiveInteger(body.id);
    const title = textValue(body.title, 240);
    const description = textValue(body.description, 2_000);
    const position = displayOrder(
      body.position !== undefined ? body.position : body.order
    );
    const lessonId = positiveInteger(body.lessonId);
    if (!id || !title || position === null || !lessonId) {
      return NextResponse.json(
        { error: "Resource, lesson, title, and a valid display order are required" },
        { status: 400 }
      );
    }

    const [existing] = await findResource(id);
    if (!existing) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }
    if ((await findLesson(lessonId)).length === 0) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const nextValues: {
      lessonId: number;
      title: string;
      description: string | null;
      position: number;
      url?: string | null;
      content?: string | null;
    } = { lessonId, title, description, position };

    if (existing.type === "link") {
      const url = httpUrl(body.url);
      if (!url) {
        return NextResponse.json(
          { error: "A valid HTTP or HTTPS URL is required for link resources" },
          { status: 400 }
        );
      }
      nextValues.url = url;
    } else if (existing.type === "text") {
      const content = textValue(body.content, 100_000);
      if (!content) {
        return NextResponse.json(
          { error: "Content is required for text resources" },
          { status: 400 }
        );
      }
      nextValues.content = content;
    }

    await db.update(resources).set(nextValues).where(eq(resources.id, id));
    return NextResponse.json({ success: true });
  } catch {
    console.error("Update resource failed");
    return NextResponse.json(
      { error: "Resource could not be updated" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = positiveInteger(body.id);
    if (!id || body.confirmation !== "DELETE RESOURCE") {
      return NextResponse.json(
        { error: "Explicit resource deletion confirmation is required" },
        { status: 400 }
      );
    }

    const [existing] = await findResource(id);
    if (!existing) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    if (existing.type === "document" && existing.filePath) {
      const { error } = await getDocumentStorageAdmin()
        .from(getDocumentBucketName())
        .remove([existing.filePath]);
      if (error) {
        console.error("Document storage deletion failed");
        return NextResponse.json(
          { error: "The document could not be removed from private storage" },
          { status: 502 }
        );
      }
    }

    await db.delete(resources).where(eq(resources.id, id));
    return NextResponse.json({ success: true });
  } catch {
    console.error("Delete resource failed");
    return NextResponse.json(
      { error: "Resource could not be deleted" },
      { status: 500 }
    );
  }
}
