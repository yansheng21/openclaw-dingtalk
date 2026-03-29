import type { GatewayBrowserClient } from "../gateway.ts";
import {
  removeConfigFormValue,
  saveConfig,
  updateConfigFormValue,
  type ConfigState,
} from "./config.ts";

export type DingTalkKnowledgeBaseSyncWorkspaceResult = {
  workspaceId: string;
  name: string;
  outputDir: string;
  visitedNodes: number;
  documentsWritten: number;
  metadataOnlyDocuments: number;
  truncated: boolean;
};

export type DingTalkKnowledgeBaseSyncResult = {
  channelId?: string;
  accountId: string;
  agentId: string;
  operatorId: string;
  workspaceDir: string;
  outputRootDir: string;
  startedAt: string;
  completedAt: string;
  workspaces: DingTalkKnowledgeBaseSyncWorkspaceResult[];
  totals: {
    workspaces: number;
    visitedNodes: number;
    documentsWritten: number;
    metadataOnlyDocuments: number;
  };
};

export type KnowledgeSyncState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  knowledgeSyncBusy: boolean;
  knowledgeSyncAccountId: string | null;
  knowledgeSyncError: string | null;
  knowledgeSyncResult: DingTalkKnowledgeBaseSyncResult | null;
};

export type KnowledgeSyncedWorkspaceEntry = {
  channelId: string;
  accountId: string;
  accountLabel?: string;
  workspaceId: string;
  workspaceName: string;
  outputDir: string;
  indexFilePath: string;
  syncedAt?: string;
  visitedNodes?: number;
  documents: number;
  metadataOnlyDocuments: number;
  truncated?: boolean;
  rootNodeId?: string;
  updatedAtMs: number;
};

export type KnowledgeSyncedDocumentEntry = {
  channelId: string;
  accountId: string;
  accountLabel?: string;
  workspaceId: string;
  workspaceName: string;
  title: string;
  nodeId?: string;
  filePath: string;
  logicalPath?: string;
  type?: string;
  category?: string;
  extractedVia?: string;
  syncedAt?: string;
  modifiedAt?: string;
  updatedAtMs: number;
  preview?: string;
  url?: string;
  metadataOnly: boolean;
};

export type KnowledgeSyncedListResult = {
  agentId: string;
  workspaceDir: string;
  outputRootDir: string;
  workspaceCount: number;
  documentCount: number;
  metadataOnlyDocuments: number;
  lastSyncedAt?: string;
  workspaces: KnowledgeSyncedWorkspaceEntry[];
  recentDocuments: KnowledgeSyncedDocumentEntry[];
};

export type KnowledgeSyncedClearResult = {
  agentId: string;
  workspaceDir: string;
  outputRootDir: string;
  existed: boolean;
  clearedWorkspaceCount: number;
  clearedDocumentCount: number;
  clearedMetadataOnlyDocuments: number;
};

export type KnowledgeSyncedState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  knowledgeDataLoading: boolean;
  knowledgeDataError: string | null;
  knowledgeDataResult: KnowledgeSyncedListResult | null;
  knowledgeDataAgentId: string | null;
};

export type KnowledgeClearState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  knowledgeClearBusy: boolean;
  knowledgeClearAgentId: string | null;
  knowledgeClearError: string | null;
};

export type KnowledgeOperatorState = ConfigState &
  KnowledgeSyncState & {
    knowledgeOperatorDrafts: Record<string, string>;
    knowledgeOperatorSavingSourceKey: string | null;
    knowledgeOperatorSaveError: string | null;
  };

export type SyncDingTalkKnowledgeBaseParams = {
  channelId?: string | null;
  accountId: string;
  agentId?: string | null;
  operatorId?: string | null;
  workspaceIds?: string[] | null;
  maxWorkspaces?: number | null;
  maxNodesPerWorkspace?: number | null;
};

export type LoadKnowledgeSyncedDataParams = {
  agentId: string;
};

export type ClearKnowledgeSyncedDataParams = {
  agentId: string;
};

export type SaveKnowledgeSourceOperatorParams = {
  sourceKey: string;
  operatorPath: Array<string | number>;
  operatorId?: string | null;
};

