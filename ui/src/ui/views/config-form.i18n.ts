import { i18n } from "../../i18n/index.ts";
import type { ConfigUiHint } from "../types.ts";

type ConfigHintOverride = Partial<Pick<ConfigUiHint, "label" | "help" | "placeholder">>;

function createScopedOverrides(
  prefixes: readonly string[],
  overrides: Record<string, ConfigHintOverride>,
): Record<string, ConfigHintOverride> {
  return Object.fromEntries(
    prefixes.flatMap((prefix) =>
      Object.entries(overrides).map(([suffix, override]) => [`${prefix}.${suffix}`, override] as const),
    ),
  );
}

const CHANNEL_SCOPE_PREFIXES = ["channels.*", "plugins.entries.*.config", "*"] as const;
const CHANNEL_ACCOUNT_SCOPE_PREFIXES = [
  "channels.*.accounts.*",
  "plugins.entries.*.config.accounts.*",
  "*.accounts.*",
] as const;
const CHANNEL_ENTITY_SCOPE_PREFIXES = [
  "channels.*.*.*",
  "plugins.entries.*.config.*.*",
  "*.*.*",
] as const;

const CHANNEL_ROOT_OVERRIDES = createScopedOverrides(CHANNEL_SCOPE_PREFIXES, {
  enabled: { label: "启用接入" },
  name: { label: "显示名称" },
  accounts: {
    label: "账号列表",
    help: "按账号 ID 维护多套接入配置。每个键就是一个接入账号标识；未单独覆盖的字段会继承上层默认值。",
  },
  defaultAccount: {
    label: "默认账号",
    help: "未明确指定账号时，系统默认使用这个账号进行出站发送、连接测试和运行时调用。通常填写账号 ID；未设置时会回退到 default 或首个可用账号。",
  },
  dmPolicy: {
    label: "私信接入策略",
    help: "控制私信是否允许触发机器人。常见取值：配对后允许、白名单、开放、禁用。",
  },
  groupPolicy: {
    label: "群聊接入策略",
    help: "控制群聊消息是否允许触发机器人。常见取值：白名单、开放、禁用。",
  },
  dmHistoryLimit: {
    label: "私信上下文条数",
    help: "限制每个私信会话保留多少条历史消息用于上下文。数值越大，上下文越完整，但 token 消耗也越高。",
  },
  textChunkLimit: {
    label: "文本分片上限",
    help: "长文本需要拆分发送时，每一片允许的最大长度。",
  },
  typingIndicator: {
    label: "输入中提示",
    help: "回复前是否向对方显示“正在输入 / 正在处理”状态。",
  },
  appKey: {
    label: "应用 Key",
    help: "填写钉钉或目标平台提供的应用 Key / AppKey。",
  },
  appSecret: {
    label: "应用密钥",
    help: "填写应用 Secret / AppSecret。该值会在本地控制台中直接显示，便于查看和修改。",
  },
  clientId: {
    label: "客户端 ID",
    help: "用于填写 Client ID / 应用客户端标识。",
  },
  clientSecret: {
    label: "客户端密钥",
    help: "用于填写 Client Secret / 应用密钥。该值会在本地控制台中直接显示，便于查看和修改。",
  },
  knowledgeBaseSync: {
    label: "知识库同步",
    help: "把当前钉钉账号的知识库同步到指定 agent 工作区，供 memory_search 等能力检索。",
  },
  "knowledgeBaseSync.enabled": {
    label: "启用知识库同步",
  },
  "knowledgeBaseSync.operatorId": {
    label: "操作人 ID",
    help: "用于钉钉知识库 API 的操作人标识，通常填写具备读取权限的 UnionId 或兼容 ID。",
  },
  "knowledgeBaseSync.targetAgentId": {
    label: "目标 Agent",
    help: "同步结果写入哪个 agent 的工作区。未填写时回退到默认 agent。",
  },
  "knowledgeBaseSync.workspaceIds": {
    label: "知识库 ID 列表",
    help: "只同步指定知识库；留空时按可见范围或默认上限同步。",
  },
  "knowledgeBaseSync.maxWorkspaces": {
    label: "最大知识库数量",
    help: "未指定 workspaceIds 时，最多同步多少个可见知识库。",
  },
  "knowledgeBaseSync.maxNodesPerWorkspace": {
    label: "单库最大节点数",
    help: "限制每个知识库递归遍历的节点数量，避免单次同步过大。",
  },
  operatorId: {
    label: "操作人 ID",
    help: "用于钉钉知识库 API 的操作人标识，通常填写具备读取权限的 UnionId 或兼容 ID。",
  },
  targetAgentId: {
    label: "目标 Agent",
    help: "同步结果写入哪个 agent 的工作区。未填写时回退到默认 agent。",
  },
  workspaceIds: {
    label: "知识库 ID 列表",
    help: "只同步指定知识库；留空时按可见范围或默认上限同步。",
  },
  maxWorkspaces: {
    label: "最大知识库数量",
    help: "未指定 workspaceIds 时，最多同步多少个可见知识库。",
  },
  maxNodesPerWorkspace: {
    label: "单库最大节点数",
    help: "限制每个知识库递归遍历的节点数量，避免单次同步过大。",
  },
  agentId: { label: "应用 Agent ID" },
  robotCode: { label: "机器人编码" },
  tenantId: { label: "租户 ID" },
  systemPrompt: {
    label: "系统提示词",
    help: "为当前频道或接入范围追加固定提示词，用于约束回复风格、角色与处理规则。",
  },
  tools: {
    label: "可用工具",
    help: "限制当前频道或接入范围可以调用的工具集合。",
  },
  allowFrom: {
    label: "允许来源",
    help: "用于白名单或配对策略下的允许用户、会话或来源列表。",
  },
  groupAllowFrom: {
    label: "群聊允许列表",
    help: "指定允许在群聊中触发机器人的群组、用户或来源标识。",
  },
  streamMode: {
    label: "流式回复模式",
    help: "控制是否以流式方式逐段输出回复内容。",
  },
});

