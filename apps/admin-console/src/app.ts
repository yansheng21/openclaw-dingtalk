export const adminConsoleTitle = "DingClaw 管理端";
export const adminConsoleSections = [
  "工作台",
  "组织与身份",
  "智能体",
  "模型与中转",
  "权限与策略",
  "审批中心",
  "审计中心",
  "渠道接入",
  "工具与集成",
  "节点与浏览器",
  "系统设置",
] as const;

export const adminConsoleCards = [
  {
    title: "工作台",
    subtitle: "集中查看系统状态、风险和待办。",
  },
  {
    title: "渠道接入",
    subtitle: "配置钉钉、飞书、微信等接入实例。",
  },
  {
    title: "模型与中转",
    subtitle: "直接配置 provider、model、url 和 key。",
  },
] as const;
