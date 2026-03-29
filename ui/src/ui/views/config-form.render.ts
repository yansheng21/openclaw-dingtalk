import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import type { ConfigUiHints } from "../types.ts";
import { localizeConfigHelp, localizeConfigLabel } from "./config-form.i18n.ts";
import { matchesNodeSearch, parseConfigSearchQuery, renderNode } from "./config-form.node.ts";
import { hintForPath, humanize, pathKey, schemaType, type JsonSchema } from "./config-form.shared.ts";

export type ConfigFormProps = {
  schema: JsonSchema | null;
  uiHints: ConfigUiHints;
  value: Record<string, unknown> | null;
  disabled?: boolean;
  unsupportedPaths?: string[];
  searchQuery?: string;
  activeSection?: string | null;
  activeSubsection?: string | null;
  revealSensitive?: boolean;
  isSensitivePathRevealed?: (path: Array<string | number>) => boolean;
  onToggleSensitivePath?: (path: Array<string | number>) => void;
  onPatch: (path: Array<string | number>, value: unknown) => void;
};

// SVG Icons for section cards (Lucide-style)
const sectionIcons = {
  env: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="3"></circle>
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
      ></path>
    </svg>
  `,
  update: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  `,
  agents: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path
        d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"
      ></path>
      <circle cx="8" cy="14" r="1"></circle>
      <circle cx="16" cy="14" r="1"></circle>
    </svg>
  `,
  auth: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  `,
  channels: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `,
  messages: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22,6 12,13 2,6"></polyline>
    </svg>
  `,
  commands: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <polyline points="4 17 10 11 4 5"></polyline>
      <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>
  `,
  hooks: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
  `,
  skills: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
      ></polygon>
    </svg>
  `,
  tools: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
      ></path>
    </svg>
  `,
  gateway: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
      ></path>
    </svg>
  `,
  wizard: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M15 4V2"></path>
      <path d="M15 16v-2"></path>
      <path d="M8 9h2"></path>
      <path d="M20 9h2"></path>
      <path d="M17.8 11.8 19 13"></path>
      <path d="M15 9h0"></path>
      <path d="M17.8 6.2 19 5"></path>
      <path d="m3 21 9-9"></path>
      <path d="M12.2 6.2 11 5"></path>
    </svg>
  `,
  // Additional sections
  meta: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
    </svg>
  `,
  logging: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  `,
  browser: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"></circle>
      <circle cx="12" cy="12" r="4"></circle>
      <line x1="21.17" y1="8" x2="12" y2="8"></line>
      <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
      <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
    </svg>
  `,
  ui: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="3" y1="9" x2="21" y2="9"></line>
      <line x1="9" y1="21" x2="9" y2="9"></line>
    </svg>
  `,
  models: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path
        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
      ></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  `,
  bindings: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
      <line x1="6" y1="6" x2="6.01" y2="6"></line>
      <line x1="6" y1="18" x2="6.01" y2="18"></line>
    </svg>
  `,
  broadcast: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path>
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path>
      <circle cx="12" cy="12" r="2"></circle>
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path>
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path>
    </svg>
  `,
  audio: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>
  `,
  session: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  `,
  cron: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  `,
  web: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
      ></path>
    </svg>
  `,
  discovery: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  `,
  canvasHost: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  `,
  talk: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
  `,
  plugins: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2v6"></path>
      <path d="m4.93 10.93 4.24 4.24"></path>
      <path d="M2 12h6"></path>
      <path d="m4.93 13.07 4.24-4.24"></path>
      <path d="M12 22v-6"></path>
      <path d="m19.07 13.07-4.24-4.24"></path>
      <path d="M22 12h-6"></path>
      <path d="m19.07 10.93-4.24 4.24"></path>
    </svg>
  `,
  default: html`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  `,
};

const SECTION_META_KEYS: Record<string, { labelKey: string; descriptionKey: string }> = {
  env: {
    labelKey: "configPage.sections.env.label",
    descriptionKey: "configPage.sections.env.description",
  },
  update: {
    labelKey: "configPage.sections.update.label",
    descriptionKey: "configPage.sections.update.description",
  },
  agents: {
    labelKey: "configPage.sections.agents.label",
    descriptionKey: "configPage.sections.agents.description",
  },
  auth: {
    labelKey: "configPage.sections.auth.label",
    descriptionKey: "configPage.sections.auth.description",
  },
  channels: {
    labelKey: "configPage.sections.channels.label",
    descriptionKey: "configPage.sections.channels.description",
  },
  messages: {
    labelKey: "configPage.sections.messages.label",
    descriptionKey: "configPage.sections.messages.description",
  },
  commands: {
    labelKey: "configPage.sections.commands.label",
    descriptionKey: "configPage.sections.commands.description",
  },
  hooks: {
    labelKey: "configPage.sections.hooks.label",
    descriptionKey: "configPage.sections.hooks.description",
  },
  skills: {
    labelKey: "configPage.sections.skills.label",
    descriptionKey: "configPage.sections.skills.description",
  },
  tools: {
    labelKey: "configPage.sections.tools.label",
    descriptionKey: "configPage.sections.tools.description",
  },
  gateway: {
    labelKey: "configPage.sections.gateway.label",
    descriptionKey: "configPage.sections.gateway.description",
  },
  wizard: {
    labelKey: "configPage.sections.wizard.label",
    descriptionKey: "configPage.sections.wizard.description",
  },
  meta: {
    labelKey: "configPage.sections.meta.label",
    descriptionKey: "configPage.sections.meta.description",
  },
  logging: {
    labelKey: "configPage.sections.logging.label",
    descriptionKey: "configPage.sections.logging.description",
  },
  browser: {
    labelKey: "configPage.sections.browser.label",
    descriptionKey: "configPage.sections.browser.description",
  },
  ui: {
    labelKey: "configPage.sections.ui.label",
    descriptionKey: "configPage.sections.ui.description",
  },
  models: {
    labelKey: "configPage.sections.models.label",
    descriptionKey: "configPage.sections.models.description",
  },
  bindings: {
    labelKey: "configPage.sections.bindings.label",
    descriptionKey: "configPage.sections.bindings.description",
  },
  broadcast: {
    labelKey: "configPage.sections.broadcast.label",
    descriptionKey: "configPage.sections.broadcast.description",
  },
  audio: {
    labelKey: "configPage.sections.audio.label",
    descriptionKey: "configPage.sections.audio.description",
  },
  session: {
    labelKey: "configPage.sections.session.label",
    descriptionKey: "configPage.sections.session.description",
  },
  cron: {
    labelKey: "configPage.sections.cron.label",
    descriptionKey: "configPage.sections.cron.description",
  },
  web: {
    labelKey: "configPage.sections.web.label",
    descriptionKey: "configPage.sections.web.description",
  },
  discovery: {
    labelKey: "configPage.sections.discovery.label",
    descriptionKey: "configPage.sections.discovery.description",
  },
  canvasHost: {
    labelKey: "configPage.sections.canvasHost.label",
    descriptionKey: "configPage.sections.canvasHost.description",
  },
  talk: {
    labelKey: "configPage.sections.talk.label",
    descriptionKey: "configPage.sections.talk.description",
  },
  plugins: {
    labelKey: "configPage.sections.plugins.label",
    descriptionKey: "configPage.sections.plugins.description",
  },
  memory: {
    labelKey: "configPage.sections.memory.label",
    descriptionKey: "configPage.sections.memory.description",
  },
  approvals: {
    labelKey: "configPage.sections.approvals.label",
    descriptionKey: "configPage.sections.approvals.description",
  },
  nodeHost: {
    labelKey: "configPage.sections.nodeHost.label",
    descriptionKey: "configPage.sections.nodeHost.description",
  },
  media: {
    labelKey: "configPage.sections.media.label",
    descriptionKey: "configPage.sections.media.description",
  },
  appearancePanel: {
    labelKey: "configPage.sections.appearancePanel.label",
    descriptionKey: "configPage.sections.appearancePanel.description",
  },
};

type SectionGroupMeta = {
  key: string;
  title: string;
  description: string;
};

const SECTION_GROUP_META: Record<string, Array<SectionGroupMeta>> = {
  gateway: [
    {
      key: "access",
      title: t("configForm.groups.gateway.access.title"),
      description: t("configForm.groups.gateway.access.description"),
    },
    {
      key: "runtime",
      title: t("configForm.groups.gateway.runtime.title"),
      description: t("configForm.groups.gateway.runtime.description"),
    },
  ],
  channels: [
    {
      key: "defaults",
      title: t("configForm.groups.channels.defaults.title"),
      description: t("configForm.groups.channels.defaults.description"),
    },
    {
      key: "integrations",
      title: t("configForm.groups.channels.integrations.title"),
      description: t("configForm.groups.channels.integrations.description"),
    },
  ],
  session: [
    {
      key: "continuity",
      title: t("configForm.groups.session.continuity.title"),
      description: t("configForm.groups.session.continuity.description"),
    },
    {
      key: "delivery",
      title: t("configForm.groups.session.delivery.title"),
      description: t("configForm.groups.session.delivery.description"),
    },
  ],
  tools: [
    {
      key: "policy",
      title: t("configForm.groups.tools.policy.title"),
      description: t("configForm.groups.tools.policy.description"),
    },
    {
      key: "execution",
      title: t("configForm.groups.tools.execution.title"),
      description: t("configForm.groups.tools.execution.description"),
    },
  ],
};

const SECTION_GROUP_RULES: Record<string, Record<string, string>> = {
  gateway: {
    controlUi: "access",
    auth: "access",
    trustedProxies: "access",
    tailscale: "access",
    remote: "access",
    reload: "runtime",
    tls: "runtime",
    http: "runtime",
    push: "runtime",
    bind: "runtime",
    customBindHost: "runtime",
    port: "runtime",
    mode: "runtime",
  },
  channels: {
    defaults: "defaults",
    modelByChannel: "defaults",
  },
  session: {
    identityLinks: "continuity",
    reset: "continuity",
    resetByType: "continuity",
    resetByChannel: "continuity",
    store: "delivery",
    sendPolicy: "delivery",
    agentToAgent: "delivery",
  },
  tools: {
    allow: "policy",
    deny: "policy",
    profile: "policy",
    alsoAllow: "policy",
    byProvider: "policy",
    agentToAgent: "policy",
    elevated: "policy",
    subagents: "policy",
    sandbox: "policy",
    exec: "execution",
    web: "execution",
    loopDetection: "execution",
    fs: "execution",
    sessions: "execution",
  },
};

function groupSectionEntries(sectionKey: string, entries: Array<[string, JsonSchema]>) {
  const metaList = SECTION_GROUP_META[sectionKey];
  const rules = SECTION_GROUP_RULES[sectionKey];
  if (!metaList || !rules) {
    return null;
  }
  const bucketMap = new Map<string, Array<[string, JsonSchema]>>();
  const rest: Array<[string, JsonSchema]> = [];
  for (const entry of entries) {
    const bucket = rules[entry[0]];
    if (!bucket) {
      rest.push(entry);
      continue;
    }
    const list = bucketMap.get(bucket) ?? [];
    list.push(entry);
    bucketMap.set(bucket, list);
  }
  const groups = metaList
    .map((meta) => ({ ...meta, entries: bucketMap.get(meta.key) ?? [] }))
    .filter((group) => group.entries.length > 0);
  if (groups.length === 0) {
    return null;
  }
  return { groups, rest };
}

function renderSectionNode(params: {
  key: string;
  node: JsonSchema;
  value: unknown;
  props: ConfigFormProps;
  unsupported: Set<string>;
  searchCriteria: ReturnType<typeof parseConfigSearchQuery>;
  showHeader?: boolean;
}) {
  const { key, node, value, props, unsupported, searchCriteria } = params;
  const grouped =
    schemaType(node) === "object" && node.properties
      ? groupSectionEntries(key, Object.entries(node.properties))
      : null;
  const meta = getConfigSectionMeta(key, node);
  const showHeader = params.showHeader ?? true;

  const defaultContent = renderNode({
    schema: node,
    value,
    path: [key],
    hints: props.uiHints,
    unsupported,
    disabled: props.disabled ?? false,
    showLabel: false,
    searchCriteria,
    revealSensitive: props.revealSensitive ?? false,
    isSensitivePathRevealed: props.isSensitivePathRevealed,
    onToggleSensitivePath: props.onToggleSensitivePath,
    onPatch: props.onPatch,
  });

  const content =
    grouped && grouped.groups.length > 0
      ? html`
          <div class="config-section-groups">
            ${grouped.groups.map(
              (group) => html`
                <section class="config-subsection-card">
                  <div class="config-subsection-card__header">
                    <h4 class="config-subsection-card__title">${group.title}</h4>
                    <p class="config-subsection-card__desc">${group.description}</p>
                  </div>
                  <div class="config-subsection-card__content">
                    ${group.entries.map(([propKey, propNode]) =>
                      renderNode({
                        schema: propNode,
                        value:
                          value && typeof value === "object"
                            ? (value as Record<string, unknown>)[propKey]
                            : undefined,
                        path: [key, propKey],
                        hints: props.uiHints,
                        unsupported,
                        disabled: props.disabled ?? false,
                        searchCriteria,
                        revealSensitive: props.revealSensitive ?? false,
                        isSensitivePathRevealed: props.isSensitivePathRevealed,
                        onToggleSensitivePath: props.onToggleSensitivePath,
                        onPatch: props.onPatch,
                      }),
                    )}
                  </div>
                </section>
              `,
            )}
            ${
              grouped.rest.length > 0
                ? html`
                    <section class="config-subsection-card config-subsection-card--secondary">
                      <div class="config-subsection-card__header">
                        <h4 class="config-subsection-card__title">${t("configForm.groups.other.title")}</h4>
                        <p class="config-subsection-card__desc">${t("configForm.groups.other.description")}</p>
                      </div>
                      <div class="config-subsection-card__content">
                        ${grouped.rest.map(([propKey, propNode]) =>
                          renderNode({
                            schema: propNode,
                            value:
                              value && typeof value === "object"
                                ? (value as Record<string, unknown>)[propKey]
                                : undefined,
                            path: [key, propKey],
                            hints: props.uiHints,
                            unsupported,
                            disabled: props.disabled ?? false,
                            searchCriteria,
                            revealSensitive: props.revealSensitive ?? false,
                            isSensitivePathRevealed: props.isSensitivePathRevealed,
                            onToggleSensitivePath: props.onToggleSensitivePath,
                            onPatch: props.onPatch,
                          }),
                        )}
                      </div>
                    </section>
                  `
                : nothing
            }
          </div>
        `
      : defaultContent;

  return html`
    <section class="config-section-card ${showHeader ? "" : "config-section-card--focused"}" id="config-section-${key}">
      ${
        showHeader
          ? html`
              <div class="config-section-card__header">
                <span class="config-section-card__icon">${getSectionIcon(key)}</span>
                <div class="config-section-card__titles">
                  <h3 class="config-section-card__title">${meta.label}</h3>
                  ${
                    meta.description
                      ? html`<p class="config-section-card__desc">${meta.description}</p>`
                      : nothing
                  }
                </div>
              </div>
            `
          : nothing
      }
      <div class="config-section-card__content ${showHeader ? "" : "config-section-card__content--flat"}">
        ${content}
      </div>
    </section>
  `;
}

export function getConfigSectionMeta(
  key: string,
  schema?: JsonSchema,
): { label: string; description: string } {
  const meta = SECTION_META_KEYS[key];
  if (meta) {
    return {
      label: t(meta.labelKey),
      description: t(meta.descriptionKey),
    };
  }
  return {
    label: schema?.title ?? humanize(key),
    description: schema?.description ?? "",
  };
}

function getSectionIcon(key: string) {
  return sectionIcons[key as keyof typeof sectionIcons] ?? sectionIcons.default;
}

function matchesSearch(params: {
  key: string;
  schema: JsonSchema;
  sectionValue: unknown;
  uiHints: ConfigUiHints;
  query: string;
}): boolean {
  if (!params.query) {
    return true;
  }
  const criteria = parseConfigSearchQuery(params.query);
  const q = criteria.text;
  const meta = getConfigSectionMeta(params.key, params.schema);
  const sectionMetaMatches =
    q &&
    (params.key.toLowerCase().includes(q) ||
      (meta?.label ? meta.label.toLowerCase().includes(q) : false) ||
      (meta?.description ? meta.description.toLowerCase().includes(q) : false));

  if (sectionMetaMatches && criteria.tags.length === 0) {
    return true;
  }

  return matchesNodeSearch({
    schema: params.schema,
    value: params.sectionValue,
    path: [params.key],
    hints: params.uiHints,
    criteria,
  });
}

export function renderConfigForm(props: ConfigFormProps) {
  if (!props.schema) {
    return html`
      <div class="muted">${t("configForm.schemaUnavailable")}</div>
    `;
  }
  const schema = props.schema;
  const value = props.value ?? {};
  if (schemaType(schema) !== "object" || !schema.properties) {
    return html`
      <div class="callout danger">${t("configForm.unsupportedSchema")}</div>
    `;
  }
  const unsupported = new Set(props.unsupportedPaths ?? []);
  const properties = schema.properties;
  const searchQuery = props.searchQuery ?? "";
  const searchCriteria = parseConfigSearchQuery(searchQuery);
  const activeSection = props.activeSection;
  const activeSubsection = props.activeSubsection ?? null;

  const entries = Object.entries(properties).toSorted((a, b) => {
    const orderA = hintForPath([a[0]], props.uiHints)?.order ?? 50;
    const orderB = hintForPath([b[0]], props.uiHints)?.order ?? 50;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a[0].localeCompare(b[0]);
  });

  const filteredEntries = entries.filter(([key, node]) => {
    if (activeSection && key !== activeSection) {
      return false;
    }
    if (
      searchQuery &&
      !matchesSearch({
        key,
        schema: node,
        sectionValue: value[key],
        uiHints: props.uiHints,
        query: searchQuery,
      })
    ) {
      return false;
    }
    return true;
  });

  let subsectionContext: { sectionKey: string; subsectionKey: string; schema: JsonSchema } | null =
    null;
  if (activeSection && activeSubsection && filteredEntries.length === 1) {
    const sectionSchema = filteredEntries[0]?.[1];
    if (
      sectionSchema &&
      schemaType(sectionSchema) === "object" &&
      sectionSchema.properties &&
      sectionSchema.properties[activeSubsection]
    ) {
      subsectionContext = {
        sectionKey: activeSection,
        subsectionKey: activeSubsection,
        schema: sectionSchema.properties[activeSubsection],
      };
    }
  }

  if (filteredEntries.length === 0) {
    return html`
      <div class="config-empty">
        <div class="config-empty__icon">${icons.search}</div>
        <div class="config-empty__text">
          ${
            searchQuery
              ? t("configForm.noSettingsMatch", { query: searchQuery })
              : t("configForm.noSettingsInSection")
          }
        </div>
      </div>
    `;
  }

  return html`
    <div class="config-form config-form--modern">
      ${
        subsectionContext
          ? (() => {
              const { sectionKey, subsectionKey, schema: node } = subsectionContext;
              const hint = hintForPath([sectionKey, subsectionKey], props.uiHints);
              const normalizedPath = pathKey([sectionKey, subsectionKey]);
              const label = localizeConfigLabel(
                hint?.label ?? node.title ?? humanize(subsectionKey),
                normalizedPath,
              );
              const description = hint?.help ?? localizeConfigHelp(node.description, normalizedPath) ?? "";
              const sectionValue = value[sectionKey];
              const scopedValue =
                sectionValue && typeof sectionValue === "object"
                  ? (sectionValue as Record<string, unknown>)[subsectionKey]
                  : undefined;
              const id = `config-section-${sectionKey}-${subsectionKey}`;
              return html`
              <section class="config-section-card config-section-card--focused" id=${id}>
                <div class="config-section-card__content config-section-card__content--flat">
                  ${renderNode({
                    schema: node,
                    value: scopedValue,
                    path: [sectionKey, subsectionKey],
                    hints: props.uiHints,
                    unsupported,
                    disabled: props.disabled ?? false,
                    showLabel: false,
                    searchCriteria,
                    revealSensitive: props.revealSensitive ?? false,
                    isSensitivePathRevealed: props.isSensitivePathRevealed,
                    onToggleSensitivePath: props.onToggleSensitivePath,
                    onPatch: props.onPatch,
                  })}
                </div>
              </section>
            `;
            })()
          : filteredEntries.map(([key, node]) => {
              const meta = getConfigSectionMeta(key, node);

              return renderSectionNode({
                key,
                node,
                value: value[key],
                props,
                unsupported,
                searchCriteria,
                showHeader: !(activeSection && filteredEntries.length === 1),
              });
            })
      }
    </div>
  `;
}
