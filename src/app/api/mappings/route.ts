import { NextRequest, NextResponse } from "next/server";
import { db, modelMappings, credentialModels, credentialStates } from "@/db";
import { requireAuth } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createMappingSchema = z.object({
  alias: z.enum(["nano", "base", "pro"]),
  credentialModelId: z.string(),
  priority: z.number().int().min(0),
  maxConcurrency: z.number().int().min(1).default(10),
});

// 获取所有映射
export async function GET() {
  try {
    const user = await requireAuth();
    
    const mappings = await db.query.modelMappings.findMany({
      where: eq(modelMappings.userId, user.id),
      with: {
        credentialModel: {
          with: {
            credential: {
              with: {
                provider: true,
              },
            },
          },
        },
      },
      orderBy: (m, { asc }) => [asc(m.alias), asc(m.priority)],
    });
    
    return NextResponse.json({ mappings });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get mappings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 创建映射
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { alias, credentialModelId, priority, maxConcurrency } = createMappingSchema.parse(body);
    
    // 验证 credentialModel 存在
    const cm = await db.query.credentialModels.findFirst({
      where: eq(credentialModels.id, credentialModelId),
      with: {
        credential: {
          with: { provider: true },
        },
      },
    });
    
    if (!cm) {
      return NextResponse.json({ error: "Credential model not found" }, { status: 404 });
    }
    
    // 类型断言处理嵌套关系
    const credential = cm.credential as { provider: { userId: string } };
    if (credential.provider.userId !== user.id) {
      return NextResponse.json({ error: "Credential model not found" }, { status: 404 });
    }
    
    const mappingId = generateId();
    
    await db.insert(modelMappings).values({
      id: mappingId,
      userId: user.id,
      alias,
      credentialModelId,
      priority,
      maxConcurrency,
    });
    
    // 创建状态记录
    await db.insert(credentialStates).values({
      id: generateId(),
      credentialModelId,
      currentConcurrency: 0,
      isHealthy: true,
    });
    
    return NextResponse.json({ mapping: { id: mappingId, alias, priority, maxConcurrency } });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Create mapping error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
