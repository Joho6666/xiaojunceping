export type ProjectKind =
  "video" | "web" | "cad" | "pcb" | "automation" | "general";
export type EvaluationMode = "quick" | "expert";
export type ProviderId = "openai" | "anthropic" | "gemini" | "deepseek" | "custom";
export type ConnectionMode = "cli" | "oauth" | "api-key";
export type ConnectionStatus =
  "connected" | "expired" | "unavailable" | "error";
export type CapabilityId = "web-search" | "github" | "browser" | "mcp" | "filesystem" | "terminal";
export type QuestionType =
  "single-choice" | "multi-choice" | "text" | "textarea" | "ranking";
export type AnswerValue = string | string[];
export type ConfidenceLevel = "高" | "中" | "低";
export type GenerationMode = "live" | "knowledge-only" | "mock";
export type CapabilityStatus = "推荐" | "有限制" | "不推荐";
export type EcosystemCategory =
  "ai-tool" | "agent" | "llm" | "skill" | "mcp" | "plugin";
export type KnowledgeKind = EcosystemCategory | "github" | "product" | "rule" | "algorithm";
export type KnowledgeSourceType = "official" | "github" | "npm" | "registry" | "community" | "snapshot";
export type KnowledgePublication = "published" | "pending" | "disabled";
export type ModelLifecycle = "stable" | "preview" | "experimental" | "deprecated" | "retired";
export type ModelModality = "text" | "vision" | "audio" | "video" | "image" | "embedding" | "code";
export interface QuestionOption {
  label: string;
  description?: string;
}
export interface InterviewQuestion {
  id: string;
  title: string;
  description?: string;
  type: QuestionType;
  options?: QuestionOption[];
  category: string;
  required?: boolean;
  dynamic?: ProjectKind;
}
export interface Project {
  id: string;
  idea: string;
  kind: ProjectKind;
  evaluationMode: EvaluationMode;
  createdAt: string;
  selectedConnectionId?: string;
  selectedModel?: string;
}
export interface ProjectSummary {
  title: string;
  typeLabel: string;
  stage: string;
  audience: string;
  summary: string;
  verdict: string;
  score: number;
  status: string;
  acceptanceCriteria: string[];
}
export interface ImplementationStrategy {
  type:
    | "从零开发"
    | "基于开源项目二次开发"
    | "多个开源组件组合"
    | "现有 SaaS + 自动化"
    | "No-Code / Low-Code"
    | "不建议开发";
  confidence: number;
  reason: string;
  recipe: string[];
  savings: { time: string; tokens: string };
}
export interface ScoreItem {
  label: string;
  score: number;
}
export interface AgentRecommendation {
  id: string;
  name: string;
  provider: string;
  description: string;
  role: string;
  capabilities: string[];
  bestFor: string[];
  matchScore: number;
  reason: string;
}
export interface ModelRecommendation {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  type: string[];
  task: string;
  contextWindow?: string;
  strengths: string[];
  weaknesses: string[];
  pricingLevel: number;
  matchScore: number;
  ratings: Record<
    "reasoning" | "coding" | "vision" | "video" | "speed",
    number
  >;
  reason: string;
}
export interface GithubProjectRecommendation {
  id: string;
  name: string;
  repo: string;
  url: string;
  description: string;
  stars: string;
  language: string;
  license: string;
  updatedAt: string;
  activity: number;
  maturity: number;
  similarity: number;
  recommendation: number;
  stack: string[];
  capabilities: string[];
  recommendedUse: string;
  reuseRatio: string;
  difficulty: string;
  risks: string[];
  advice: string;
  source?: "live" | "snapshot";
}
export interface ReferenceProduct {
  name: string;
  type: string;
  url: string;
  capabilities: string[];
  audience: string;
  businessModel: string;
  priceRange: string;
  similarity: number;
  learnFrom: string[];
  avoid: string[];
}
export interface ToolRecommendation {
  name: string;
  category: string;
  purpose: string;
  reason: string;
  required: boolean;
  alternatives: string[];
}
export interface EcosystemRecommendation {
  id: string;
  name: string;
  category: EcosystemCategory;
  description: string;
  url?: string;
  source: "github" | "npm" | "official" | "registry" | "local" | "snapshot";
  updatedAt: string;
  matchScore: number;
  reason: string;
  capabilities: string[];
  access: string;
  pricing?: string;
  pricingDetails?: KnowledgeItem["pricingDetails"];
}
export interface KnowledgeItem {
  id: string;
  kind: KnowledgeKind;
  name: string;
  vendor?: string;
  version?: string;
  summary: string;
  url?: string;
  githubUrl?: string;
  capabilities: string[];
  tags: string[];
  stack: string[];
  platforms: string[];
  license?: string;
  access?: string;
  pricing?: string;
  modelId?: string;
  contextWindow?: string;
  maxOutput?: string;
  modalities?: ModelModality[];
  modelCapabilities?: string[];
  lifecycle?: ModelLifecycle;
  aliases?: string[];
  pricingDetails?: { input?: string; output?: string; unit?: string };
  sourceUpdatedAt?: string;
  sourceType: KnowledgeSourceType;
  sourceUrl: string;
  updatedAt: string;
  verifiedAt?: string;
  confidence: ConfidenceLevel;
  publication: KnowledgePublication;
  status: "active" | "stale" | "invalid";
}
export interface RequirementProfile {
  projectName?: string;
  projectKind: ProjectKind;
  domain: string[];
  goals: string[];
  users?: string[];
  scenarios?: string[];
  requiredFeatures?: string[];
  capabilities: string[];
  tags: string[];
  stack: string[];
  platforms: string[];
  constraints: string[];
  dataSensitivity: "低" | "中" | "高" | "未知";
  budget?: string;
  time?: string;
  needsLiveSearch: boolean;
  needsBrowser?: boolean;
  needsGithub?: boolean;
  needsFilesystem?: boolean;
  needsTerminal?: boolean;
  needsMcp?: boolean;
  selectedProvider?: string;
  selectedModel?: string;
  excludedOptions?: string[];
  acceptanceCriteria?: string[];
}
export interface KnowledgeMatch {
  item: KnowledgeItem;
  score: number;
  matchedBy: string[];
  ruleNotes: string[];
  evidence: "knowledge-base" | "live" | "inference";
}
export interface KnowledgeSnapshot {
  snapshotAt: string;
  liveSearchAt?: string;
  itemCount: number;
  sources: string[];
  coverage: string;
  inferredCount: number;
  filteredCount: number;
  browserSearch?: { queries: string[]; resultCount: number; searchedAt?: string; error?: string };
}
export interface KnowledgeSyncRun {
  id: string;
  status: "running" | "completed" | "partial" | "failed";
  startedAt: string;
  completedAt?: string;
  inserted: number;
  updated: number;
  rejected: number;
  error?: string;
}
export interface InterfaceCapability {
  target: string;
  api: CapabilityStatus;
  cli: CapabilityStatus;
  mcp: CapabilityStatus;
  sdk: CapabilityStatus;
  computerUse: CapabilityStatus;
  note: string;
}
export interface TechStackRecommendation {
  layer: string;
  name: string;
  matchScore: number;
  reasons: string[];
  alternative: string;
}
export interface WorkflowPhase {
  id: string;
  title: string;
  goal: string;
  agent: string;
  model: string;
  tools: string[];
  input: string;
  actions: string[];
  output: string;
  time: string;
  tokens: string;
  acceptance: string;
  risk: string;
}
export interface AlternativeStrategy {
  name: string;
  strategy: string;
  recommended?: boolean;
  time: string;
  tokens: string;
  cost: string;
  risk: string;
  freedom: string;
  description: string;
}
export interface Estimate {
  display: string;
  range: string;
  confidence: ConfidenceLevel;
  breakdown: { label: string; value: string }[];
}
export interface AutomationEstimate {
  rate: number;
  aiWork: string[];
  humanWork: string[];
  confidence: ConfidenceLevel;
}
export interface RiskItem {
  title: string;
  level: string;
  probability: string;
  impact: string;
  advice: string;
}
export interface ConfidenceScores {
  agents: ConfidenceLevel;
  models: ConfidenceLevel;
  tokens: ConfidenceLevel;
  time: ConfidenceLevel;
  cost: ConfidenceLevel;
  github: ConfidenceLevel;
  explanation: string[];
}
export interface AnalysisSource {
  id: string;
  type: string;
  name: string;
  url?: string;
  updatedAt: string;
  count?: string;
}
export interface SearchPlan {
  queries: string[];
  sources: Array<"knowledge-base" | "github" | "official" | "registry">;
  generatedBy: string;
  generatedAt: string;
}
export interface VerifiedFact {
  type: "github" | "product" | "model" | "tool" | "skill" | "mcp";
  name: string;
  url: string;
  source: string;
  verifiedAt: string;
  evidence: string;
}
export interface InferredSuggestion {
  name: string;
  category: string;
  reason: string;
  confidence: ConfidenceLevel;
  requiresValidation: boolean;
}
export interface AgentPlan {
  order: string[];
  agents: Array<{
    id: string;
    name: string;
    role: string;
    modelId: string;
    tools: string[];
    inputs: string[];
    actions: string[];
    outputs: string[];
    acceptance: string[];
  }>;
}
export interface PromptArtifact {
  id: string;
  type: "master" | "agent" | "agents-md";
  name: string;
  content: string;
  generatedAt: string;
}
export interface ActualAIUsage {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  recordedAt: string;
}
export interface ProjectReport {
  id: string;
  projectKind: ProjectKind;
  projectIdea?: string;
  projectSummary: ProjectSummary;
  strategy: ImplementationStrategy;
  scores: ScoreItem[];
  agents: AgentRecommendation[];
  models: ModelRecommendation[];
  githubProjects: GithubProjectRecommendation[];
  referenceProducts: ReferenceProduct[];
  tools: ToolRecommendation[];
  ecosystem: EcosystemRecommendation[];
  knowledge?: KnowledgeSnapshot;
  interfaces: InterfaceCapability[];
  techStack: TechStackRecommendation[];
  workflows: WorkflowPhase[];
  alternatives: AlternativeStrategy[];
  architecture: string[];
  estimates: {
    tokens: Estimate;
    time: Estimate;
    cost: Estimate;
    humanEffort?: Estimate;
    automation: AutomationEstimate;
  };
  actualUsage?: ActualAIUsage;
  risks: RiskItem[];
  confidence: ConfidenceScores;
  sources: AnalysisSource[];
  generatedAt: string;
  generationMode?: GenerationMode;
  inputFingerprint?: string;
  provider?: string;
  model?: string;
  connectionMode?: ConnectionMode;
  searchPlan?: SearchPlan;
  verifiedFacts?: VerifiedFact[];
  inferredSuggestions?: InferredSuggestion[];
  agentPlan?: AgentPlan;
  promptArtifacts?: PromptArtifact[];
}
export interface QuickReportView {
  title: string;
  status: string;
  verdict: string;
  summary: string;
  strategy: ImplementationStrategy;
  primaryAgent: AgentRecommendation;
  primaryModels: ModelRecommendation[];
  githubProjects: GithubProjectRecommendation[];
  estimates: {
    time: Estimate;
    tokens: Estimate;
    cost: Estimate;
    humanEffort: Estimate;
  };
  workflow: Pick<WorkflowPhase, "id" | "title" | "goal" | "time">[];
  risks: RiskItem[];
  acceptanceCriteria: string[];
}
export interface AnalysisJob {
  id: string;
  mode: EvaluationMode;
  status:
    | "queued"
    | "understanding"
    | "researching"
    | "matching"
    | "estimating"
    | "generating"
    | "completed"
    | "failed";
  progress: number;
  currentStep: string;
  stepIndex: number;
}
export interface ProviderConnection {
  id: string;
  provider: ProviderId;
  mode: ConnectionMode;
  status: ConnectionStatus;
  displayName: string;
  scopes?: string[];
  expiresAt?: string;
  lastCheckedAt?: string;
  maskedKey?: string;
  baseUrl?: string;
  model?: string;
  errorCode?: string;
}
export interface CapabilityConnection {
  id: CapabilityId;
  name: string;
  status: ConnectionStatus;
  endpoint?: string;
  mode: "api-key" | "local" | "url";
  scopes?: string[];
  lastCheckedAt?: string;
  errorCode?: string;
}
export interface PersistedState {
  version: 3;
  project: Project | null;
  answers: Record<string, AnswerValue>;
  currentQuestion: number;
  report: ProjectReport | null;
  analysisJob: AnalysisJob | null;
  reportView: EvaluationMode;
  upgradePending: boolean;
}
