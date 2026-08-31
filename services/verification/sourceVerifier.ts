import { SourceClass } from "../../types";

const OFFICIAL = [/openai\.com$/i, /anthropic\.com$/i, /deepseek\.com$/i, /google\.com$/i, /kicad\.org$/i, /ffmpeg\.org$/i, /n8n\.io$/i, /platformio\.org$/i];
const DOCS = [/^docs\./i, /\/docs/i, /readthedocs/i];
const BLOG = [/blog/i, /medium\.com$/i, /substack/i, /zhihu\.com$/i];

export function classifySourceUrl(url?: string): SourceClass {
  if (!url) return "unknown";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (/github\.com$/i.test(host)) return "github";
    if (/npmjs\.com$/i.test(host)) return "registry";
    if (BLOG.some((pattern) => pattern.test(host) || pattern.test(url))) return "blog";
    if (OFFICIAL.some((pattern) => pattern.test(host))) return /pricing|price/i.test(url) ? "pricing" : "official";
    if (DOCS.some((pattern) => pattern.test(host) || pattern.test(url))) return "documentation";
    if (/pricing|price/i.test(url)) return "pricing";
    return "community";
  } catch {
    return "unknown";
  }
}