const CHANNEL_ACCOUNT_OVERRIDES = createScopedOverrides(CHANNEL_ACCOUNT_SCOPE_PREFIXES, {
  enabled: { label: "启用账号" },
  name: { label: "账号名称" },
  appKey: {
    label: "账号应用 Key",
    help: "填写当前账号使用的应用 Key / AppKey。",
  },
  appSecret: {
    label: "账号应用密钥",
    help: "填写当前账号使用的应用 Secret / AppSecret。该值会在本地控制台中直接显示，便于查看和修改。",
  },
  clientId: {
    label: "客户端 ID",
    help: "用于填写 Client ID / 应用客户端标识。",
  },
  clientSecret: {
    label: "客户端密钥",
    help: "用于填写 Client Secret / 应用密钥。该值会在本地控制台中直接显示，便于查看和修改。",
  },
  knowledgeBaseSync: {
    label: "账号知识库同步",
    help: "仅为当前账号配置知识库同步目标和范围；未填写时继承上层默认值。",
  },
  "knowledgeBaseSync.enabled": {
    label: "启用知识库同步",
  },
  "knowledgeBaseSync.operatorId": {
    label: "操作人 ID",
    help: "当前账号使用的钉钉知识库操作人标识，通常填写具备读取权限的 UnionId 或兼容 ID。",
  },
  "knowledgeBaseSync.targetAgentId": {
    label: "目标 Agent",
    help: "把当前账号同步到哪个 agent 工作区；未填写时继承上层设置。",
  },
  "knowledgeBaseSync.workspaceIds": {
    label: "知识库 ID 列表",
    help: "仅同步指定知识库；留空时按可见范围或默认上限同步。",
  },
  "knowledgeBaseSync.maxWorkspaces": {
    label: "最大知识库数量",
    help: "未指定 workspaceIds 时，最多同步多少个可见知识库。",
  },
  "knowledgeBaseSync.maxNodesPerWorkspace": {
    label: "单库最大节点数",
    help: "限制当前账号下每个知识库递归遍历的节点数量。",
  },
  operatorId: {
    label: "操作人 ID",
    help: "当前账号使用的钉钉知识库操作人标识，通常填写具备读取权限的 UnionId 或兼容 ID。",
  },
  targetAgentId: {
    label: "目标 Agent",
    help: "把当前账号同步到哪个 agent 工作区；未填写时继承上层设置。",
  },
  workspaceIds: {
    label: "知识库 ID 列表",
    help: "仅同步指定知识库；留空时按可见范围或默认上限同步。",
  },
  maxWorkspaces: {
    label: "最大知识库数量",
    help: "未指定 workspaceIds 时，最多同步多少个可见知识库。",
  },
  maxNodesPerWorkspace: {
    label: "单库最大节点数",
    help: "限制当前账号下每个知识库递归遍历的节点数量。",
  },
  allowFrom: {
    label: "允许来源",
    help: "限制当前账号允许哪些用户、来源或会话触发机器人。通常用于白名单或配对场景；留空时一般表示不单独限制，继续继承上层规则。",
  },
  groupAllowFrom: {
    label: "群聊允许列表",
    help: "只有当群聊策略为“白名单”时，这里才会生效。可填写允许触发机器人的群 ID、群标签、员工号，或 * 表示全部允许。点击添加后，每一行填写一个值即可。",
  },
  dmPolicy: {
    label: "账号私信策略",
    help: "仅覆盖当前账号的私信接入策略，控制这个账号下的私聊是否允许触发机器人；未填写时继承上层设置。",
  },
  groupPolicy: {
    label: "账号群聊策略",
    help: "仅覆盖当前账号的群聊接入策略，控制这个账号下的群消息是否允许触发机器人；未填写时继承上层设置。",
  },
  agentId: { label: "账号 Agent ID" },
  robotCode: { label: "账号机器人编码" },
  tenantId: { label: "账号租户 ID" },
  dmHistoryLimit: {
    label: "账号私信上下文条数",
    help: "仅限制当前账号下私信会话的历史上下文数量。",
  },
  textChunkLimit: {
    label: "账号文本分片上限",
    help: "仅控制当前账号发送长文本时的拆分长度上限。",
  },
  typingIndicator: {
    label: "账号输入中提示",
    help: "仅控制当前账号回复前是否显示“正在输入 / 正在处理”状态。",
  },
  systemPrompt: {
    label: "账号系统提示词",
    help: "仅为当前账号追加固定提示词；未填写时继承上层设置。",
  },
  tools: {
    label: "账号可用工具",
    help: "仅限制当前账号允许调用的工具集合。",
  },
});

