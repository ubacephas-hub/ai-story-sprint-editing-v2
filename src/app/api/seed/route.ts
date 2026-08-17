import { NextResponse } from "next/server";
import { seedDatabase, getDatabaseCounts } from "@/lib/seed";

export async function POST() {
  try {
    const seedResults = await seedDatabase();
    const counts = await getDatabaseCounts();

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully",
      seeded: seedResults,
      totals: counts,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      {
        error: "Failed to seed database",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const counts = await getDatabaseCounts();
    return NextResponse.json({
      success: true,
      counts,
    });
  } catch (error) {
    console.error("Get counts error:", error);
    return NextResponse.json(
      {
        error: "Failed to get database counts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
