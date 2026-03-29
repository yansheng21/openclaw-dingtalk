import type {
  ChannelAccountSnapshot,
  ChannelsStatusSnapshot,
  ConfigUiHints,
  DiscordStatus,
  GoogleChatStatus,
  IMessageStatus,
  NostrProfile,
  NostrStatus,
  SignalStatus,
  SlackStatus,
  TelegramStatus,
  WhatsAppStatus,
  LogEntry,
} from "../types.ts";
import type { NostrProfileFormState } from "./channels.nostr-profile-form.ts";
import type { DingTalkPreviewResult } from "../controllers/channels.ts";

export type ChannelKey = string;
export type ChannelsPageView = "list" | "detail";
export type DingTalkViewMode = "details" | "config";
export type DingTalkAccountEditorMode = "create" | "edit";
export type DingTalkAccountEditorSensitiveField = "appSecret" | "clientSecret";
export type GenericChannelAccountEditorMode = "create" | "edit";
export type ChannelListStatusFilter =
  | "all"
  | "connected"
  | "configured"
  | "pending"
  | "disabled";

export type DingTalkAccountEditorValues = {
  accountId: string;
  displayName?: string;
  name: string;
  enabled: boolean;
  appKey: string;
  appSecret: string;
  clientId: string;
  clientSecret: string;
  agentId: string;
  robotCode: string;
  tenantId: string;
  callbackBaseUrl: string;
  messageCallbackPath: string;
  cardCallbackPath: string;
  oaCallbackPath: string;
  setAsDefault: boolean;
  dmPolicy: string;
  groupPolicy: string;
  sessionScope: string;
};

export type DingTalkAccountEditorState = {
  mode: DingTalkAccountEditorMode;
  originalAccountId: string | null;
  values: DingTalkAccountEditorValues;
  saving: boolean;
  error: string | null;
  revealedSensitiveFields?: Partial<Record<DingTalkAccountEditorSensitiveField, boolean>>;
};

export type GenericChannelAccountEditorState = {
  channelId: string;
  mode: GenericChannelAccountEditorMode;
  originalAccountId: string | null;
  accountId: string;
  setAsDefault: boolean;
  values: Record<string, unknown>;
  saving: boolean;
  error: string | null;
};

export type DingTalkPreviewPreset = "direct" | "groupMention" | "oaEvent";

export type ChannelsProps = {
  connected: boolean;
  loading: boolean;
  dingtalkTesting: boolean;
  dingtalkPreviewLoading: boolean;
  dingtalkPreviewResult: DingTalkPreviewResult | null;
  dingtalkPreviewPreset: DingTalkPreviewPreset;
  snapshot: ChannelsStatusSnapshot | null;
  lastError: string | null;
  lastSuccessAt: number | null;
  whatsappMessage: string | null;
  whatsappQrDataUrl: string | null;
  whatsappConnected: boolean | null;
  whatsappBusy: boolean;
  configSchema: unknown;
  configSchemaLoading: boolean;
  configForm: Record<string, unknown> | null;
  configUiHints: ConfigUiHints;
  configSaving: boolean;
  configFormDirty: boolean;
  nostrProfileFormState: NostrProfileFormState | null;
  nostrProfileAccountId: string | null;
  pageView: ChannelsPageView;
  selectedChannelId: string | null;
  selectedChannelAccountId: string | null;
  dingtalkViewMode: DingTalkViewMode;
  listSearchQuery: string;
  listStatusFilter: ChannelListStatusFilter;
  channelCreatePickerOpen: boolean;
  channelConfigEditorChannelId: string | null;
  dingtalkAccountEditorState: DingTalkAccountEditorState | null;
  genericChannelAccountEditorState: GenericChannelAccountEditorState | null;
  logsLoading: boolean;
  logsError: string | null;
  logsFile: string | null;
  logsEntries: LogEntry[];
  logsTruncated: boolean;
  logsLastFetchAt: number | null;
  logsAutoFollow: boolean;
  isSensitivePathRevealed: (path: Array<string | number>) => boolean;
  onToggleSensitivePath: (path: Array<string | number>) => void;
  onRefresh: (probe: boolean) => void;
  onDingTalkTest: (accountId?: string | null) => void;
  onDingTalkPreview: (accountId: string | null, preset: DingTalkPreviewPreset) => void;
  onDingTalkPreviewPresetChange: (preset: DingTalkPreviewPreset) => void;
  onOpenChannelDetail: (channelId: string, accountId?: string | null) => void;
  onBackToChannelList: () => void;
  onSelectChannel: (channelId: string) => void;
  onSelectChannelAccount: (accountId: string | null) => void;
  onDingTalkViewModeChange: (mode: DingTalkViewMode) => void;
  onListSearchQueryChange: (query: string) => void;
  onListStatusFilterChange: (filter: ChannelListStatusFilter) => void;
  onOpenChannelCreatePicker: () => void;
  onCloseChannelCreatePicker: () => void;
  onStartChannelCreate: (channelId: string) => void;
  onOpenChannelConfigEditor: (channelId: string) => void;
  onCloseChannelConfigEditor: () => void;
  onOpenModelsConfig: () => void;
  onOpenDingTalkAccountEditor: (mode: DingTalkAccountEditorMode, accountId?: string | null) => void;
  onCloseDingTalkAccountEditor: () => void;
  onOpenGenericChannelAccountEditor: (
    channelId: string,
    mode: GenericChannelAccountEditorMode,
    accountId?: string | null,
  ) => void;
  onCloseGenericChannelAccountEditor: () => void;
  onGenericChannelAccountEditorAccountIdChange: (value: string) => void;
  onGenericChannelAccountEditorDefaultChange: (value: boolean) => void;
  onGenericChannelAccountEditorPatch: (path: Array<string | number>, value: unknown) => void;
  onDingTalkAccountEditorFieldChange: (
    field: keyof DingTalkAccountEditorValues,
    value: string | boolean,
  ) => void;
  onToggleDingTalkAccountEditorSensitiveField?: (
    field: DingTalkAccountEditorSensitiveField,
  ) => void;
  onSaveDingTalkAccountEditor: () => void;
  onDeleteDingTalkAccount: (accountId: string) => void;
  onSaveGenericChannelAccountEditor: () => void;
  onDeleteGenericChannelAccount: (channelId: string, accountId: string) => void;
  onLogsRefresh: () => void;
  onLogsAutoFollowChange: (next: boolean) => void;
  onLogsScroll: (event: Event) => void;
  onFocusLogsPanel: () => void;
  onWhatsAppStart: (force: boolean) => void;
  onWhatsAppWait: () => void;
  onWhatsAppLogout: () => void;
  onConfigPatch: (path: Array<string | number>, value: unknown) => void;
  onConfigRemove: (path: Array<string | number>) => void;
  onConfigSave: () => boolean | void | Promise<boolean | void>;
  onConfigReload: () => void;
  onNostrProfileEdit: (accountId: string, profile: NostrProfile | null) => void;
  onNostrProfileCancel: () => void;
  onNostrProfileFieldChange: (field: keyof NostrProfile, value: string) => void;
  onNostrProfileSave: () => void;
  onNostrProfileImport: () => void;
  onNostrProfileToggleAdvanced: () => void;
};

export type ChannelsChannelData = {
  whatsapp?: WhatsAppStatus;
  telegram?: TelegramStatus;
  discord?: DiscordStatus | null;
  googlechat?: GoogleChatStatus | null;
  slack?: SlackStatus | null;
  signal?: SignalStatus | null;
  imessage?: IMessageStatus | null;
  nostr?: NostrStatus | null;
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null;
};
