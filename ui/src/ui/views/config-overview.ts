import { html, type TemplateResult } from "lit";

type JsonRecord = Record<string, unknown>;

type ConfigOverviewProps = {
  value: Record<string, unknown> | null;
  onOpenSection: (section: string) => void;
};

type OverviewCard = {
  key: string;
  title: string;
  primary: string;
  meta?: string;
  rows: Array<{ label: string; value: string }>;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function countRecordEntries(value: unknown): number {
  const record = asRecord(value);
  return record ? Object.keys(record).length : 0;
}

function formatBool(value: boolean | undefined): string {
  if (value == null) {
    return "未设置";
  }
  return value ? "是" : "否";
}

function formatTime(value: unknown): string {
  const raw = asString(value);
  if (!raw) {
    return "未记录";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatAuthMode(value: unknown): string {
  const mode = asString(value);
  if (!mode) {
    return "未设置";
  }
  if (mode === "token") {
    return "令牌";
  }
  if (mode === "password") {
    return "密码";
  }
  if (mode === "none") {
    return "无认证";
  }
  return mode;
}

function formatPolicy(value: unknown): string {
  const mode = asString(value);
  if (!mode) {
    return "未设置";
  }
  if (mode === "open") {
    return "开放";
  }
  if (mode === "allowlist") {
    return "白名单";
  }
  if (mode === "pairing") {
    return "配对";
  }
  if (mode === "disabled") {
    return "关闭";
  }
  return mode;
}

function formatExecutablePath(value: unknown): string {
  const raw = asString(value);
  if (!raw) {
    return "未设置";
  }
  const parts = raw.split("/");
  return parts.at(-1) || raw;
}

function buildOverviewCards(config: Record<string, unknown> | null): OverviewCard[] {
  const root = asRecord(config);
  const models = asRecord(root?.models);
  const providers = asRecord(models?.providers) ?? {};
  const providerList = Object.entries(providers);
  const modelCount = providerList.reduce((sum, [, provider]) => {
    const entry = asRecord(provider);
    return sum + asArray(entry?.models).length;
  }, 0);
  const agentsDefaults = asRecord(asRecord(root?.agents)?.defaults);
  const modelPrimary = asString(asRecord(agentsDefaults?.model)?.primary) ?? "未设置";
  const thinkingDefault = asString(agentsDefaults?.thinkingDefault) ?? "未设置";

  const gateway = asRecord(root?.gateway);
  const browser = asRecord(root?.browser);
  const toolsExec = asRecord(asRecord(root?.tools)?.exec);
  const applyPatch = asRecord(toolsExec?.applyPatch);
  const gatewayHttpEndpoints = asRecord(asRecord(gateway?.http)?.endpoints);
  const chatCompletions = asRecord(gatewayHttpEndpoints?.chatCompletions);
  const channels = asRecord(root?.channels);
  const dingTalk = asRecord(channels?.["dingtalk-connector"]);
  const accounts = asRecord(dingTalk?.accounts);
  const accountEntries = Object.values(accounts ?? {}).filter((entry) => asRecord(entry));
  const agentsRoot = asRecord(root?.agents);
  const agentEntries = asArray(agentsRoot?.list)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => Boolean(entry));
  const explicitDefaultAgentId = asString(agentsRoot?.defaultId);
  const defaultAgentEntry =
    agentEntries.find((entry) => asBoolean(entry.default) === true) ??
    agentEntries.find((entry) => asString(entry.id) === explicitDefaultAgentId) ??
    agentEntries[0] ??
    null;
  const defaultAgentId = explicitDefaultAgentId ?? asString(defaultAgentEntry?.id) ?? "main";
  const defaultAgentLabel =
    asString(defaultAgentEntry?.name) ?? asString(defaultAgentEntry?.id) ?? defaultAgentId;
  const agentWorkspace = asString(asRecord(agentsRoot?.defaults)?.workspace);
  const bindingCount = asArray(root?.bindings).length;
  const plugins = asRecord(root?.plugins);
  const meta = asRecord(root?.meta);
  const wizard = asRecord(root?.wizard);

  return [
    {
      key: "models",
      title: "模型",
      primary: modelPrimary,
      meta: `${providerList.length} 个提供商 / ${modelCount} 个模型`,
      rows: [
        { label: "默认推理", value: thinkingDefault },
        { label: "合并模式", value: asString(models?.mode) ?? "未设置" },
        { label: "apply_patch 白名单", value: String(asArray(applyPatch?.allowModels).length) },
      ],
    },
    {
      key: "agents",
      title: "代理",
      primary: defaultAgentLabel,
      meta: `${agentEntries.length} 个 Agent / ${bindingCount} 条绑定`,
      rows: [
        { label: "默认 ID", value: defaultAgentId },
        { label: "默认工作区", value: formatExecutablePath(agentWorkspace) },
        { label: "主模型", value: modelPrimary },
      ],
    },
    {
      key: "gateway",
      title: "网关",
      primary: `${asString(gateway?.mode) ?? "未设置"} · ${asString(gateway?.bind) ?? "未设置"}`,
      meta: `端口 ${String(gateway?.port ?? "未设置")}`,
      rows: [
        { label: "认证", value: formatAuthMode(asRecord(gateway?.auth)?.mode) },
        { label: "Tailscale", value: asString(asRecord(gateway?.tailscale)?.mode) ?? "未设置" },
        {
          label: "ChatCompletions",
          value: formatBool(asBoolean(chatCompletions?.enabled)),
        },
      ],
    },
    {
      key: "browser",
      title: "浏览器",
      primary: asBoolean(browser?.enabled) ? "已启用" : "未启用",
      meta: formatExecutablePath(browser?.executablePath),
      rows: [
        { label: "默认配置档", value: asString(browser?.defaultProfile) ?? "未设置" },
        { label: "可执行文件", value: formatExecutablePath(browser?.executablePath) },
        { label: "最近向导", value: formatTime(wizard?.lastRunAt) },
      ],
    },
    {
      key: "channels",
      title: "钉钉",
      primary: `${accountEntries.length} 个账号`,
      meta: asBoolean(dingTalk?.enabled) ? "接入已启用" : "接入未启用",
      rows: [
        { label: "私聊策略", value: formatPolicy(dingTalk?.dmPolicy) },
        { label: "群聊策略", value: formatPolicy(dingTalk?.groupPolicy) },
        { label: "必须 @", value: formatBool(asBoolean(dingTalk?.requireMention)) },
      ],
    },
    {
      key: "tools",
      title: "工具",
      primary: `${asString(asRecord(root?.tools)?.profile) ?? "未设置"} · ${asString(toolsExec?.host) ?? "未设置"}`,
      meta: asString(toolsExec?.security) ?? "未设置",
      rows: [
        { label: "审批", value: asString(toolsExec?.ask) ?? "未设置" },
        { label: "apply_patch", value: formatBool(asBoolean(applyPatch?.enabled)) },
        { label: "仅工作区", value: formatBool(asBoolean(applyPatch?.workspaceOnly)) },
      ],
    },
    {
      key: "plugins",
      title: "插件",
      primary: `${asArray(plugins?.allow).length} 个允许项`,
      meta: `${countRecordEntries(plugins?.entries)} 个插件条目`,
      rows: [
        { label: "已启用", value: formatBool(asBoolean(asRecord(asRecord(plugins?.entries)?.["dingtalk-connector"])?.enabled)) },
        { label: "最近修改", value: formatTime(meta?.lastTouchedAt) },
        { label: "版本", value: asString(meta?.lastTouchedVersion) ?? "未记录" },
      ],
    },
  ];
}

function renderOverviewCard(card: OverviewCard, onOpenSection: (section: string) => void): TemplateResult {
  return html`
    <button
      type="button"
      class="config-overview-card"
      @click=${() => onOpenSection(card.key)}
    >
      <div class="config-overview-card__header">
        <div>
          <h3 class="config-overview-card__title">${card.title}</h3>
          ${card.meta ? html`<p class="config-overview-card__meta">${card.meta}</p>` : ""}
        </div>
        <span class="config-overview-card__action">进入</span>
      </div>
      <div class="config-overview-card__primary">${card.primary}</div>
      <div class="config-overview-card__rows">
        ${card.rows.map(
          (row) => html`
            <div class="config-overview-card__row">
              <span class="config-overview-card__label">${row.label}</span>
              <span class="config-overview-card__value">${row.value}</span>
            </div>
          `,
        )}
      </div>
    </button>
  `;
}

export function renderConfigOverview(props: ConfigOverviewProps) {
  const cards = buildOverviewCards(props.value);
  return html`
    <section class="config-overview">
      <div class="config-overview__hero">
        <div>
          <div class="config-overview__eyebrow">CONFIG</div>
          <h2 class="config-overview__title">配置速览</h2>
          <p class="config-overview__description">
            先看清模型、代理、网关、浏览器和渠道状态，再点进具体分区修改。
          </p>
        </div>
      </div>

      <div class="config-overview__grid">
        ${cards.map((card) => renderOverviewCard(card, props.onOpenSection))}
      </div>
    </section>
  `;
}