const CHANNEL_ENTITY_OVERRIDES = createScopedOverrides(CHANNEL_ENTITY_SCOPE_PREFIXES, {
  requireMention: {
    label: "必须 @ 机器人",
    help: "开启后，群聊或会话中只有明确提及机器人时才会触发处理。",
  },
  resolveSenderNames: {
    label: "解析发送者名称",
    help: "将发送者 ID 尽量解析成可读名称，便于日志、上下文和调试展示。",
  },
  separateSessionByConversation: {
    label: "按会话分别建上下文",
    help: "不同群、私聊或线程分别维护独立会话，上下文不会混在一起。",
  },
  sharedMemoryAcrossConversations: {
    label: "跨会话共享记忆",
    help: "允许同一接入下的多个会话共享长期记忆；关闭后，每个会话只使用自己的记忆。",
  },
  systemPrompt: {
    label: "会话系统提示词",
    help: "仅为当前群组、会话或容器追加固定提示词。",
  },
  textChunkLimit: {
    label: "会话文本分片上限",
    help: "仅控制当前群组、会话或容器发送长文本时的拆分长度上限。",
  },
  typingIndicator: {
    label: "会话输入中提示",
    help: "仅控制当前群组、会话或容器回复前是否显示“正在输入 / 正在处理”状态。",
  },
  tools: {
    label: "会话可用工具",
    help: "仅限制当前群组、会话或容器允许调用的工具集合。",
  },
});

const GENERIC_NESTED_FIELD_OVERRIDES: Record<string, ConfigHintOverride> = {
  "**.requireMention": {
    label: "必须 @ 机器人",
    help: "开启后，只有明确提及机器人时才会触发处理。",
  },
  "**.resolveSenderNames": {
    label: "解析发送者名称",
    help: "将发送者 ID 尽量解析成可读名称，便于查看日志、上下文和调试信息。",
  },
  "**.separateSessionByConversation": {
    label: "按会话分别建上下文",
    help: "不同群、私聊或线程分别维护独立上下文，避免消息串到别的会话。",
  },
  "**.sharedMemoryAcrossConversations": {
    label: "跨会话共享记忆",
    help: "允许多个会话共享长期记忆；关闭后，每个会话只保留自己的记忆。",
  },
};

