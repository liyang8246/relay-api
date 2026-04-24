import { NextRequest, NextResponse } from "next/server";
import { db, credentials, credentialModels, providers } from "@/db";
import { requireAuth } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createCredentialSchema = z.object({
  providerId: z.string(),
  name: z.string().min(1),
  apiKey: z.string().min(1),
  models: z.array(z.string()).min(1),
});

// 获取所有凭证
export async function GET() {
  try {
    const user = await requireAuth();
    
    const userProviders = await db.query.providers.findMany({
      where: eq(providers.userId, user.id),
      columns: { id: true },
    });
    
    const providerIds = userProviders.map(p => p.id);
    
    const allCredentials = providerIds.length > 0 
      ? await db.query.credentials.findMany({
          where: (c, { inArray }) => inArray(c.providerId, providerIds),
          with: { models: true, provider: true },
        })
      : [];
    
    return NextResponse.json({ credentials: allCredentials });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get credentials error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 创建凭证
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { providerId, name, apiKey, models } = createCredentialSchema.parse(body);
    
    // 验证供应商属于用户
    const provider = await db.query.providers.findFirst({
      where: and(eq(providers.id, providerId), eq(providers.userId, user.id)),
    });
    
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }
    
    const credentialId = generateId();
    
    // 创建凭证和关联模型
    await db.insert(credentials).values({
      id: credentialId,
      providerId,
      name,
      apiKey, // TODO: 在生产环境应该加密存储
    });
    
    for (const model of models) {
      await db.insert(credentialModels).values({
        id: generateId(),
        credentialId,
        model,
      });
    }
    
    return NextResponse.json({
      credential: { id: credentialId, name, models },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Create credential error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
