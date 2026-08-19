import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, courses, courseAccess } from "@/db/schema";
import { sql } from "drizzle-orm";
import { hashPassword, createSession } from "@/lib/auth";
import { sendAccountCreatedEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: "student",
      })
      .returning();

    // Auto-enroll as pending in the first course
    const allCourses = await db.select().from(courses).limit(1);
    if (allCourses.length > 0) {
      await db.insert(courseAccess).values({
        userId: newUser.id,
        courseId: allCourses[0].id,
        status: "pending",
      });
    }

    await createSession(newUser.id);
    try { await sendAccountCreatedEmail(newUser.email, newUser.name); }
    catch (emailError) { console.error("Account email failed:", emailError); }

    return NextResponse.json({ success: true, role: "student" });
  } catch (error) {
    console.error("Enroll error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