const ZH_CONFIG_HINT_OVERRIDES: Record<string, ConfigHintOverride> = {
  "agents.defaults": {
    label: "默认代理设置",
    help: "统一设置代理默认的工作区、模型、记忆和压缩策略。",
  },
  "agents.list": {
    label: "代理列表",
    help: "管理显式定义的代理条目及其独立覆盖配置。",
  },
  "agents.defaults.workspace": { label: "默认工作区" },
  "agents.defaults.model": {
    label: "默认模型路由",
    help: "设置代理默认使用哪个主模型，以及主模型失败后的回退顺序。",
  },
  "agents.defaults.model.primary": {
    label: "主模型",
    help: "默认主模型引用，通常填写 provider/modelId。",
  },
  "agents.defaults.model.fallbacks": {
    label: "回退模型",
    help: "按顺序填写备用模型；主模型不可用时会依次尝试。",
  },
  "agents.defaults.models": {
    label: "模型覆盖目录",
    help: "按模型引用维护参数覆盖，而不是重新定义模型目录。",
  },
  "agents.defaults.models.*": {
    label: "模型覆盖",
    help: "按模型引用覆盖默认参数。",
  },
  "agents.defaults.models.*.params": { label: "覆盖参数" },
  "agents.defaults.models.*.params.reasoningEffort": {
    label: "推理强度",
    help: "仅覆盖当前模型的 reasoningEffort。",
  },
  "agents.defaults.memorySearch": { label: "默认记忆检索" },
  "agents.defaults.compaction": { label: "上下文压缩" },
  "agents.defaults.embeddedPi": { label: "嵌入式 Pi 运行器" },
  "agents.defaults.thinkingDefault": {
    label: "默认推理强度",
    help: "未单独覆盖时，代理默认使用的 reasoningEffort。",
  },

  "models.providers": {
    label: "模型提供商",
    help: "按提供商维护模型连接、鉴权和模型定义。",
  },
  "models.mode": {
    label: "模型合并模式",
    help: "控制本地模型目录与其他来源如何合并。",
  },
  "models.providers.*.baseUrl": { label: "接口地址" },
  "models.providers.*.apiKey": { label: "API 密钥" },
  "models.providers.*.api": { label: "API 协议" },
  "models.providers.*.models": {
    label: "模型列表",
    help: "维护当前提供商下可用的模型目录。",
  },
  "models.providers.*.models.id": { label: "模型 ID" },
  "models.providers.*.models.name": { label: "显示名称" },
  "models.providers.*.models.reasoning": { label: "支持推理" },
  "models.providers.*.models.input": { label: "输入类型" },
  "models.providers.*.models.contextWindow": { label: "上下文窗口" },
  "models.providers.*.models.maxTokens": { label: "最大输出" },
  "models.providers.*.models.cost": { label: "成本" },
  "models.providers.*.models.cost.input": { label: "输入成本" },
  "models.providers.*.models.cost.output": { label: "输出成本" },
  "models.providers.*.models.cost.cacheRead": { label: "缓存读取成本" },
  "models.providers.*.models.cost.cacheWrite": { label: "缓存写入成本" },
  "models.bedrockDiscovery": {
    label: "Bedrock 自动发现",
    help: "自动同步 AWS Bedrock 可见模型与默认参数。",
  },

  "skills.load.watch": { label: "监听技能文件" },
  "skills.load.watchDebounceMs": { label: "技能监听防抖 (ms)" },

  "tools.allow": { label: "工具允许列表" },
  "tools.deny": { label: "工具拒绝列表" },
  "tools.web": {
    label: "Web 工具",
    help: "管理网页搜索、抓取与相关限制。",
  },
  "tools.exec": {
    label: "执行工具",
    help: "管理命令执行的位置、权限和审批方式；这是影响安全边界的关键配置。",
  },
  "tools.profile": { label: "工具配置档" },
  "tools.alsoAllow": { label: "附加允许工具" },
  "tools.byProvider": { label: "按提供商设定工具策略" },
  "tools.loopDetection": { label: "工具循环检测" },
  "tools.fs.workspaceOnly": { label: "仅允许工作区文件系统" },
  "tools.sessions.visibility": { label: "会话工具可见性" },
  "tools.exec.host": { label: "执行宿主" },
  "tools.exec.security": { label: "执行安全级别" },
  "tools.exec.ask": { label: "执行审批策略" },
  "tools.exec.node": { label: "执行节点绑定" },
  "tools.exec.applyPatch": {
    label: "apply_patch",
    help: "控制哪些模型允许直接修改文件。",
  },
  "tools.exec.applyPatch.allowModels": {
    label: "允许 apply_patch 的模型",
    help: "支持填写 provider/modelId，也可以填写可唯一匹配的模型 ID。",
  },
  "tools.agentToAgent": {
    label: "代理间调用",
    help: "控制一个代理是否可以调用另一个代理。",
  },
  "tools.elevated": {
    label: "高权限工具",
    help: "限制只有受信来源才能使用的高风险工具。",
  },
  "tools.subagents": { label: "子代理工具策略" },
  "tools.sandbox": { label: "沙箱工具策略" },

  "session.identityLinks": { label: "身份关联" },
  "session.reset": {
    label: "会话重置策略",
    help: "定义什么时候清空上下文、重新开始新会话，避免历史消息长期影响回复。",
  },
  "session.resetByType": { label: "按会话类型重置" },
  "session.resetByChannel": { label: "按频道重置" },
  "session.store": { label: "会话存储" },
  "session.sendPolicy": { label: "发送策略" },
  "session.agentToAgent": { label: "代理间会话策略" },

  "channels.defaults": {
    label: "频道默认设置",
    help: "统一定义各消息渠道的基础行为；大多数频道如果没有单独覆盖，会继承这里的设置。",
  },
  "channels.whatsapp": { label: "WhatsApp" },
  "channels.telegram": { label: "Telegram" },
  "channels.discord": { label: "Discord" },
  "channels.slack": { label: "Slack" },
  "channels.mattermost": { label: "Mattermost" },
  "channels.signal": { label: "Signal" },
  "channels.imessage": { label: "iMessage" },
  "channels.bluebubbles": { label: "BlueBubbles" },
  "channels.msteams": { label: "Microsoft Teams" },
  "channels.modelByChannel": { label: "按频道指定模型" },
  ...CHANNEL_ROOT_OVERRIDES,
  ...CHANNEL_ACCOUNT_OVERRIDES,
  ...CHANNEL_ENTITY_OVERRIDES,
  ...GENERIC_NESTED_FIELD_OVERRIDES,

  "messages.messagePrefix": { label: "入站消息前缀" },
  "messages.responsePrefix": { label: "回复前缀" },
  "messages.groupChat": {
    label: "群聊处理",
    help: "设置群聊触发方式、上下文窗口和提及规则。",
  },
  "messages.queue": {
    label: "消息队列",
    help: "管理高频消息的缓冲、合并与削峰策略。",
  },
  "messages.inbound": { label: "入站防抖" },
  "messages.statusReactions": { label: "状态反应" },
  "messages.tts": { label: "语音播报" },
  "messages.suppressToolErrors": { label: "隐藏工具错误提示" },

  "broadcast.strategy": { label: "广播策略" },
  "broadcast.*": { label: "广播目标列表" },

  "talk.provider": { label: "语音提供商" },
  "talk.providers": {
    label: "语音提供商配置",
    help: "按提供商维护语音模型、声音和密钥设置。",
  },
  "talk.voiceId": { label: "默认声音 ID" },
  "talk.modelId": { label: "语音模型 ID" },
  "talk.outputFormat": { label: "输出格式" },
  "talk.interruptOnSpeech": { label: "用户说话时打断" },
  "talk.silenceTimeoutMs": { label: "静默超时 (ms)" },

  "audio.transcription": {
    label: "音频转写",
    help: "配置外部转写命令与超时限制。",
  },
  "audio.transcription.command": { label: "转写命令" },
  "audio.transcription.timeoutSeconds": { label: "转写超时 (秒)" },

  "commands.native": { label: "原生命令" },
  "commands.nativeSkills": { label: "原生技能命令" },
  "commands.text": { label: "文本命令" },
  "commands.bash": { label: "Bash 命令" },
  "commands.config": { label: "配置命令" },
  "commands.mcp": { label: "MCP 命令" },
  "commands.plugins": { label: "插件命令" },
  "commands.debug": { label: "调试命令" },
  "commands.restart": { label: "重启命令" },
  "commands.useAccessGroups": { label: "使用访问组控制命令" },
  "commands.ownerAllowFrom": { label: "所有者允许来源" },
  "commands.allowFrom": { label: "命令允许来源" },

  "hooks.enabled": { label: "启用 Webhook" },
  "hooks.path": { label: "Webhook 路径" },
  "hooks.token": { label: "Webhook 令牌" },
  "hooks.defaultSessionKey": { label: "默认会话键" },
  "hooks.allowRequestSessionKey": { label: "允许请求指定会话键" },
  "hooks.allowedSessionKeyPrefixes": { label: "允许的会话键前缀" },
  "hooks.allowedAgentIds": { label: "允许的代理 ID" },
  "hooks.maxBodyBytes": { label: "最大请求体字节数" },
  "hooks.presets": { label: "预设" },
  "hooks.transformsDir": { label: "转换脚本目录" },
  "hooks.mappings": {
    label: "映射规则",
    help: "定义 Webhook 请求如何匹配并路由到唤醒或代理动作。",
  },
  "hooks.gmail": {
    label: "Gmail 集成",
    help: "配置 Gmail 推送监听、标签过滤和模型处理。",
  },

  "bindings.type": { label: "绑定类型" },
  "bindings.agentId": { label: "代理 ID" },
  "bindings.match": { label: "匹配条件" },
  "bindings.acp": { label: "ACP 设置" },

  "cron.enabled": { label: "启用定时任务" },
  "cron.store": { label: "定时任务存储" },
  "cron.maxConcurrentRuns": { label: "最大并发运行数" },
  "cron.retry": { label: "重试策略" },
  "cron.webhookToken": { label: "Webhook 令牌" },
  "cron.sessionRetention": { label: "会话保留策略" },
  "cron.runLog": { label: "运行日志" },

  "plugins.enabled": { label: "启用插件" },
  "plugins.allow": { label: "插件允许列表" },
  "plugins.deny": { label: "插件拒绝列表" },
  "plugins.load": {
    label: "插件加载",
    help: "设置插件扫描路径和加载来源。",
  },
  "plugins.load.paths": { label: "插件路径" },
  "plugins.slots": { label: "插件插槽" },
  "plugins.slots.contextEngine": { label: "上下文引擎插件" },
  "plugins.entries": { label: "插件条目" },
  "plugins.entries.dingtalk-enterprise": {
    label: "钉钉企业插件",
    help: "管理钉钉企业接入的插件级配置。当前运行时仍在补齐中，先在这里收敛接入参数。",
  },
  "plugins.installs": { label: "安装记录" },

  "gateway.port": { label: "网关端口" },
  "gateway.mode": { label: "网关模式" },
  "gateway.bind": { label: "绑定模式" },
  "gateway.customBindHost": { label: "自定义绑定主机" },
  "gateway.controlUi": {
    label: "控制台界面",
    help: "控制配置页面、管理界面与可访问来源，建议优先在这里完成可视化设置。",
  },
  "gateway.auth": {
    label: "网关认证",
    help: "配置网关访问认证方式、令牌/密码和代理鉴权规则。",
  },
  "gateway.trustedProxies": { label: "受信代理列表" },
  "gateway.tools": { label: "网关工具策略" },
  "gateway.tailscale": {
    label: "Tailscale",
    help: "通过 Tailscale 暴露网关时的模式与退出行为。",
  },
  "gateway.remote": {
    label: "远程网关",
    help: "通过直连或 SSH 连接远程网关主机。",
  },
  "gateway.reload": { label: "配置热重载" },
  "gateway.tls": { label: "TLS" },
  "gateway.http": { label: "HTTP API" },
  "gateway.push": { label: "推送投递" },

  "web.enabled": { label: "启用 Web 频道" },
  "web.heartbeatSeconds": { label: "心跳间隔 (秒)" },
  "web.reconnect": {
    label: "重连策略",
    help: "控制 Web 频道断开后的退避和重试行为。",
  },

  "browser.enabled": { label: "启用浏览器能力" },
  "browser.cdpUrl": { label: "CDP URL" },
  "browser.executablePath": { label: "浏览器可执行文件路径" },
  "browser.headless": { label: "无头模式" },
  "browser.noSandbox": { label: "无沙箱模式" },
  "browser.attachOnly": { label: "仅附加模式" },
  "browser.defaultProfile": { label: "默认配置档" },
  "browser.profiles": {
    label: "浏览器配置档",
    help: "按名称维护不同浏览器实例的端口、URL 和用户目录。",
  },
  "browser.evaluateEnabled": { label: "启用页面脚本执行" },
  "browser.snapshotDefaults": { label: "快照默认设置" },
  "browser.ssrfPolicy": {
    label: "SSRF 防护策略",
    help: "限制浏览器和抓取能力访问内网或危险主机。",
  },

  "nodeHost.browserProxy": {
    label: "节点浏览器代理",
    help: "通过节点网络暴露本机浏览器控制能力。",
  },

  "canvasHost.enabled": { label: "启用画布宿主" },
  "canvasHost.root": { label: "画布根目录" },
  "canvasHost.port": { label: "画布端口" },
  "canvasHost.liveReload": { label: "实时刷新" },

  "discovery.wideArea": {
    label: "广域发现",
    help: "配置跨网段或跨域的发现能力。",
  },
  "discovery.mdns": { label: "mDNS 发现" },

  "media.preserveFilenames": { label: "保留原文件名" },
  "media.ttlHours": { label: "媒体保留时长 (小时)" },

  "ui.seamColor": { label: "界面强调色" },
  "ui.assistant": {
    label: "助手展示信息",
    help: "设置控制台中显示的助手名称与头像。",
  },
  "ui.assistant.name": { label: "助手名称" },
  "ui.assistant.avatar": { label: "助手头像" },

  "wizard.lastRunAt": { label: "上次向导运行时间" },
  "wizard.lastRunVersion": { label: "上次向导版本" },
  "wizard.lastRunCommand": { label: "上次向导命令" },
  "wizard.lastRunMode": { label: "上次向导模式" },
};

