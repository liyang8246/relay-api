import { NextRequest, NextResponse } from "next/server";
import { db, providers } from "@/db";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    
    // 确保是用户的供应商
    const provider = await db.query.providers.findFirst({
      where: and(eq(providers.id, id), eq(providers.userId, user.id)),
    });
    
    if (!provider) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    await db.delete(providers).where(eq(providers.id, id));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete provider error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
