import { NextRequest } from "next/server";
import { getSession, getUserByApiKey } from "@/lib/auth";
import { proxyRequest } from "@/lib/proxy";
import { db, apiKeys } from "@/db";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // 尝试通过 API Key 或 Session 认证
  let userId: string | null = null;
  let apiKeyId: string | null = null;

  // 1. 检查 Authorization header (API Key)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.slice(7);
    const apiKeyRecord = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.key, key),
    });
    if (apiKeyRecord) {
      userId = apiKeyRecord.userId;
      apiKeyId = apiKeyRecord.id;
    }
  }

  // 2. 检查 Session cookie
  if (!userId) {
    const session = await getSession();
    if (session) {
      userId = session.user.id;
    }
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 获取客户端 IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    ?? request.headers.get("x-real-ip") 
    ?? "unknown";

  try {
    const body = await request.json();
    
    // 验证必要字段
    if (!body.model || !body.messages) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields: model, messages" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 执行代理
    return await proxyRequest(userId, body, {
      apiKeyId,
      ip,
      startTime,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
