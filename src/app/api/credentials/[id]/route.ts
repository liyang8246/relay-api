import { NextRequest, NextResponse } from "next/server";
import { db, credentials, credentialModels } from "@/db";
import { requireAuth } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateCredentialSchema = z.object({
  name: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  models: z.array(z.string()).min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const updates = updateCredentialSchema.parse(body);

    // 验证凭证属于用户的供应商
    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, id),
      with: { provider: true },
    });

    if (!credential) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const provider = credential.provider as { userId: string };
    if (provider.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 更新凭证基本信息
    const credentialUpdates: { name?: string; apiKey?: string } = {};
    if (updates.name) credentialUpdates.name = updates.name;
    if (updates.apiKey) credentialUpdates.apiKey = updates.apiKey;

    if (Object.keys(credentialUpdates).length > 0) {
      await db.update(credentials)
        .set(credentialUpdates)
        .where(eq(credentials.id, id));
    }

    // 更新模型列表
    if (updates.models) {
      // 删除现有模型
      await db.delete(credentialModels).where(eq(credentialModels.credentialId, id));

      // 添加新模型
      for (const model of updates.models) {
        await db.insert(credentialModels).values({
          id: generateId(),
          credentialId: id,
          model,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Update credential error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
