import { AnswerValue, RequirementCompleteness, RequirementProfile } from "../../types";

export function scoreRequirementCompleteness(profile: RequirementProfile, answers: Record<string, AnswerValue> = {}): RequirementCompleteness {
  const missing: string[] = [];
  const blocking: string[] = [];
  const optional: string[] = [];
  let score = 0.15;
  if ((profile.goals || []).some((goal) => goal.length > 12)) score += 0.12; else missing.push("目标描述过短");
  if ((profile.requiredFeatures || []).length >= 2) score += 0.18; else {
    missing.push("主要功能");
    blocking.push("这个项目最核心的 2–3 个功能是什么？");
  }
  if (profile.userType && profile.userType !== "未确认") score += 0.1; else {
    missing.push("目标用户");
    blocking.push("主要给谁用？");
  }
  if ((profile.platforms || []).some((item) => item !== "unknown")) score += 0.12; else {
    missing.push("部署环境 / 平台");
    blocking.push("跑在什么平台上：设备、Web、小程序还是桌面？");
  }
  if (profile.budget && profile.budget !== "未知") score += 0.08; else {
    missing.push("预算");
    optional.push("有没有成本或模型预算限制？");
  }
  if (profile.timeline && profile.timeline !== "未知") score += 0.08; else {
    missing.push("时间");
    optional.push("希望多久做完？");
  }
  if ((profile.acceptanceCriteria || []).length) score += 0.1; else missing.push("验收标准");
  if ((profile.integrations || []).length || (profile.stack || []).length) score += 0.07;
  if (Object.keys(answers).filter((key) => key !== "idea" && answers[key] && String(answers[key]).length).length >= 3) score += 0.1;
  if ((profile.domains || []).length <= 1 && (profile.requiredFeatures || []).length < 1) {
    blocking.push("这是什么类型的系统？解决谁的什么问题？");
  }
  return {
    score: Number(Math.min(0.98, score).toFixed(2)),
    missingFields: Array.from(new Set(missing)),
    blockingQuestions: Array.from(new Set(blocking)).slice(0, 5),
    optionalQuestions: Array.from(new Set(optional)).slice(0, 4),
  };
}
