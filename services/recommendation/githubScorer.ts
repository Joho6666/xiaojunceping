import { Evidence, GithubProjectRecommendation, RequirementProfile } from "../../types";
import { createEvidence } from "../evidence/evidenceStore";
import { tokenize } from "../retrieval/lexical";

const PERMISSIVE = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Unlicense"]);
const COPYLEFT = new Set(["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0"]);

export interface GithubCandidate {
  id?: string | number;
  name?: string;
  full_name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  language?: string | null;
  license?: { spdx_id?: string | null } | null;
  topics?: string[];
  updated_at?: string;
  pushed_at?: string;
  created_at?: string;
  archived?: boolean;
  default_branch?: string;
}

function overlap(a: string[], b: string[]) {
  const left = new Set(a.map((item) => item.toLowerCase()));
  const right = b.map((item) => item.toLowerCase());
  if (!left.size || !right.length) return 0;
  const hits = right.filter((item) => Array.from(left).some((token) => item.includes(token) || token.includes(item)));
  return Math.min(100, Math.round((hits.length / Math.max(left.size, 1)) * 100));
}

function recencyScore(iso?: string) {
  if (!iso) return 30;
  const ageDays = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (Number.isNaN(ageDays)) return 30;
  if (ageDays < 30) return 95;
  if (ageDays < 90) return 85;
  if (ageDays < 365) return 70;
  if (ageDays < 730) return 50;
  return 25;
}

function licenseFit(spdx: string): { score: number; use: GithubProjectRecommendation["licenseUse"] } {
  if (!spdx || spdx === "NOASSERTION" || spdx === "未声明") return { score: 40, use: "待确认" };
  if (PERMISSIVE.has(spdx)) return { score: 100, use: "核心二开" };
  if (COPYLEFT.has(spdx)) return { score: 35, use: "不建议商业复用" };
  return { score: 55, use: "架构参考" };
}

export function scoreGithubRepository(profile: RequirementProfile, item: GithubCandidate): GithubProjectRecommendation {
  const description = String(item.description || "暂无项目简介").replace(/\s+/g, " ").slice(0, 180);
  const topics = Array.isArray(item.topics) ? item.topics.filter((topic): topic is string => typeof topic === "string") : [];
  const haystack = tokenize([item.name || "", item.full_name || "", description, ...topics].join(" "));
  const domainTerms = tokenize([...((profile.domains || []).map((domain) => domain.name)), ...profile.domain].join(" "));
  const featureTerms = tokenize((profile.requiredFeatures || []).concat(profile.capabilities).join(" "));
  const stackTerms = tokenize(profile.stack.concat(profile.preferredStack || []).join(" "));
  const domain = overlap(domainTerms, haystack);
  const feature = overlap(featureTerms, haystack);
  const stack = overlap(stackTerms, haystack.length ? haystack.concat([String(item.language || "").toLowerCase()]) : [String(item.language || "").toLowerCase()]);
  const stars = Number(item.stargazers_count || 0);
  const forks = Number(item.forks_count || 0);
  const maturity = Math.min(95, Math.round(20 + Math.log10(stars + 10) * 18 + Math.min(15, Math.log10(forks + 1) * 10)));
  const maintainability = item.archived ? 15 : recencyScore(item.pushed_at || item.updated_at);
  const license = licenseFit(String(item.license?.spdx_id || "未声明"));
  const similarity = Math.round(
    domain * 0.28 + feature * 0.24 + stack * 0.18 + maturity * 0.12 + maintainability * 0.12 + license.score * 0.06,
  );
  const evidence: Evidence[] = [
    createEvidence({
      type: "github",
      title: String(item.full_name || item.name),
      url: String(item.html_url || ""),
      confidence: String(item.html_url || "").startsWith("http") ? "high" : "low",
      verifiedAt: new Date().toISOString(),
      note: `stars=${stars}; pushed=${item.pushed_at || item.updated_at || "unknown"}; license=${item.license?.spdx_id || "unknown"}`,
    }),
  ];
  return {
    id: `github-${String(item.id || item.full_name || item.name)}`,
    name: String(item.name || "未命名仓库"),
    repo: String(item.full_name || ""),
    url: String(item.html_url || ""),
    description,
    stars: stars.toLocaleString("en-US"),
    language: String(item.language || "未知"),
    license: String(item.license?.spdx_id || "未声明"),
    updatedAt: String(item.updated_at || new Date().toISOString()).slice(0, 10),
    activity: maintainability,
    maturity,
    similarity,
    recommendation: similarity >= 75 ? 5 : similarity >= 60 ? 4 : similarity >= 45 ? 3 : 2,
    stack: Array.from(new Set([String(item.language || "代码"), ...topics.slice(0, 3)])),
    capabilities: [description, ...topics.slice(0, 3)],
    recommendedUse: similarity >= 70 ? `可作为当前项目的实现参考：先运行 ${item.full_name} 的核心路径再决定复用范围` : `仅作架构/功能参考，相关度有限`,
    reuseRatio: "需运行与代码审查后估计",
    difficulty: item.archived ? "高（已归档）" : stars > 1000 ? "中等" : "需重点验证成熟度",
    risks: [
      item.archived ? "仓库已归档" : "活跃度需结合最近提交判断",
      license.use === "不建议商业复用" ? "许可证可能限制商业复用" : "许可证和使用边界需复核",
    ],
    advice: `许可建议：${license.use}。评分来自领域/功能/技术栈/成熟度/可维护性/许可证，而不是搜索排序。`,
    source: "live",
    evidenceIds: evidence.map((itemEvidence) => itemEvidence.id),
    scoreBreakdown: { domain, feature, stack, maturity, maintainability, license: license.score },
    licenseUse: license.use,
    archived: Boolean(item.archived),
    forks,
    openIssues: Number(item.open_issues_count || 0),
    pushedAt: item.pushed_at,
    createdAt: item.created_at,
  };
}

export function attachGithubEvidence(items: GithubProjectRecommendation[]): Evidence[] {
  return items.map((item) =>
    createEvidence({
      id: item.evidenceIds?.[0],
      type: "github",
      title: item.repo || item.name,
      url: item.url,
      confidence: item.url.startsWith("http") ? "high" : "low",
      verifiedAt: new Date().toISOString(),
      note: item.advice,
    }),
  );
}
