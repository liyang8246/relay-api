import { NextRequest } from "next/server";
import { getSession, getUserByApiKey } from "@/lib/auth";
import { proxyRequest } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  // 尝试通过 API Key 或 Session 认证
  let userId: string | null = null;

  // 1. 检查 Authorization header (API Key)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.slice(7);
    const user = await getUserByApiKey(apiKey);
    if (user) {
      userId = user.id;
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
    return await proxyRequest(userId, body);
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
