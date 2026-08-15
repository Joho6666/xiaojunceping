import {AnalysisJob,EvaluationMode} from '../types';
export const analysisSteps=['读取项目描述和访谈答案','生成项目需求画像','查询本地知识库','生成联网搜索计划','搜索 GitHub 和官方产品','核验来源和版本','过滤不适配候选','匹配 Agent、模型、Skill 和 MCP','生成项目工作流','预测 Token、时间与成本','生成报告与 Prompt 文件'];
export const quickAnalysisSteps=['理解项目','检索 GitHub 与知识库','匹配 Skill / MCP / Plugin','匹配 Agent 与模型','配置执行模型','预测 Token、时间与成本','生成执行计划'];
export function createAnalysisJob(mode:EvaluationMode='expert'):AnalysisJob{const steps=mode==='quick'?quickAnalysisSteps:analysisSteps;return{id:crypto.randomUUID(),mode,status:'queued',progress:0,currentStep:steps[0],stepIndex:0}}
export function getAnalysisSteps(mode:EvaluationMode){return mode==='quick'?quickAnalysisSteps:analysisSteps}
