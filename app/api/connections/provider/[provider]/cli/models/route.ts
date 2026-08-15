import { NextResponse } from "next/server";
import { getCodexModelOptions } from "../../../../../../../services/connectionService";

export async function GET(_: Request, { params }: { params: { provider: string } }) {
  if (params.provider !== "openai") return NextResponse.json({ error: "PROVIDER_NOT_SUPPORTED" }, { status: 400 });
  try {
    return NextResponse.json({ models: await getCodexModelOptions() });
  } catch {
    return NextResponse.json({ error: "CODEX_MODELS_UNAVAILABLE", message: "无法读取当前 Codex CLI 的可用模型。" }, { status: 502 });
  }
}
