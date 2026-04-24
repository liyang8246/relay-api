import { NextRequest, NextResponse } from "next/server";
import { db, apiKeys } from "@/db";
import { requireAuth } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { z } from "zod";

// 生成 API Key
function generateApiKey(): string {
  const prefix = "sk-relay";
  const key = randomBytes(24).toString("base64url");
  return `${prefix}-${key}`;
}

const createApiKeySchema = z.object({
  name: z.string().min(1).max(50),
});

// 获取用户的所有 API Keys
export async function GET() {
  try {
    const user = await requireAuth();

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, user.id),
      orderBy: (k, { desc }) => [desc(k.createdAt)],
    });

    return NextResponse.json({ apiKeys: keys });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get API keys error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 创建新的 API Key
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { name } = createApiKeySchema.parse(body);

    const newKey = generateApiKey();
    const id = generateId();

    await db.insert(apiKeys).values({
      id,
      userId: user.id,
      key: newKey,
      name,
    });

    return NextResponse.json({ apiKey: { id, key: newKey, name } });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Create API key error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
