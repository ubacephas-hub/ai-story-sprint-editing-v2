import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminProgressSnapshots } from "@/lib/admin-progress";

export const dynamic = "force-dynamic";

function positiveInteger(value: string | null): number | undefined {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Admin access is required" }, { status: 403 });
    }

    const rawStudentId = req.nextUrl.searchParams.get("studentId");
    const studentId = positiveInteger(rawStudentId);
    if (rawStudentId !== null && !studentId) {
      return NextResponse.json({ error: "Invalid student" }, { status: 400 });
    }
    const snapshots = await getAdminProgressSnapshots(studentId);
    if (studentId && snapshots.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ snapshots });
  } catch {
    console.error("Admin progress request failed");
    return NextResponse.json(
      { error: "Progress could not be loaded" },
      { status: 500 }
    );
  }
}
