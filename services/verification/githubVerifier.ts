import { GithubProjectRecommendation, VerificationStatus } from "../../types";

export async function verifyGithubRecommendation(item: GithubProjectRecommendation, token?: string): Promise<GithubProjectRecommendation & { verificationStatus: VerificationStatus }> {
  const match = item.url.match(/^https?:\/\/github\.com\/([^/]+\/[^/#?]+)/i);
  if (!match) return { ...item, similarity: 0, verificationStatus: "failed" };
  try {
    const response = await fetch(`https://api.github.com/repos/${match[1].replace(/\.git$/, "")}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "AgentScope-Evaluator", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { ...item, verificationStatus: token ? "failed" : "partially_verified" };
    const data = await response.json() as { archived?: boolean; stargazers_count?: number; license?: { spdx_id?: string }; pushed_at?: string };
    return {
      ...item,
      archived: Boolean(data.archived),
      stars: Number(data.stargazers_count || 0).toLocaleString("en-US"),
      license: data.license?.spdx_id || item.license,
      pushedAt: data.pushed_at,
      verificationStatus: data.archived ? "partially_verified" : "verified",
    };
  } catch {
    return { ...item, verificationStatus: token ? "failed" : "partially_verified" };
  }
}
