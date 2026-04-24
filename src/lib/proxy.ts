import { db, modelMappings, credentialModels, credentials, providers, credentialStates } from "@/db";
import { eq, and, gt } from "drizzle-orm";
import { shouldFailover } from "@/lib/utils";

interface ProxyRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  [key: string]: unknown;
}

interface AvailableEndpoint {
  mapping: typeof modelMappings.$inferSelect;
  credentialModel: typeof credentialModels.$inferSelect;
  credential: typeof credentials.$inferSelect;
  provider: typeof providers.$inferSelect;
  state: typeof credentialStates.$inferSelect | null;
}

// 获取可用的端点列表（按优先级排序）
async function getAvailableEndpoints(userId: string, alias: string): Promise<AvailableEndpoint[]> {
  const mappings = await db.query.modelMappings.findMany({
    where: and(
      eq(modelMappings.userId, userId),
      eq(modelMappings.alias, alias),
      eq(modelMappings.isEnabled, true)
    ),
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
    orderBy: (m, { asc }) => [asc(m.priority)],
  });

  const now = new Date();
  const results: AvailableEndpoint[] = [];

  for (const mapping of mappings) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cm = mapping.credentialModel as any;
    const credential = cm.credential as any;
    const provider = credential.provider as any;

    // 检查凭证是否激活
    if (!credential.isActive) continue;

    // 获取状态
    const state = await db.query.credentialStates.findFirst({
      where: eq(credentialStates.credentialModelId, cm.id),
    });

    // 检查是否在冷却期
    if (state?.cooldownUntil && new Date(state.cooldownUntil) > now) {
      continue;
    }

    // 检查并发限制
    if (state && state.currentConcurrency >= mapping.maxConcurrency) {
      continue;
    }

    results.push({
      mapping,
      credentialModel: cm,
      credential,
      provider,
      state: state ?? null,
    });
  }

  return results;
}

// 更新并发计数
async function updateConcurrency(credentialModelId: string, delta: number) {
  const state = await db.query.credentialStates.findFirst({
    where: eq(credentialStates.credentialModelId, credentialModelId),
  });

  if (state) {
    const newConcurrency = Math.max(0, state.currentConcurrency + delta);
    await db.update(credentialStates)
      .set({ currentConcurrency: newConcurrency })
      .where(eq(credentialStates.id, state.id));
  }
}

// 标记错误并设置冷却期
async function markError(credentialModelId: string, error: unknown) {
  const state = await db.query.credentialStates.findFirst({
    where: eq(credentialStates.credentialModelId, credentialModelId),
  });

  if (state) {
    const cooldownMinutes = shouldFailover(error) ? 5 : 1;
    const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);

    await db.update(credentialStates)
      .set({
        isHealthy: false,
        lastError: error instanceof Error ? error.message : String(error),
        lastErrorAt: new Date(),
        cooldownUntil,
      })
      .where(eq(credentialStates.id, state.id));
  }
}

// 标记健康
async function markHealthy(credentialModelId: string) {
  const state = await db.query.credentialStates.findFirst({
    where: eq(credentialStates.credentialModelId, credentialModelId),
  });

  if (state) {
    await db.update(credentialStates)
      .set({
        isHealthy: true,
        lastError: null,
        cooldownUntil: null,
      })
      .where(eq(credentialStates.id, state.id));
  }
}

// 执行代理请求
export async function proxyRequest(
  userId: string,
  request: ProxyRequest
): Promise<Response> {
  const { model: alias, ...rest } = request;

  // 验证 alias
  if (!["nano", "base", "pro"].includes(alias)) {
    return new Response(JSON.stringify({ error: `Unknown model: ${alias}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 获取可用端点
  const endpoints = await getAvailableEndpoints(userId, alias);

  if (endpoints.length === 0) {
    return new Response(JSON.stringify({ 
      error: `No available endpoints for model: ${alias}` 
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 尝试每个端点
  for (const endpoint of endpoints) {
    const { credentialModel, credential, provider } = endpoint;

    try {
      // 增加并发计数
      await updateConcurrency(credentialModel.id, 1);

      // 构建请求
      const url = `${provider.baseUrl}/chat/completions`;
      const body = {
        ...rest,
        model: credentialModel.model,
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credential.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      // 标记健康
      await markHealthy(credentialModel.id);

      // 减少并发计数
      await updateConcurrency(credentialModel.id, -1);

      // 返回响应
      return response;
    } catch (error) {
      // 减少并发计数
      await updateConcurrency(credentialModel.id, -1);

      // 标记错误
      await markError(credentialModel.id, error);

      // 如果应该故障转移，继续下一个端点
      if (shouldFailover(error)) {
        console.log(`Failover from ${credentialModel.model}:`, error);
        continue;
      }

      // 否则返回错误
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 所有端点都失败
  return new Response(JSON.stringify({
    error: "All endpoints failed",
  }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}
