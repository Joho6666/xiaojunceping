export type ProjectKind =
  "video" | "web" | "cad" | "pcb" | "automation" | "general";
export type EvaluationMode = "quick" | "expert";
export type ProviderId = "openai" | "anthropic" | "gemini" | "deepseek";
export type ConnectionMode = "cli" | "oauth" | "api-key";
export type ConnectionStatus =
  "connected" | "expired" | "unavailable" | "error";
export type QuestionType =
  "single-choice" | "multi-choice" | "text" | "textarea" | "ranking";
export type AnswerValue = string | string[];
export type ConfidenceLevel = "高" | "中" | "低";
export type CapabilityStatus = "推荐" | "有限制" | "不推荐";
export type EcosystemCategory =
  "ai-tool" | "agent" | "llm" | "skill" | "mcp" | "plugin";
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
