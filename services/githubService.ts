import { GithubProjectRecommendation, Project, ProjectKind, RequirementProfile } from "../types";
import { isCommerceProject, profileFor } from "../data/projectProfiles";
import { scoreGithubRepository } from "./recommendation/githubScorer";
import { extractRequirementProfile } from "./requirements/extractor";
import { safeFetch } from "./net/safeFetch";

const keywords: Record<ProjectKind, string> = {
  video: "AI video editing FFmpeg",
  web: "Next.js SaaS starter",
  cad: "parametric CAD FreeCAD STEP",
  pcb: "KiCad PCB SKiDL STM32",
  automation: "workflow automation n8n API",
  general: "AI application",
};

function queriesFor(project: Project, queryHints: string[] = []) {
  const idea = project.idea.slice(0, 120);
  if (isCommerceProject(project)) {
    return [
      "ecommerce fashion storefront cart checkout payment in:name,description",
      "Medusa Saleor Vendure commerce in:name,description",
      `${idea} ecommerce GitHub open source`,
      ...queryHints,
    ];
  }
  const special = /微信|小程序|点餐|餐厅/.test(idea)
    ? "wechat mini program restaurant ordering"
    : /视频|剪辑|TikTok|短视频/.test(idea)
      ? "AI video editing FFmpeg short video"
      : /邮件|自动化|n8n|工作流/.test(idea)
        ? "email workflow automation n8n"
        : idea;
  return [
    `${special} in:name,description`,
    `${keywords[project.kind]} in:name,description`,
    `${idea} GitHub open source`,
    ...queryHints,
  ];
}

const curated: Record<ProjectKind, string[]> = {
  video: [
    "harry0703/MoneyPrinterTurbo",
    "WyattBlue/auto-editor",
    "RayVentura/ShortGPT",
    "remotion-dev/remotion",
    "kdenlive/kdenlive",
    "olive-editor/olive",
  ],
  web: [
    "medusajs/medusa",
    "saleor/saleor",
    "vercel/commerce",
    "nextjs/saas-starter",
    "vendure-ecommerce/vendure",
    "bagisto/bagisto",
    "shopware/shopware",
    "refinedev/refine",
    "payloadcms/payload",
    "directus/directus",
    "appwrite/appwrite",
    "strapi/strapi",
  ],
  cad: ["FreeCAD/FreeCAD", "CadQuery/cadquery", "openscad/openscad", "BRL-CAD/brlcad"],
  pcb: ["devbisme/skidl", "KiCad/kicad-source-mirror", "LibrePCB/LibrePCB", "easyw/kicad-3d-models"],
  automation: ["n8n-io/n8n", "activepieces/activepieces", "huginn/huginn", "windmill-labs/windmill", "triggerdotdev/trigger.dev"],
  general: ["sindresorhus/awesome", "github/gitignore"],
};

const relevanceTerms: Record<ProjectKind, string[]> = {
  video: ["video", "ffmpeg", "clip", "subtitle", "short", "media", "movie"],
  web: [
    "next",
    "react",
    "saas",
    "web",
    "starter",
    "website",
    "dashboard",
    "supabase",
    "auth",
    "admin",
    "cms",
    "platform",
    "backend",
    "api",
    "小程序",
  ],
  cad: [
    "cad",
    "freecad",
    "cadquery",
    "openscad",
    "step",
    "stl",
    "parametric",
    "model",
  ],
  pcb: [
    "pcb",
    "kicad",
    "skidl",
    "gerber",
    "eda",
    "circuit",
    "schematic",
    "stm32",
  ],
  automation: [
    "automation",
    "workflow",
    "n8n",
    "api",
    "integration",
    "trigger",
    "agent",
  ],
  general: ["application", "software", "web", "api", "agent", "tool"],
};

