import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { courseAccess, users, courses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { sendEnrollmentApprovedEmail } from "@/lib/email";

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

    const now = new Date();
    const metadata = status === "active" ? { status, updatedAt: now, approvedAt: now, approvedBy: session.user.id, suspendedAt: null } : status === "suspended" ? { status, updatedAt: now, suspendedAt: now } : { status, updatedAt: now, suspendedAt: null };
    const becameActive = status === "active" && existing[0]?.status !== "active";
    if (existing.length > 0) {
      await db
        .update(courseAccess)
        .set(metadata)
        .where(eq(courseAccess.id, existing[0].id));
    } else {
      await db.insert(courseAccess).values({ userId, courseId, ...metadata });
    }
    if (becameActive) {
      try {
        const student = await db.select().from(users).where(eq(users.id,userId)).limit(1);
        const course = await db.select().from(courses).where(eq(courses.id,courseId)).limit(1);
        if(student[0]&&course[0]) await sendEnrollmentApprovedEmail(student[0].email,student[0].name,`${process.env.APP_URL||new URL(req.url).origin}/login`);
      } catch(emailError){ console.error("Approval email failed:",emailError); }
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