const LABEL_REPLACEMENTS: Array<[string, string]> = [
  ["Require Mention", "必须 @ 机器人"],
  ["Resolve Sender Names", "解析发送者名称"],
  ["Separate Session By Conversation", "按会话分别建上下文"],
  ["Shared Memory Across Conversations", "跨会话共享记忆"],
  ["Control UI", "控制台界面"],
  ["Rate Limit", "速率限制"],
  ["Allowlist", "允许列表"],
  ["Denylist", "拒绝列表"],
  ["Tailscale", "Tailscale"],
  ["Webhook", "Webhook"],
  ["OpenTelemetry", "OpenTelemetry"],
  ["No-Sandbox", "无沙箱"],
  ["Attach-only", "仅附加"],
  ["Workspace-only", "仅工作区"],
  ["Agent-to-Agent", "代理间"],
  ["Live Reload", "实时刷新"],
  ["Default Profile", "默认配置档"],
  ["Profiles", "配置档"],
  ["Profile", "配置档"],
  ["Gateway", "网关"],
  ["Browser", "浏览器"],
  ["Channels", "频道"],
  ["Channel", "频道"],
  ["Messages", "消息"],
  ["Message", "消息"],
  ["Agents", "代理"],
  ["Agent", "代理"],
  ["Skills", "技能"],
  ["Skill", "技能"],
  ["Models", "模型"],
  ["Model", "模型"],
  ["Plugins", "插件"],
  ["Plugin", "插件"],
  ["Commands", "命令"],
  ["Command", "命令"],
  ["Hooks", "钩子"],
  ["Bindings", "绑定"],
  ["Binding", "绑定"],
  ["Sessions", "会话"],
  ["Session", "会话"],
  ["Policy", "策略"],
  ["Mode", "模式"],
  ["Enabled", "启用"],
  ["Enable ", "启用"],
  ["Default", "默认"],
  ["Path", "路径"],
  ["Root", "根目录"],
  ["Host", "主机"],
  ["Port", "端口"],
  ["Color", "颜色"],
  ["Token", "令牌"],
  ["Password", "密码"],
  ["Timeout", "超时"],
  ["Interval", "间隔"],
  ["Retry", "重试"],
  ["Reconnect", "重连"],
  ["Store", "存储"],
  ["Discovery", "发现"],
  ["Media", "媒体"],
  ["Assistant", "助手"],
  ["Avatar", "头像"],
  ["Names", "名称"],
  ["Name", "名称"],
  ["Voice", "语音"],
  ["Output Format", "输出格式"],
  ["Heartbeat", "心跳"],
  ["Security", "安全"],
  ["Strict", "严格"],
  ["HTTP API", "HTTP API"],
  ["TLS", "TLS"],
  ["URL", "URL"],
  ["CDP", "CDP"],
  ["File", "文件"],
];