function isRelevant(item: Record<string, unknown>, kind: ProjectKind) {
  const haystack = [
    item.name,
    item.full_name,
    item.description,
    ...(Array.isArray(item.topics) ? item.topics : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return relevanceTerms[kind].some((term) => haystack.includes(term));
}

export function filterGithubProjects(
  project: Pick<Project, "idea" | "kind">,
  items: GithubProjectRecommendation[],
) {
  const profile = profileFor(project);
  const terms = profile.keywords.length
    ? profile.keywords
    : relevanceTerms[project.kind];
  const curatedSet = new Set(
    profile.curatedRepos.map((repo) => repo.toLowerCase()),
  );
  return items
    .filter((item) => {
      if (item.scoreBreakdown || item.source === "live") return true;
      const repo = item.repo.toLowerCase();
      const text = `${item.repo} ${item.name} ${item.description} ${(item.capabilities || []).join(" ")} ${(item.stack || []).join(" ")}`.toLowerCase();
      return (
        curatedSet.has(repo) ||
        terms.some((term) => text.includes(term.toLowerCase()))
      );
    })
    .slice(0, 12);
}

function mapRepository(
  item: Record<string, unknown>,
  profile: RequirementProfile,
): GithubProjectRecommendation {
  return scoreGithubRepository(profile, item);
}

export async function searchGithubProjects(
  project: Project,
  queryHints: string[] = [],
  options: { githubToken?: string; profile?: RequirementProfile } = {},
): Promise<GithubProjectRecommendation[]> {
  const profile = options.profile || extractRequirementProfile(project);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const [curatedItems, searchItems] = await Promise.all([
      Promise.all(
        curated[project.kind].map(async (repo) => {
          const response = await safeFetch(`https://api.github.com/repos/${repo}`, {
            headers: {
              Accept: "application/vnd.github+json",
              "User-Agent": "AgentScope-Evaluator",
              ...(options.githubToken ? { Authorization: `Bearer ${options.githubToken}` } : {}),
            },
            signal: controller.signal,
          });
          return response.ok
            ? ((await response.json()) as Record<string, unknown>)
            : null;
        }),
      ),
      Promise.all(
        Array.from(
          new Set(
            queriesFor(project, queryHints).map((query) => query.slice(0, 140)),
          ),
        )
          .slice(0, 6)
          .map(async (query) => {
            const response = await safeFetch(
              `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=6`,
              {
                headers: {
                  Accept: "application/vnd.github+json",
                  "User-Agent": "AgentScope-Evaluator",
                  ...(options.githubToken ? { Authorization: `Bearer ${options.githubToken}` } : {}),
                },
                signal: controller.signal,
              },
            );
            if (!response.ok) return [] as Array<Record<string, unknown>>;
            const data = (await response.json()) as {
              items?: Array<Record<string, unknown>>;
            };
            return data.items || [];
          }),
      ),
    ]);
    const results = [
      ...curatedItems.filter((item): item is Record<string, unknown> =>
        Boolean(item),
      ),
      ...searchItems.flat(),
    ].filter((item) => isRelevant(item, project.kind));
    const ranked = results.map((item) => ({
      item,
      rank: scoreGithubRepository(profile, item).similarity,
    }));
    const best = new Map<
      string,
      { item: Record<string, unknown>; rank: number }
    >();
    ranked.forEach((entry) => {
      const key = String(entry.item.full_name || entry.item.id);
      if (!best.has(key) || best.get(key)!.rank < entry.rank)
        best.set(key, entry);
    });
    const unique = Array.from(best.values())
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 12)
      .map((entry) => entry.item);
    return filterGithubProjects(project, unique.map((item) => mapRepository(item, profile))).map(
      (item) => ({ ...item, source: "live" as const }),
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyGithubUrls(
  project: Project,
  urls: string[],
  options: { githubToken?: string; profile?: RequirementProfile } = {},
): Promise<GithubProjectRecommendation[]> {
  const profile = options.profile || extractRequirementProfile(project);
  const repos = Array.from(new Set(urls.map((url) => {
    const match = url.match(/^https?:\/\/github\.com\/([^/]+\/[^/#?]+)/i);
    return match?.[1]?.replace(/\.git$/, "");
  }).filter((repo): repo is string => Boolean(repo))));
  const responses = await Promise.all(repos.slice(0, 16).map(async (repo) => {
    const response = await safeFetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "AgentScope-Evaluator", ...(options.githubToken ? { Authorization: `Bearer ${options.githubToken}` } : {}) }, signal: AbortSignal.timeout(12000) });
    return response.ok ? await response.json() as Record<string, unknown> : null;
  }));
  return responses.filter((item): item is Record<string, unknown> => Boolean(item)).map((item) => ({ ...mapRepository(item, profile), source: "live" as const })).sort((a, b) => b.similarity - a.similarity);
}
