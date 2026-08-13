import { NextResponse } from "next/server";
import {
  getSecret,
  listConnections,
  setConnectionStatus,
} from "../../../../../services/connectionService";

function providerErrorMessage(
  responseStatus: number,
  providerName: string,
  rawBody: string,
) {
  if (responseStatus === 401 || responseStatus === 403) {
    return `${providerName} 拒绝了当前 API Key，请确认 Key 属于这个平台且仍然有效。`;
  }
  let detail = "";
  try {
    const payload = JSON.parse(rawBody) as {
      error?: { message?: string; code?: string };
    };
    detail = payload.error?.message || payload.error?.code || "";
  } catch {
    detail = "";
  }
  const safeDetail = detail
    .replace(/(?:sk|ark)-?[a-z0-9_-]{8,}/gi, "[已隐藏]")
    .replace(/api\s*key\s*[:：]?\s*\*+\w*/gi, "API Key")
    .slice(0, 180);
  if (/model|endpoint|接入点|模型/i.test(detail)) {
    return `${providerName} 的模型或接入点 ID 不可用${safeDetail ? `：${safeDetail}` : ""}`;
  }
  return `${providerName} 连接失败${safeDetail ? `：${safeDetail}` : ""}`;
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const connection = listConnections().find((x) => x.id === params.id);
  if (!connection)
    return NextResponse.json(
      { error: "CONNECTION_NOT_FOUND" },
      { status: 404 },
    );
  if (connection.provider !== "deepseek")
    return NextResponse.json({
      ok: connection.status === "connected",
      status: connection.status,
      provider: connection.provider,
    });
  const secret = getSecret(connection.id);
  if (!secret)
    return NextResponse.json(
      { error: "PROVIDER_REQUIRED", message: "服务端没有找到 DeepSeek Key。" },
      { status: 503 },
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const providerName = connection.baseUrl?.includes("volces.com")
    ? "火山方舟"
    : "DeepSeek";
  try {
    const response = await fetch(
      `${(connection.baseUrl || "https://api.deepseek.com/v1").replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          model: connection.model || "deepseek-chat",
          temperature: 0,
          max_tokens: 8,
          messages: [{ role: "user", content: "仅回复 OK" }],
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const rawBody = await response.text();
      setConnectionStatus(
        connection.id,
        "error",
        response.status === 401 || response.status === 403
          ? "AUTHENTICATION_FAILED"
          : "PROVIDER_CONNECTION_FAILED",
      );
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          provider: "deepseek",
          error: "PROVIDER_CONNECTION_FAILED",
          message: providerErrorMessage(
            response.status,
            providerName,
            rawBody,
          ),
        },
        { status: response.status },
      );
    }
    setConnectionStatus(connection.id, "connected");
    return NextResponse.json({
      ok: true,
      status: "connected",
      provider: "deepseek",
      message: `${providerName} 连接测试成功`,
    });
  } catch (error) {
    setConnectionStatus(connection.id, "error", "PROVIDER_UNREACHABLE");
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        provider: "deepseek",
        message:
          error instanceof Error && error.name === "AbortError"
            ? "连接超时"
            : "无法连接 DeepSeek",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
