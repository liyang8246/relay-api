import { NextRequest, NextResponse } from "next/server";
import { db, requestLogs, providers, apiKeys } from "@/db";
import { requireAuth } from "@/lib/auth";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 获取用户的请求日志
    const logs = await db.query.requestLogs.findMany({
      where: eq(requestLogs.userId, user.id),
      with: {
        provider: {
          columns: { id: true, name: true },
        },
        apiKey: {
          columns: { id: true, name: true },
        },
      },
      orderBy: [desc(requestLogs.createdAt)],
      limit,
      offset,
    });

    // 获取总数
    const allLogs = await db.query.requestLogs.findMany({
      where: eq(requestLogs.userId, user.id),
      columns: { id: true },
    });
    const total = allLogs.length;

    return NextResponse.json({ logs, total });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
