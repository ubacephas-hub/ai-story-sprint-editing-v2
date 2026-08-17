import { NextRequest, NextResponse } from "next/server";
import { setupDatabase } from "@/lib/setup-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();
    const expected = process.env.SETUP_SECRET;
    if (!expected || typeof secret !== "string" || secret !== expected) {
      return NextResponse.json({ error: "Invalid setup secret" }, { status: 401 });
    }
    const result = await setupDatabase();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Database setup failed. Check DATABASE_URL and server logs." },
      { status: 500 }
    );
  }
}
