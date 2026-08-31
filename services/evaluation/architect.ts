import { RequirementProfile } from "../../types";

const FEATURE_ARCHITECTURE: Record<string, { components: string[]; interfaces: string[]; dataFlow: string[]; storage?: string[]; security?: string[] }> = {
  chat: {
    components: ["Message Schema", "Realtime Backend", "Chat UI", "Notification", "E2E Test"],
    interfaces: ["实时消息接口"],
    dataFlow: ["客户端 → 消息 API → 通道 → 持久化"],
  },
  login: {
    components: ["Identity Provider", "Session Store", "Auth UI"],
    interfaces: ["认证接口"],
    dataFlow: ["凭证 → 身份提供方 → 会话"],
    security: ["会话边界", "凭证不进报告"],
  },
  payment: {
    components: ["Payment Provider", "Webhook Handler", "Ledger"],
    interfaces: ["支付回调接口"],
    dataFlow: ["下单 → Provider → Webhook → 对账"],
    security: ["支付密钥隔离"],
  },
  firmware: {
    components: ["Peripheral Drivers", "Control Loop", "Hardware Bring-up"],
    interfaces: ["设备调试接口"],
    dataFlow: ["传感器 → 控制回路 → 执行器"],
    storage: ["设备侧配置"],
  },
  video: {
    components: ["Ingest Pipeline", "Transcode / Slice", "Subtitle Job", "Render QA"],
    interfaces: ["媒体任务接口"],
    dataFlow: ["素材 → 转码切片 → 字幕 → 输出"],
  },
  dashboard: {
    components: ["Metrics API", "Admin UI", "Access Policy"],
    interfaces: ["后台查询接口"],
    dataFlow: ["采集 → 聚合 → 面板"],
  },
  auth: {
    components: ["Identity Provider", "Session Policy"],
    interfaces: ["认证接口"],
    dataFlow: ["身份 → 会话策略"],
  },
};

export function planArchitecture(profile: RequirementProfile) {
  const features = profile.requiredFeatures || [];
  const mapped = features.map((feature) => FEATURE_ARCHITECTURE[feature] || {
    components: [`${feature} 实现`, `${feature} 验收`],
    interfaces: [`${feature} 接口`],
    dataFlow: [`输入 → ${feature} → 验收`],
  });
  const components = [
    ...mapped.flatMap((item) => item.components),
    ...(profile.needsTerminal ? ["本机执行边界"] : []),
    ...(profile.needsGithub ? ["仓库集成"] : []),
    ...(profile.platforms.includes("web") ? ["Web 部署面"] : []),
    ...(profile.platforms.includes("embedded-device") ? ["设备固件面"] : []),
  ];
  const interfaces = mapped.flatMap((item) => item.interfaces);
  const dataFlow = mapped.flatMap((item) => item.dataFlow);
  const storage = [
    ...(profile.integrations || []).some((item) => item.type === "database") ? ["应用数据库"] : ["本地/待确认存储"],
    ...mapped.flatMap((item) => item.storage || []),
  ];
  const deployment = profile.deploymentTarget || profile.platforms || ["unknown"];
  const securityBoundaries = Array.from(new Set([
    ...(profile.dataSensitivity === "高" ? ["敏感数据不出本机", "密钥不进报告"] : ["最小权限"]),
    ...mapped.flatMap((item) => item.security || []),
  ]));
  const assumptions = [
    features.length ? "核心功能来自需求抽取与 feature breakdown" : "功能清单仍不完整",
    profile.needsGithub ? "需要开源参考" : "不强制 GitHub",
    (profile.platforms || []).filter((item) => item !== "unknown").length ? `平台：${profile.platforms.join("、")}` : "平台仍待确认",
  ];
  const risks = [
    ...(storage[0].includes("待确认") ? ["存储方案未确认"] : []),
    ...(features.includes("payment") ? ["支付回调与对账失败"] : []),
    ...(profile.dataSensitivity === "高" ? ["高敏感数据出域"] : []),
  ];
  return {
    components: Array.from(new Set(components)),
    interfaces: Array.from(new Set(interfaces.length ? interfaces : ["应用接口"])),
    dataFlow: Array.from(new Set(dataFlow.length ? dataFlow : ["用户输入 → 需求合同 → 执行任务 → 验收"])),
    storage: Array.from(new Set(storage)),
    deployment,
    securityBoundaries,
    assumptions,
    risks,
  };
}
