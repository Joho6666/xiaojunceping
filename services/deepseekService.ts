import { AnswerValue, Project } from "../types";
import { isCommerceProject, profileFor } from "../data/projectProfiles";

export class DeepSeekError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DeepSeekError";
    this.code = code;
  }
}

type DeepSeekConnection = { baseUrl?: string; model?: string; secret?: string };
export type DeepSeekUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};
function sanitize(value: string) {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[已隐藏凭据]")
    .replace(
      /(?:password|passwd|token|api[_ -]?key)\s*[:=：]\s*\S+/gi,
      "[已隐藏敏感字段]",
    )
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .slice(0, 4000);
}
function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > 3) return undefined;
  if (typeof value === "string") return sanitize(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null)
    return value;
  if (Array.isArray(value))
    return value
      .slice(0, 8)
      .map((item) => sanitizeUnknown(item, depth + 1))
      .filter((item) => item !== undefined);
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 12)
        .map(([key, item]) => [key, sanitizeUnknown(item, depth + 1)])
        .filter(([, item]) => item !== undefined),
    );
  return undefined;
}

function parseJson(text: string): unknown {
  const cleaned = text
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const candidate = cleaned
        .slice(start, end + 1)
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
      try {
        return JSON.parse(candidate);
      } catch {
        /* handled below */
      }
    }
    throw new DeepSeekError(
      "INVALID_JSON",
      "DeepSeek 返回的评估结果不是有效 JSON。",
    );
  }
}