const POLICY_VALUE_REPLACEMENTS: Record<string, string> = {
  open: "开放",
  allowlist: "白名单",
  pairing: "配对后允许",
  disabled: "禁用",
};

const POLICY_VALUE_PATH_SUFFIXES = ["dmPolicy", "groupPolicy"] as const;
const SCOPE_VALUE_REPLACEMENTS: Record<string, string> = {
  main: "主会话",
  "shared-main": "主会话",
  "per-peer": "按发送者单独分会话",
  "per-sender": "按发送者单独分会话",
  "per-channel-peer": "按频道 + 发送者分会话",
  "per-channel-sender": "按频道 + 发送者分会话",
  "per-account-channel-peer": "按账号 + 频道 + 发送者分会话",
  "per-account-channel-sender": "按账号 + 频道 + 发送者分会话",
};
const SCOPE_VALUE_PATH_SUFFIXES = ["groupSessionScope", "dmScope", "sessionScopeSummary"] as const;

function isChineseLocale(): boolean {
  return i18n.getLocale().startsWith("zh");
}

function containsChineseText(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text);
}

function matchesOverridePath(pattern: string, actualPath: string): boolean {
  if (pattern.startsWith("**.")) {
    const suffix = pattern.slice(3);
    return actualPath === suffix || actualPath.endsWith(`.${suffix}`);
  }
  if (!pattern.includes("*")) {
    return pattern === actualPath;
  }
  const patternSegments = pattern.split(".");
  const actualSegments = actualPath.split(".");
  if (patternSegments.length !== actualSegments.length) {
    return false;
  }
  for (let index = 0; index < patternSegments.length; index += 1) {
    if (patternSegments[index] !== "*" && patternSegments[index] !== actualSegments[index]) {
      return false;
    }
  }
  return true;
}

