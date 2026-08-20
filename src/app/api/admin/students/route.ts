import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, courseAccess, sessions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
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

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { userId, confirmation } = await req.json();
    if (!userId || confirmation !== "REMOVE") return NextResponse.json({ error: "Explicit removal confirmation is required" }, { status: 400 });
    const target = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target.length || target[0].role !== "student") return NextResponse.json({ error: "Student not found" }, { status: 404 });
    await db.transaction(async tx => {
      await tx.update(users).set({ accountStatus: "disabled" }).where(eq(users.id, userId));
      await tx.update(courseAccess).set({ status: "suspended" }).where(eq(courseAccess.userId, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
    });
    return NextResponse.json({ success: true, message: "Student removed safely. Progress and records were preserved." });
  } catch (error) { console.error("Remove student error:", error); return NextResponse.json({ error: "Student removal failed" }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { userId, action } = await req.json();
    if (!userId || action !== "restore") return NextResponse.json({ error: "Invalid restore request" }, { status: 400 });
    const target = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target.length || target[0].role !== "student") return NextResponse.json({ error: "Student not found" }, { status: 404 });
    await db.transaction(async tx => {
      await tx.update(users).set({ accountStatus: "active" }).where(eq(users.id, userId));
      await tx.update(courseAccess).set({ status: "pending" }).where(eq(courseAccess.userId, userId));
    });
    return NextResponse.json({ success: true, message: "Student restored as pending approval." });
  } catch (error) { console.error("Restore student error:", error); return NextResponse.json({ error: "Student restore failed" }, { status: 500 }); }
}