export async function generateDeepSeekEvaluation(
  project: Project,
  answers: Record<string, AnswerValue>,
  githubContext: unknown[],
  connection: DeepSeekConnection,
  safeRetry = false,
  formatRetry = false,
): Promise<{
  data: Record<string, unknown>;
  usage: DeepSeekUsage;
}> {
  if (!connection.secret)
    throw new DeepSeekError("PROVIDER_REQUIRED", "未找到 DeepSeek API Key。");
  const baseUrl = (connection.baseUrl || "https://api.deepseek.com/v1").replace(
    /\/$/,
    "",
  );
  const model = connection.model || "deepseek-v4-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  const profile = profileFor(project);
  const domainRule = isCommerceProject(project)
    ? `这是服装电商网站。必须围绕商品目录、尺码/颜色 SKU、库存、购物车、支付、订单、物流和移动端转化评估；GitHub 参考只能选择电商引擎或电商前台，禁止返回书籍、博客、论坛、通用个人网站或与购物无关的仓库。优先核对这些候选：${profile.curatedRepos.join(", ")}。`
    : `项目领域是${profile.label}。所有推荐都必须能解释与项目目标的直接关系，禁止用通用 SaaS 或随机热门仓库凑数。`;
  const system = `你是 AgentScope 的软件项目评估助手。请根据项目目标、访谈摘要、GitHub 证据和 AI 生态候选，给出中立、可执行的技术方案。${domainRule} 对工具、Agent、LLM、Skill、MCP、Plugin 必须说明直接匹配理由和接入限制，不要把候选说成已安装或已授权。不要声称已经执行了未执行的操作，只返回合法 JSON，不要 Markdown。${safeRetry ? "当前是一次精简重试，请只关注软件架构和工程计划。" : ""}${formatRetry ? "上一次输出格式无效；本次必须只输出一个完整 JSON 对象，不要代码围栏、解释文字或截断内容。" : ""}\n+JSON 字段必须包含：title、typeLabel、summary、verdict、score、status、acceptanceCriteria、strategy、scores、agents、models、risks、techStack、workflow、architecture、estimates、confidence。数组字段至少返回一个项目相关条目，时间、Token、成本使用范围估计。`;
  const safeProject = { ...project, idea: sanitize(project.idea) };
  const safeAnswers = Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value.map((item) => sanitize(String(item)))
        : sanitize(String(value)),
    ]),
  );
  const safeGithubContext =
    safeRetry && !formatRetry ? [] : sanitizeUnknown(githubContext);
  const user = JSON.stringify({
    project: safeProject,
    answers: safeAnswers,
    githubContext: safeGithubContext,
  });
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.secret}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 7000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      let detail = "";
      try {
        detail = String(
          (JSON.parse(raw) as { error?: { message?: string } }).error
            ?.message || "",
        );
      } catch {
        /* no-op */
      }
      if (/Content Exists Risk/i.test(detail)) {
        if (!safeRetry)
          return generateDeepSeekEvaluation(
            project,
            { context: "请仅基于软件项目目标和公开工程需求进行评估。" },
            githubContext,
            connection,
            true,
          );
        throw new DeepSeekError(
          "CONTENT_RISK",
          "DeepSeek 内容审核仍拒绝了该项目描述。请删去与凭据、隐私或受限制内容相关的文字后重试。",
        );
      }
      throw new DeepSeekError(
        response.status === 401 ? "INVALID_API_KEY" : "PROVIDER_ERROR",
        detail || `DeepSeek 请求失败（${response.status}）。`,
      );
    }
    const payload = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content)
      throw new DeepSeekError("EMPTY_RESPONSE", "DeepSeek 没有返回评估内容。");
    return {
      data: parseJson(content) as Record<string, unknown>,
      usage: {
        promptTokens: payload.usage?.prompt_tokens || 0,
        completionTokens: payload.usage?.completion_tokens || 0,
        totalTokens: payload.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    if (error instanceof DeepSeekError) {
      if (error.code === "INVALID_JSON" && !formatRetry)
        return generateDeepSeekEvaluation(
          project,
          answers,
          githubContext,
          connection,
          false,
          true,
        );
      if (formatRetry && error.code === "INVALID_JSON")
        throw new DeepSeekError(
          "INVALID_JSON",
          "DeepSeek 连续两次返回无法解析的内容，已停止生成报告；请重试或检查模型响应格式。",
        );
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError")
      throw new DeepSeekError("TIMEOUT", "DeepSeek 评估超时，请稍后重试。");
    throw new DeepSeekError(
      "NETWORK_ERROR",
      "无法连接 DeepSeek，请检查网络或 Base URL。",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** DeepSeek decides what to search; the server executes the validated queries. */
export async function generateDeepSeekSearchPlan(
  project: Project,
  answers: Record<string, AnswerValue>,
  connection: DeepSeekConnection,
  formatRetry = false,
): Promise<{ queries: string[]; focus: string[]; usage: DeepSeekUsage }> {
  if (!connection.secret)
    throw new DeepSeekError("PROVIDER_REQUIRED", "未找到 DeepSeek API Key。");
  const baseUrl = (connection.baseUrl || "https://api.deepseek.com/v1").replace(
    /\/$/,
    "",
  );
  const model = connection.model || "deepseek-v4-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  const profile = profileFor(project);
  const system = `你是 AgentScope 的 GitHub 研究 Agent。根据项目目标和访谈答案，生成最多 4 个精准的 GitHub repository 搜索词。项目领域是${profile.label}。搜索词必须描述可复用的产品能力、技术栈或领域，不要搜索凭据、隐私或用户文件。只返回 JSON：{"queries":["..."],"focus":["..."],"reject":["..."]}。每个 query 不超过 100 字。${formatRetry ? "只输出完整 JSON，不要代码围栏或解释文字。" : ""}`;
  const user = JSON.stringify({
    project: { ...project, idea: sanitize(project.idea) },
    answers: sanitizeUnknown(answers),
    domainKeywords: profile.keywords,
  });
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.secret}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok)
      throw new DeepSeekError(
        response.status === 401 ? "INVALID_API_KEY" : "PROVIDER_ERROR",
        `DeepSeek 搜索计划失败（${response.status}）。`,
      );
    const payload = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const parsed = parseJson(payload.choices?.[0]?.message?.content || "") as {
      queries?: unknown;
      focus?: unknown;
    };
    const queries = Array.isArray(parsed.queries)
      ? parsed.queries
          .filter((x): x is string => typeof x === "string")
          .map((x) => sanitize(x).trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];
    const focus = Array.isArray(parsed.focus)
      ? parsed.focus
          .filter((x): x is string => typeof x === "string")
          .map((x) => sanitize(x).trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];
    if (!queries.length)
      throw new DeepSeekError(
        "INVALID_SEARCH_PLAN",
        "DeepSeek 没有生成有效搜索计划。",
      );
    return {
      queries,
      focus,
      usage: {
        promptTokens: payload.usage?.prompt_tokens || 0,
        completionTokens: payload.usage?.completion_tokens || 0,
        totalTokens: payload.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    if (error instanceof DeepSeekError) {
      if (error.code === "INVALID_JSON" && !formatRetry)
        return generateDeepSeekSearchPlan(project, answers, connection, true);
      if (formatRetry && error.code === "INVALID_JSON")
        throw new DeepSeekError(
          "INVALID_JSON",
          "DeepSeek 连续两次无法生成有效搜索计划，请重试。",
        );
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError")
      throw new DeepSeekError("TIMEOUT", "DeepSeek 搜索计划超时，请稍后重试。");
    throw new DeepSeekError(
      "NETWORK_ERROR",
      "无法连接 DeepSeek 生成搜索计划。",
    );
  } finally {
    clearTimeout(timeout);
  }
}

