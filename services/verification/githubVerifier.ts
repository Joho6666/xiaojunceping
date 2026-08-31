import { GithubProjectRecommendation, VerificationStatus } from "../../types";
import { attachGithubEvidence } from "../recommendation/githubScorer";
import { evidenceWithClaim } from "../evidence/integrity";
import { safeFetch } from "../net/safeFetch";

export async function verifyGithubRecommendation(item: GithubProjectRecommendation, token?: string): Promise<GithubProjectRecommendation & { verificationStatus: VerificationStatus }> {
  const match = item.url.match(/^https?:\/\/github\.com\/([^/]+\/[^/#?]+)/i);
  if (!match) return { ...item, similarity: 0, verificationStatus: "failed" };
  try {
    const response = await safeFetch(`https://api.github.com/repos/${match[1].replace(/\.git$/, "")}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "AgentScope-Evaluator", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { ...item, verificationStatus: token ? "failed" : "unverified" };
    const data = await response.json() as { archived?: boolean; stargazers_count?: number; license?: { spdx_id?: string }; pushed_at?: string };
    const license = data.license?.spdx_id || item.license;
    const status: VerificationStatus = data.archived ? "partially_verified" : "verified";
    const updated: GithubProjectRecommendation & { verificationStatus: VerificationStatus } = {
      ...item,
      archived: Boolean(data.archived),
      stars: Number(data.stargazers_count || 0).toLocaleString("en-US"),
      license,
      pushedAt: data.pushed_at,
      verificationStatus: status,
    };
    const [existing] = attachGithubEvidence([updated]);
    if (existing) {
      existing.verifiedAt = new Date().toISOString();
      existing.verificationStatus = status;
      existing.confidence = "high";
      const withLicense = evidenceWithClaim(existing, "license", `Repo License = ${license}`);
      existing.claims = withLicense.claims;
    }
    return updated;
  } catch {
    return { ...item, verificationStatus: token ? "failed" : "unverified" };
  }
}
