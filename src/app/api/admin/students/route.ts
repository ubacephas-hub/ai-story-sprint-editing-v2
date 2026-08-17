import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, courseAccess } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getSession, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, password, status, courseId } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check existing
    const existing = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
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

    if (courseId) {
      await db.insert(courseAccess).values({
        userId: newUser.id,
        courseId,
        status: status || "active",
      });
    }

    return NextResponse.json({ success: true, userId: newUser.id });
  } catch (error) {
    console.error("Add student error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
