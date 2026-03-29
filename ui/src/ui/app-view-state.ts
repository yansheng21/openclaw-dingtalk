import type { EventLogEntry } from "./app-events.ts";
import type { CompactionStatus, FallbackStatus } from "./app-tool-stream.ts";
import type { CronModelSuggestionsState, CronState } from "./controllers/cron.ts";
import type { DevicePairingList } from "./controllers/devices.ts";
import type { ExecApprovalRequest } from "./controllers/exec-approval.ts";
import type { ExecApprovalsFile, ExecApprovalsSnapshot } from "./controllers/exec-approvals.ts";
import type { SkillMessage } from "./controllers/skills.ts";
import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway.ts";
import type { Tab } from "./navigation.ts";
import type { UiSettings } from "./storage.ts";
import type { ThemeTransitionContext } from "./theme-transition.ts";
import type { ResolvedTheme, ThemeMode, ThemeName } from "./theme.ts";
import type {
  AgentsListResult,
  AgentsFilesListResult,
  AgentIdentityResult,
  AttentionItem,
  ChannelsStatusSnapshot,
  ConfigSnapshot,
  ConfigUiHints,
  HealthSummary,
  LogEntry,
  LogLevel,
  ChatModelOverride,
  ModelCatalogEntry,
  NostrProfile,
  PresenceEntry,
  SessionsUsageResult,
  CostUsageSummary,
  SessionUsageTimeSeries,
  SessionsListResult,
  SkillStatusReport,
  StatusSummary,
  ToolsCatalogResult,
} from "./types.ts";
import type { ChatAttachment, ChatQueueItem } from "./ui-types.ts";
import type { NostrProfileFormState } from "./views/channels.nostr-profile-form.ts";
import type { SessionLogEntry } from "./views/usage.ts";

