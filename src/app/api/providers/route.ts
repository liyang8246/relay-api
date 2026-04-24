import { NextRequest, NextResponse } from "next/server";
import { db, providers, credentials, credentialModels, users } from "@/db";
import { requireAuth } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createProviderSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  maxConcurrency: z.number().int().min(1).default(10),
});

// 获取所有供应商
export async function GET() {
  try {
    const user = await requireAuth();
    
    const allProviders = await db.query.providers.findMany({
      where: eq(providers.userId, user.id),
      with: {
        credentials: {
          with: {
            models: true,
          },
        },
      },
    });
    
    return NextResponse.json({ providers: allProviders });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get providers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 创建供应商
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { name, baseUrl, maxConcurrency } = createProviderSchema.parse(body);
    
    const providerId = generateId();
    await db.insert(providers).values({
      id: providerId,
      userId: user.id,
      name,
      baseUrl,
      maxConcurrency,
    });
    
    return NextResponse.json({
      provider: { id: providerId, name, baseUrl, maxConcurrency },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Create provider error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
