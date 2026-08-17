import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { courseAccess } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, courseId, status } = body;

    if (!userId || !courseId || !["pending", "active", "suspended"].includes(status)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(courseAccess)
      .where(
        and(
          eq(courseAccess.userId, userId),
          eq(courseAccess.courseId, courseId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(courseAccess)
        .set({ status })
        .where(eq(courseAccess.id, existing[0].id));
    } else {
      await db.insert(courseAccess).values({
        userId,
        courseId,
        status,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update access error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