export type AppViewState = {
  settings: UiSettings;
  password: string;
  loginShowGatewayToken: boolean;
  loginShowGatewayPassword: boolean;
  tab: Tab;
  onboarding: boolean;
  basePath: string;
  connected: boolean;
  theme: ThemeName;
  themeMode: ThemeMode;
  themeResolved: ResolvedTheme;
  themeOrder: ThemeName[];
  hello: GatewayHelloOk | null;
  lastError: string | null;
  lastErrorCode: string | null;
  eventLog: EventLogEntry[];
  assistantName: string;
  assistantAvatar: string | null;
  assistantAgentId: string | null;
  sessionKey: string;
  chatLoading: boolean;
  chatSending: boolean;
  chatMessage: string;
  chatAttachments: ChatAttachment[];
  chatMessages: unknown[];
  chatToolMessages: unknown[];
  chatStreamSegments: Array<{ text: string; ts: number }>;
  chatStream: string | null;
  chatStreamStartedAt: number | null;
  chatRunId: string | null;
  compactionStatus: CompactionStatus | null;
  fallbackStatus: FallbackStatus | null;
  chatAvatarUrl: string | null;
  chatThinkingLevel: string | null;
  chatModelOverrides: Record<string, ChatModelOverride | null>;
  chatModelsLoading: boolean;
  chatModelCatalog: ModelCatalogEntry[];
  chatQueue: ChatQueueItem[];
  chatManualRefreshInFlight: boolean;
  nodesLoading: boolean;
  nodes: Array<Record<string, unknown>>;
  chatNewMessagesBelow: boolean;
  navDrawerOpen: boolean;
  sidebarOpen: boolean;
  sidebarContent: string | null;
  sidebarError: string | null;
  splitRatio: number;
  scrollToBottom: (opts?: { smooth?: boolean }) => void;
  devicesLoading: boolean;
  devicesError: string | null;
  devicesList: DevicePairingList | null;
  execApprovalsLoading: boolean;
  execApprovalsSaving: boolean;
  execApprovalsDirty: boolean;
  execApprovalsSnapshot: ExecApprovalsSnapshot | null;
  execApprovalsForm: ExecApprovalsFile | null;
  execApprovalsSelectedAgent: string | null;
  execApprovalsTarget: "gateway" | "node";
  execApprovalsTargetNodeId: string | null;
  execApprovalQueue: ExecApprovalRequest[];
  execApprovalBusy: boolean;
  execApprovalError: string | null;
  pendingGatewayUrl: string | null;
  configLoading: boolean;
  configRaw: string;
  configRawOriginal: string;
  configValid: boolean | null;
  configIssues: unknown[];
  configSaving: boolean;
  configApplying: boolean;
  updateRunning: boolean;
  applySessionKey: string;
  configSnapshot: ConfigSnapshot | null;
  configSchema: unknown;
  configSchemaVersion: string | null;
  configSchemaLoading: boolean;
  configUiHints: ConfigUiHints;
  configForm: Record<string, unknown> | null;
  configFormOriginal: Record<string, unknown> | null;
  configFormMode: "form" | "raw";
  configSearchQuery: string;
  configActiveSection: string | null;
  configActiveSubsection: string | null;
  communicationsFormMode: "form" | "raw";
  communicationsSearchQuery: string;
  communicationsActiveSection: string | null;
  communicationsActiveSubsection: string | null;
  appearanceFormMode: "form" | "raw";
  appearanceSearchQuery: string;
  appearanceActiveSection: string | null;
  appearanceActiveSubsection: string | null;
  automationFormMode: "form" | "raw";
  automationSearchQuery: string;
  automationActiveSection: string | null;
  automationActiveSubsection: string | null;
  infrastructureFormMode: "form" | "raw";
  infrastructureSearchQuery: string;
  infrastructureActiveSection: string | null;
  infrastructureActiveSubsection: string | null;
  aiAgentsFormMode: "form" | "raw";
  aiAgentsSearchQuery: string;
  aiAgentsActiveSection: string | null;
  aiAgentsActiveSubsection: string | null;
  channelsLoading: boolean;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsError: string | null;
  channelsLastSuccess: number | null;
  dingtalkTestBusy: boolean;
  whatsappLoginMessage: string | null;
  whatsappLoginQrDataUrl: string | null;
  whatsappLoginConnected: boolean | null;
  whatsappBusy: boolean;
  nostrProfileFormState: NostrProfileFormState | null;
  nostrProfileAccountId: string | null;
  channelsPageView: import("./views/channels.types.ts").ChannelsPageView;
  channelsSelectedId: string | null;
  channelsSelectedAccountId: string | null;
  dingtalkViewMode: import("./views/channels.types.ts").DingTalkViewMode;
  channelsListSearchQuery: string;
  channelsListStatusFilter: import("./views/channels.types.ts").ChannelListStatusFilter;
  channelCreatePickerOpen: boolean;
  channelConfigEditorChannelId: string | null;
  channelsRevealedSensitivePaths: Set<string>;
  dingtalkAccountEditor: import("./views/channels.types.ts").DingTalkAccountEditorState | null;
  genericChannelAccountEditor:
    | import("./views/channels.types.ts").GenericChannelAccountEditorState
    | null;
  dingtalkPreviewLoading: boolean;
  dingtalkPreviewResult: import("./controllers/channels.ts").DingTalkPreviewResult | null;
  dingtalkPreviewPreset: import("./views/channels.types.ts").DingTalkPreviewPreset;
  configFormDirty: boolean;
  presenceLoading: boolean;
  presenceEntries: PresenceEntry[];
  presenceError: string | null;
  presenceStatus: string | null;
  agentsLoading: boolean;
  agentsList: AgentsListResult | null;
  agentsError: string | null;
  agentsSelectedId: string | null;
  toolsCatalogLoading: boolean;
  toolsCatalogError: string | null;
  toolsCatalogResult: ToolsCatalogResult | null;
  agentsPanel: "overview" | "bindings" | "files" | "tools" | "skills" | "channels" | "cron";
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFilesList: AgentsFilesListResult | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileActive: string | null;
  agentFileSaving: boolean;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkillsLoading: boolean;
  agentSkillsLoadingAgentId: string | null;
  agentSkillsError: string | null;
  agentSkillsReport: SkillStatusReport | null;
  agentSkillsAgentId: string | null;
  knowledgeOperatorDrafts: Record<string, string>;
  knowledgeOperatorSavingSourceKey: string | null;
  knowledgeOperatorSaveError: string | null;
  knowledgeDataLoading: boolean;
  knowledgeDataError: string | null;
  knowledgeDataResult: import("./controllers/knowledge.ts").KnowledgeSyncedListResult | null;
  knowledgeDataAgentId: string | null;
  knowledgeClearBusy: boolean;
  knowledgeClearAgentId: string | null;
  knowledgeClearError: string | null;
  knowledgeSyncBusy: boolean;
  knowledgeSyncAccountId: string | null;
  knowledgeSyncError: string | null;
  knowledgeSyncResult: import("./controllers/knowledge.ts").DingTalkKnowledgeBaseSyncResult | null;
  sessionsLoading: boolean;
  sessionsResult: SessionsListResult | null;
  sessionsError: string | null;
  sessionsFilterActive: string;
  sessionsFilterLimit: string;
  sessionsIncludeGlobal: boolean;
  sessionsIncludeUnknown: boolean;
  sessionsHideCron: boolean;
  sessionsSearchQuery: string;
  sessionsSortColumn: "key" | "kind" | "updated" | "tokens";
  sessionsSortDir: "asc" | "desc";
  sessionsPage: number;
  sessionsPageSize: number;
  sessionsSelectedKeys: Set<string>;
  usageLoading: boolean;
  usageResult: SessionsUsageResult | null;
  usageCostSummary: CostUsageSummary | null;
  usageError: string | null;
  usageStartDate: string;
  usageEndDate: string;
  usageSelectedSessions: string[];
  usageSelectedDays: string[];
  usageSelectedHours: number[];
  usageChartMode: "tokens" | "cost";
  usageDailyChartMode: "total" | "by-type";
  usageTimeSeriesMode: "cumulative" | "per-turn";
  usageTimeSeriesBreakdownMode: "total" | "by-type";
  usageTimeSeries: SessionUsageTimeSeries | null;
  usageTimeSeriesLoading: boolean;
  usageTimeSeriesCursorStart: number | null;
  usageTimeSeriesCursorEnd: number | null;
  usageSessionLogs: SessionLogEntry[] | null;
  usageSessionLogsLoading: boolean;
  usageSessionLogsExpanded: boolean;
  usageQuery: string;
  usageQueryDraft: string;
  usageQueryDebounceTimer: number | null;
  usageSessionSort: "tokens" | "cost" | "recent" | "messages" | "errors";
  usageSessionSortDir: "asc" | "desc";
  usageRecentSessions: string[];
  usageTimeZone: "local" | "utc";
  usageContextExpanded: boolean;
  usageHeaderPinned: boolean;
  usageSessionsTab: "all" | "recent";
  usageVisibleColumns: string[];
  usageLogFilterRoles: import("./views/usage.js").SessionLogRole[];
  usageLogFilterTools: string[];
  usageLogFilterHasTools: boolean;
  usageLogFilterQuery: string;
} & Pick<
  CronState,
  | "cronLoading"
  | "cronJobsLoadingMore"
  | "cronJobs"
  | "cronJobsTotal"
  | "cronJobsHasMore"
  | "cronJobsNextOffset"
  | "cronJobsLimit"
  | "cronJobsQuery"
  | "cronJobsEnabledFilter"
  | "cronJobsScheduleKindFilter"
  | "cronJobsLastStatusFilter"
  | "cronJobsSortBy"
  | "cronJobsSortDir"
  | "cronStatus"
  | "cronError"
  | "cronForm"
  | "cronFieldErrors"
  | "cronEditingJobId"
  | "cronRunsJobId"
  | "cronRunsLoadingMore"
  | "cronRuns"
  | "cronRunsTotal"
  | "cronRunsHasMore"
  | "cronRunsNextOffset"
  | "cronRunsLimit"
  | "cronRunsScope"
  | "cronRunsStatuses"
  | "cronRunsDeliveryStatuses"
  | "cronRunsStatusFilter"
  | "cronRunsQuery"
  | "cronRunsSortDir"
  | "cronBusy"
