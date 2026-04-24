import { NextRequest, NextResponse } from "next/server";
import { db, apiKeys } from "@/db";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// 删除 API Key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // 确保是用户的 API Key
    const apiKey = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)),
    });

    if (!apiKey) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete API key error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
