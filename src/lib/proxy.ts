import { db, modelMappings, credentialModels, credentials, providers, credentialStates, requestLogs } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { shouldFailover } from "@/lib/utils";
import { generateId } from "@/lib/utils";

interface ProxyRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  [key: string]: unknown;
}

interface ProxyContext {
  apiKeyId: string | null;
  ip: string;
  startTime: number;
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

    // 检查并发限制（使用供应商级别的 maxConcurrency）
    if (state && state.currentConcurrency >= provider.maxConcurrency) {
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

// 记录请求日志
async function logRequest(params: {
  userId: string;
  providerId: string | null;
  apiKeyId: string | null;
  alias: string;
  model: string;
  ip: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  duration: number;
  timeToFirstToken: number | null;
  isSuccess: boolean;
  errorMessage: string | null;
}) {
  try {
    await db.insert(requestLogs).values({
      id: generateId(),
      userId: params.userId,
      providerId: params.providerId,
      apiKeyId: params.apiKeyId,
      alias: params.alias,
      model: params.model,
      ip: params.ip,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: params.totalTokens,
      duration: params.duration,
      timeToFirstToken: params.timeToFirstToken,
      isSuccess: params.isSuccess,
      errorMessage: params.errorMessage,
    });
  } catch (error) {
    console.error("Log request error:", error);
  }
}

// 从响应中提取 token 使用量
function extractTokenUsage(response: Response): { inputTokens: number; outputTokens: number; totalTokens: number } | null {
  // 对于非流式响应，尝试从响应体中提取
  // 注意：这里无法直接读取响应体，因为已经被消费了
  // 实际实现中需要在调用处传递
  return null;
}

// 执行代理请求
export async function proxyRequest(
  userId: string,
  request: ProxyRequest,
  context: ProxyContext
): Promise<Response> {
  const { model: alias, ...rest } = request;
  const { apiKeyId, ip, startTime } = context;

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
    let timeToFirstToken: number | null = null;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let totalTokens: number | null = null;

    try {
      // 增加并发计数
      await updateConcurrency(credentialModel.id, 1);

      // 构建请求
      const url = `${provider.baseUrl}/chat/completions`;
      const body = {
        ...rest,
        model: credentialModel.model,
        stream: false, // 暂不支持流式，以便提取 token 使用量
      };

      const requestStartTime = Date.now();
      
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

      // 计算首字时间（粗略估计）
      timeToFirstToken = Date.now() - requestStartTime;

      // 提取 token 使用量
      try {
        const responseData = await response.json();
        if (responseData.usage) {
          inputTokens = responseData.usage.prompt_tokens ?? null;
          outputTokens = responseData.usage.completion_tokens ?? null;
          totalTokens = responseData.usage.total_tokens ?? null;
        }
        
        // 标记健康
        await markHealthy(credentialModel.id);
        
        // 减少并发计数
        await updateConcurrency(credentialModel.id, -1);
        
        // 记录成功日志
        const duration = Date.now() - startTime;
        await logRequest({
          userId,
          providerId: provider.id,
          apiKeyId,
          alias,
          model: credentialModel.model,
          ip,
          inputTokens,
          outputTokens,
          totalTokens,
          duration,
          timeToFirstToken,
          isSuccess: true,
          errorMessage: null,
        });

        // 返回响应（重新构造）
        return new Response(JSON.stringify(responseData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (parseError) {
        console.error("Parse response error:", parseError);
        // 即使解析失败，也认为请求成功
        await markHealthy(credentialModel.id);
        await updateConcurrency(credentialModel.id, -1);
        
        const duration = Date.now() - startTime;
        await logRequest({
          userId,
          providerId: provider.id,
          apiKeyId,
          alias,
          model: credentialModel.model,
          ip,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          duration,
          timeToFirstToken,
          isSuccess: true,
          errorMessage: null,
        });

        return response;
      }
    } catch (error) {
      // 减少并发计数
      await updateConcurrency(credentialModel.id, -1);

      // 标记错误
      await markError(credentialModel.id, error);

      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // 如果应该故障转移，继续下一个端点
      if (shouldFailover(error)) {
        console.log(`Failover from ${credentialModel.model}:`, error);
        
        // 记录失败日志但不返回，继续尝试下一个端点
        await logRequest({
          userId,
          providerId: provider.id,
          apiKeyId,
          alias,
          model: credentialModel.model,
          ip,
          inputTokens,
          outputTokens,
          totalTokens,
          duration,
          timeToFirstToken,
          isSuccess: false,
          errorMessage,
        });
        
        continue;
      }

      // 否则记录日志并返回错误
      await logRequest({
        userId,
        providerId: provider.id,
        apiKeyId,
        alias,
        model: credentialModel.model,
        ip,
        inputTokens,
        outputTokens,
        totalTokens,
        duration,
        timeToFirstToken,
        isSuccess: false,
        errorMessage,
      });

      return new Response(JSON.stringify({
        error: errorMessage,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 所有端点都失败
  const duration = Date.now() - startTime;
  await logRequest({
    userId,
    providerId: null,
    apiKeyId,
    alias,
    model: alias,
    ip,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    duration,
    timeToFirstToken: null,
    isSuccess: false,
    errorMessage: "All endpoints failed",
  });

  return new Response(JSON.stringify({
    error: "All endpoints failed",
  }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}
