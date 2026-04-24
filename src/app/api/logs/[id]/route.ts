import { NextRequest, NextResponse } from "next/server";
import { db, requestLogs } from "@/db";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const log = await db.query.requestLogs.findFirst({
      where: and(
        eq(requestLogs.id, id),
        eq(requestLogs.userId, user.id)
      ),
      with: {
        provider: {
          columns: { id: true, name: true, baseUrl: true },
        },
        apiKey: {
          columns: { id: true, name: true },
        },
      },
    });

    if (!log) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ log });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get log detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