> &
  Pick<CronModelSuggestionsState, "cronModelSuggestions"> & {
    skillsLoading: boolean;
    skillsReport: SkillStatusReport | null;
    skillsError: string | null;
    skillsFilter: string;
    skillsPage: number;
    skillEdits: Record<string, string>;
    skillMessages: Record<string, SkillMessage>;
    skillsBusyKey: string | null;
    healthLoading: boolean;
    healthResult: HealthSummary | null;
    healthError: string | null;
    debugLoading: boolean;
    debugStatus: StatusSummary | null;
    debugHealth: HealthSummary | null;
    debugModels: ModelCatalogEntry[];
    debugHeartbeat: unknown;
    debugCallMethod: string;
    debugCallParams: string;
    debugCallResult: string | null;
    debugCallError: string | null;
    logsLoading: boolean;
    logsError: string | null;
    logsFile: string | null;
    logsEntries: LogEntry[];
    logsFilterText: string;
    logsLevelFilters: Record<LogLevel, boolean>;
    logsAutoFollow: boolean;
    logsTruncated: boolean;
    logsCursor: number | null;
    logsLastFetchAt: number | null;
    logsLimit: number;
    logsMaxBytes: number;
    logsAtBottom: boolean;
    updateAvailable: import("./types.js").UpdateAvailable | null;
    attentionItems: AttentionItem[];
    paletteOpen: boolean;
    paletteQuery: string;
    paletteActiveIndex: number;
    streamMode: boolean;
    overviewShowGatewayToken: boolean;
    overviewShowGatewayPassword: boolean;
    overviewLogLines: string[];
    overviewLogCursor: number;
    client: GatewayBrowserClient | null;
    refreshSessionsAfterChat: Set<string>;
    connect: () => void;
    setTab: (tab: Tab) => void;
    setTheme: (theme: ThemeName, context?: ThemeTransitionContext) => void;
    setThemeMode: (mode: ThemeMode, context?: ThemeTransitionContext) => void;
    setBorderRadius: (value: number) => void;
    applySettings: (next: UiSettings) => void;
    loadOverview: () => Promise<void>;
    loadAssistantIdentity: () => Promise<void>;
    loadCron: () => Promise<void>;
    handleWhatsAppStart: (force: boolean) => Promise<void>;
    handleWhatsAppWait: () => Promise<void>;
    handleWhatsAppLogout: () => Promise<void>;
    handleChannelConfigSave: () => Promise<boolean>;
    handleChannelConfigReload: () => Promise<void>;
    handleNostrProfileEdit: (accountId: string, profile: NostrProfile | null) => void;
    handleNostrProfileCancel: () => void;
    handleNostrProfileFieldChange: (field: keyof NostrProfile, value: string) => void;
    handleNostrProfileSave: () => Promise<void>;
    handleNostrProfileImport: () => Promise<void>;
    handleNostrProfileToggleAdvanced: () => void;
    isChannelSensitivePathRevealed: (path: Array<string | number>) => boolean;
    toggleChannelSensitivePathReveal: (path: Array<string | number>) => void;
    openChannelCreatePicker: () => void;
    closeChannelCreatePicker: () => void;
    startChannelCreate: (channelId: string) => void;
    openChannelConfigEditor: (channelId: string) => void;
    closeChannelConfigEditor: () => void;
    openDingTalkAccountEditor: (
      mode: import("./views/channels.types.ts").DingTalkAccountEditorMode,
      accountId?: string | null,
    ) => void;
    closeDingTalkAccountEditor: () => void;
    openGenericChannelAccountEditor: (
      channelId: string,
      mode: import("./views/channels.types.ts").GenericChannelAccountEditorMode,
      accountId?: string | null,
    ) => void;
    closeGenericChannelAccountEditor: () => void;
    updateGenericChannelAccountEditorAccountId: (value: string) => void;
    updateGenericChannelAccountEditorDefault: (value: boolean) => void;
    patchGenericChannelAccountEditor: (path: Array<string | number>, value: unknown) => void;
    updateDingTalkAccountEditorField: (
      field: keyof import("./views/channels.types.ts").DingTalkAccountEditorValues,
      value: string | boolean,
    ) => void;
    toggleDingTalkAccountEditorSensitiveField: (
      field: import("./views/channels.types.ts").DingTalkAccountEditorSensitiveField,
    ) => void;
    saveDingTalkAccountEditor: () => Promise<void>;
    deleteDingTalkAccount: (accountId: string) => Promise<void>;
    saveGenericChannelAccountEditor: () => Promise<void>;
    deleteGenericChannelAccount: (channelId: string, accountId: string) => Promise<void>;
    previewDingTalkPolicy: (
      accountId: string | null,
      preset: import("./views/channels.types.ts").DingTalkPreviewPreset,
    ) => Promise<void>;
    setDingTalkPreviewPreset: (
      preset: import("./views/channels.types.ts").DingTalkPreviewPreset,
    ) => void;
    handleExecApprovalDecision: (decision: "allow-once" | "allow-always" | "deny") => Promise<void>;
    handleGatewayUrlConfirm: () => void;
    handleGatewayUrlCancel: () => void;
    handleConfigLoad: () => Promise<void>;
    handleConfigSave: () => Promise<void>;
    handleConfigApply: () => Promise<void>;
    handleConfigFormUpdate: (path: string, value: unknown) => void;
    handleConfigFormModeChange: (mode: "form" | "raw") => void;
    handleConfigRawChange: (raw: string) => void;
    handleInstallSkill: (key: string) => Promise<void>;
    handleUpdateSkill: (key: string) => Promise<void>;
    handleToggleSkillEnabled: (key: string, enabled: boolean) => Promise<void>;
    handleUpdateSkillEdit: (key: string, value: string) => void;
    handleSaveSkillApiKey: (key: string, apiKey: string) => Promise<void>;
    handleCronToggle: (jobId: string, enabled: boolean) => Promise<void>;
    handleCronRun: (jobId: string) => Promise<void>;
    handleCronRemove: (jobId: string) => Promise<void>;
    handleCronAdd: () => Promise<void>;
    handleCronRunsLoad: (jobId: string) => Promise<void>;
    handleCronFormUpdate: (path: string, value: unknown) => void;
    handleSessionsLoad: () => Promise<void>;
    handleSessionsPatch: (key: string, patch: unknown) => Promise<void>;
    handleLoadNodes: () => Promise<void>;
    handleLoadPresence: () => Promise<void>;
    handleLoadSkills: () => Promise<void>;
    handleLoadDebug: () => Promise<void>;
    handleLoadLogs: () => Promise<void>;
    handleDebugCall: () => Promise<void>;
    handleRunUpdate: () => Promise<void>;
    setPassword: (next: string) => void;
    setChatMessage: (next: string) => void;
    handleSendChat: (messageOverride?: string, opts?: { restoreDraft?: boolean }) => Promise<void>;
    handleAbortChat: () => Promise<void>;
    removeQueuedMessage: (id: string) => void;
    handleChatScroll: (event: Event) => void;
    resetToolStream: () => void;
    resetChatScroll: () => void;
    exportLogs: (lines: string[], label: string) => void;
    handleLogsScroll: (event: Event) => void;
    handleOpenSidebar: (content: string) => void;
    handleCloseSidebar: () => void;
    handleSplitRatioChange: (ratio: number) => void;
  };
