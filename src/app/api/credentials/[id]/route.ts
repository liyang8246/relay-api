import { NextRequest, NextResponse } from "next/server";
import { db, credentials, providers } from "@/db";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    
    // 验证凭证属于用户的供应商
    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, id),
      with: { provider: true },
    });
    
    if (!credential) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    // provider 类型断言
    const provider = credential.provider as { userId: string };
    if (provider.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    await db.delete(credentials).where(eq(credentials.id, id));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete credential error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