function resolveConfigHintOverride(path?: string): ConfigHintOverride | undefined {
  if (!path) {
    return undefined;
  }
  const direct = ZH_CONFIG_HINT_OVERRIDES[path];
  if (direct) {
    return direct;
  }
  for (const [overridePath, override] of Object.entries(ZH_CONFIG_HINT_OVERRIDES)) {
    if (!overridePath.includes("*")) {
      continue;
    }
    if (matchesOverridePath(overridePath, path)) {
      return override;
    }
  }
  return undefined;
}

function applyLabelReplacements(label: string): string {
  let next = label;
  for (const [from, to] of LABEL_REPLACEMENTS) {
    next = next.replaceAll(from, to);
  }
  return next.replace(/\s+/g, " ").trim();
}

export function localizeConfigHint(params: {
  actualPath: string;
  matchKey?: string;
  hint: ConfigUiHint;
}): ConfigUiHint {
  if (!isChineseLocale()) {
    return params.hint;
  }
  const override = resolveConfigHintOverride(params.actualPath) ?? resolveConfigHintOverride(params.matchKey);
  return {
    ...params.hint,
    label: override?.label ?? (params.hint.label ? applyLabelReplacements(params.hint.label) : undefined),
    help:
      override?.help ??
      (params.hint.help && containsChineseText(params.hint.help) ? params.hint.help : undefined),
    placeholder: override?.placeholder ?? params.hint.placeholder,
  };
}

