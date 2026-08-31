import { EvaluationMode, RequirementProfile } from "../../types";

const EXPERT_THRESHOLD = 0.55;
const QUICK_THRESHOLD = 0.35;

export function evaluateRequirementGate(profile: RequirementProfile, mode: EvaluationMode = "expert") {
  const completeness = profile.completeness || { score: 0, missingFields: [], blockingQuestions: [], optionalQuestions: [] };
  const threshold = mode === "expert" ? EXPERT_THRESHOLD : QUICK_THRESHOLD;
  const tooVague = completeness.score < threshold || ((profile.requiredFeatures || []).length === 0 && completeness.score < 0.6);
  if (!tooVague) {
    return { allowed: true as const, status: "ok" as const, completeness, questions: [] as string[] };
  }
  const questions = (completeness.blockingQuestions.length ? completeness.blockingQuestions : completeness.optionalQuestions).slice(0, 5);
  return {
    allowed: false as const,
    status: "needs_clarification" as const,
    completeness,
    questions: questions.length ? questions : ["目标用户是谁？", "最核心的功能有哪些？", "部署在什么平台？"],
  };
}
