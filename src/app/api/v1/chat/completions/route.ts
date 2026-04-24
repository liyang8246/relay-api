import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { proxyRequest } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  // 验证用户
  const session = await getSession();
  
  if (!session) {
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
    return await proxyRequest(session.user.id, body);
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