export function localizeConfigLabel(label: string, path?: string): string {
  if (!isChineseLocale()) {
    return label;
  }
  const override = resolveConfigHintOverride(path);
  return override?.label ?? applyLabelReplacements(label);
}

export function localizeConfigHelp(help: string | undefined, path?: string): string | undefined {
  if (!isChineseLocale()) {
    return help;
  }
  const override = resolveConfigHintOverride(path);
  if (override?.help) {
    return override.help;
  }
  if (!help) {
    return undefined;
  }
  return containsChineseText(help) ? help : help;
}

export function localizeConfigChoice(choice: string, path?: string): string {
  if (!isChineseLocale()) {
    return choice;
  }
  const normalizedPath = path ?? "";
  const shouldTranslatePolicyValue = POLICY_VALUE_PATH_SUFFIXES.some(
    (suffix) => normalizedPath === suffix || normalizedPath.endsWith(`.${suffix}`),
  );
  if (shouldTranslatePolicyValue) {
    return POLICY_VALUE_REPLACEMENTS[choice] ?? choice;
  }
  const shouldTranslateScopeValue = SCOPE_VALUE_PATH_SUFFIXES.some(
    (suffix) => normalizedPath === suffix || normalizedPath.endsWith(`.${suffix}`),
  );
  if (shouldTranslateScopeValue) {
    return SCOPE_VALUE_REPLACEMENTS[choice] ?? choice;
  }
  return choice;
}