function trimString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function trimStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .map((entry) => trimString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return items.length > 0 ? items : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

export function updateKnowledgeOperatorDraft(
  state: KnowledgeOperatorState,
  sourceKey: string,
  value: string,
) {
  const normalizedKey = trimString(sourceKey);
  if (!normalizedKey) {
    return;
  }
  state.knowledgeOperatorDrafts = {
    ...state.knowledgeOperatorDrafts,
    [normalizedKey]: value,
  };
  state.knowledgeOperatorSaveError = null;
}

export async function saveKnowledgeSourceOperator(
  state: KnowledgeOperatorState,
  params: SaveKnowledgeSourceOperatorParams,
): Promise<boolean> {
  if (!state.client || !state.connected || state.knowledgeOperatorSavingSourceKey) {
    return false;
  }
  const sourceKey = trimString(params.sourceKey);
  if (!sourceKey || params.operatorPath.length === 0) {
    return false;
  }

  state.knowledgeOperatorSavingSourceKey = sourceKey;
  state.knowledgeOperatorSaveError = null;

  const operatorId = trimString(params.operatorId);
  if (operatorId) {
    updateConfigFormValue(state, params.operatorPath, operatorId);
  } else {
    removeConfigFormValue(state, params.operatorPath);
  }

  await saveConfig(state);

  const saved = state.lastError == null && !state.configFormDirty;
  if (saved) {
    const nextDrafts = { ...state.knowledgeOperatorDrafts };
    delete nextDrafts[sourceKey];
    state.knowledgeOperatorDrafts = nextDrafts;
  } else {
    state.knowledgeOperatorSaveError = state.lastError ?? "Failed to save operatorId.";
  }

  state.knowledgeOperatorSavingSourceKey = null;
  return saved;
}

export async function syncDingTalkKnowledgeBase(
  state: KnowledgeSyncState,
  params: SyncDingTalkKnowledgeBaseParams,
): Promise<DingTalkKnowledgeBaseSyncResult | null> {
  if (!state.client || !state.connected || state.knowledgeSyncBusy) {
    return null;
  }
  const accountId = trimString(params.accountId);
  const channelId = trimString(params.channelId) ?? "dingtalk-enterprise";
  if (!accountId) {
    state.knowledgeSyncError = "Missing DingTalk accountId.";
    return null;
  }
  const method =
    channelId === "dingtalk-connector"
      ? "dingtalk-connector.kb.sync"
      : channelId === "dingtalk-enterprise"
        ? "dingtalk-enterprise.kb.sync"
        : null;
  if (!method) {
    state.knowledgeSyncError = `Unsupported knowledge sync source: ${channelId}.`;
    return null;
  }
  state.knowledgeSyncBusy = true;
  state.knowledgeSyncAccountId = `${channelId}:${accountId}`;
  state.knowledgeSyncError = null;
  try {
    const result = await state.client.request<DingTalkKnowledgeBaseSyncResult>(
      method,
      {
        accountId,
        ...(trimString(params.agentId) ? { agentId: trimString(params.agentId) } : {}),
        ...(trimString(params.operatorId) ? { operatorId: trimString(params.operatorId) } : {}),
        ...(trimStringArray(params.workspaceIds) ? { workspaceIds: trimStringArray(params.workspaceIds) } : {}),
        ...(positiveInteger(params.maxWorkspaces) ? { maxWorkspaces: positiveInteger(params.maxWorkspaces) } : {}),
        ...(positiveInteger(params.maxNodesPerWorkspace)
          ? { maxNodesPerWorkspace: positiveInteger(params.maxNodesPerWorkspace) }
          : {}),
        timeoutMs: 120000,
      },
    );
    const normalizedResult = {
      ...result,
      channelId: result.channelId ?? channelId,
    };
    state.knowledgeSyncResult = normalizedResult;
    return normalizedResult;
  } catch (err) {
    state.knowledgeSyncError = String(err);
    return null;
  } finally {
    state.knowledgeSyncBusy = false;
    state.knowledgeSyncAccountId = null;
  }
}

export async function loadKnowledgeSyncedData(
  state: KnowledgeSyncedState,
  params: LoadKnowledgeSyncedDataParams,
): Promise<KnowledgeSyncedListResult | null> {
  if (!state.client || !state.connected || state.knowledgeDataLoading) {
    return null;
  }
  const agentId = trimString(params.agentId);
  if (!agentId) {
    state.knowledgeDataAgentId = null;
    state.knowledgeDataResult = null;
    state.knowledgeDataError = null;
    return null;
  }
  state.knowledgeDataLoading = true;
  state.knowledgeDataAgentId = agentId;
  state.knowledgeDataError = null;
  try {
    const result = await state.client.request<KnowledgeSyncedListResult>("knowledge.synced.list", {
      agentId,
    });
    state.knowledgeDataResult = result;
    return result;
  } catch (err) {
    state.knowledgeDataError = String(err);
    return null;
  } finally {
    state.knowledgeDataLoading = false;
  }
}

export async function clearKnowledgeSyncedData(
  state: KnowledgeClearState,
  params: ClearKnowledgeSyncedDataParams,
): Promise<KnowledgeSyncedClearResult | null> {
  if (!state.client || !state.connected || state.knowledgeClearBusy) {
    return null;
  }
  const agentId = trimString(params.agentId);
  if (!agentId) {
    state.knowledgeClearAgentId = null;
    state.knowledgeClearError = null;
    return null;
  }
  state.knowledgeClearBusy = true;
  state.knowledgeClearAgentId = agentId;
  state.knowledgeClearError = null;
  try {
    return await state.client.request<KnowledgeSyncedClearResult>("knowledge.synced.clear", {
      agentId,
    });
  } catch (err) {
    state.knowledgeClearError = String(err);
    return null;
  } finally {
    state.knowledgeClearBusy = false;
    state.knowledgeClearAgentId = null;
  }
}
