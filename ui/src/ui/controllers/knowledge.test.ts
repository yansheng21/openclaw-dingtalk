import { describe, expect, it, vi } from "vitest";
import {
  clearKnowledgeSyncedData,
  loadKnowledgeSyncedData,
  saveKnowledgeSourceOperator,
  updateKnowledgeOperatorDraft,
  type KnowledgeClearState,
  type KnowledgeSyncedState,
  type KnowledgeOperatorState,
} from "./knowledge.ts";

function createState(initialConfig: Record<string, unknown>) {
  let currentConfig = structuredClone(initialConfig);
  let currentHash = "hash-1";
  const request = vi.fn().mockImplementation(async (method: string, params?: { raw?: string }) => {
    if (method === "config.set") {
      currentConfig = JSON.parse(params?.raw ?? "{}") as Record<string, unknown>;
      currentHash = "hash-2";
      return { ok: true };
    }
    if (method === "config.get") {
      return {
        hash: currentHash,
        config: currentConfig,
        valid: true,
        issues: [],
        raw: JSON.stringify(currentConfig, null, 2),
      };
    }
    return {};
  });

  const state: KnowledgeOperatorState = {
    applySessionKey: "main",
    client: { request } as never,
    configActiveSection: null,
    configActiveSubsection: null,
    configApplying: false,
    configForm: null,
    configFormDirty: false,
    configFormMode: "form",
    configFormOriginal: null,
    configIssues: [],
    configLoading: false,
    configRaw: "",
    configRawOriginal: "",
    configSaving: false,
    configSchema: null,
    configSchemaLoading: false,
    configSchemaVersion: null,
    configSearchQuery: "",
    configSnapshot: {
      hash: "hash-1",
      config: structuredClone(initialConfig),
      valid: true,
      issues: [],
      raw: JSON.stringify(initialConfig, null, 2),
    },
    configUiHints: {},
    configValid: true,
    connected: true,
    knowledgeOperatorDrafts: {},
    knowledgeOperatorSaveError: null,
    knowledgeOperatorSavingSourceKey: null,
    knowledgeSyncAccountId: null,
    knowledgeSyncBusy: false,
    knowledgeSyncError: null,
    knowledgeSyncResult: null,
    lastError: null,
    updateRunning: false,
  };

  return { request, state };
}

function createSyncedState() {
  const request = vi.fn();
  const state: KnowledgeSyncedState & KnowledgeClearState = {
    client: { request } as never,
    connected: true,
    knowledgeDataLoading: false,
    knowledgeDataError: null,
    knowledgeDataResult: null,
    knowledgeDataAgentId: null,
    knowledgeClearBusy: false,
    knowledgeClearAgentId: null,
    knowledgeClearError: null,
  };
  return { request, state };
}

describe("updateKnowledgeOperatorDraft", () => {
  it("stores the draft and clears the previous save error", () => {
    const { state } = createState({});
    state.knowledgeOperatorSaveError = "boom";

    updateKnowledgeOperatorDraft(state, "dingtalk-connector:relay-main", "union-main");

    expect(state.knowledgeOperatorDrafts).toEqual({
      "dingtalk-connector:relay-main": "union-main",
    });
    expect(state.knowledgeOperatorSaveError).toBeNull();
  });
});

describe("saveKnowledgeSourceOperator", () => {
  it("writes operatorId to config and clears the draft after save", async () => {
    const { request, state } = createState({
      channels: {
        "dingtalk-connector": {
          accounts: {
            "relay-main": {
              knowledgeBaseSync: {
                targetAgentId: "alpha",
              },
            },
          },
        },
      },
    });
    state.knowledgeOperatorDrafts = { "dingtalk-connector:relay-main": "union-main" };

    const saved = await saveKnowledgeSourceOperator(state, {
      sourceKey: "dingtalk-connector:relay-main",
      operatorPath: [
        "channels",
        "dingtalk-connector",
        "accounts",
        "relay-main",
        "knowledgeBaseSync",
        "operatorId",
      ],
      operatorId: "union-main",
    });

    expect(saved).toBe(true);
    expect(request).toHaveBeenCalledWith(
      "config.set",
      expect.objectContaining({ baseHash: "hash-1" }),
    );
    expect(state.knowledgeOperatorSavingSourceKey).toBeNull();
    expect(state.knowledgeOperatorSaveError).toBeNull();
    expect(state.knowledgeOperatorDrafts).toEqual({});
    expect(state.configForm).toEqual({
      channels: {
        "dingtalk-connector": {
          accounts: {
            "relay-main": {
              knowledgeBaseSync: {
                targetAgentId: "alpha",
                operatorId: "union-main",
              },
            },
          },
        },
      },
    });
  });

  it("removes operatorId when saving an empty value", async () => {
    const { state } = createState({
      channels: {
        "dingtalk-connector": {
          accounts: {
            "relay-main": {
              knowledgeBaseSync: {
                targetAgentId: "alpha",
                operatorId: "union-main",
              },
            },
          },
        },
      },
    });

    const saved = await saveKnowledgeSourceOperator(state, {
      sourceKey: "dingtalk-connector:relay-main",
      operatorPath: [
        "channels",
        "dingtalk-connector",
        "accounts",
        "relay-main",
        "knowledgeBaseSync",
        "operatorId",
      ],
      operatorId: "   ",
    });

    expect(saved).toBe(true);
    expect(state.configForm).toEqual({
      channels: {
        "dingtalk-connector": {
          accounts: {
            "relay-main": {
              knowledgeBaseSync: {
                targetAgentId: "alpha",
              },
            },
          },
        },
      },
    });
  });
});

describe("loadKnowledgeSyncedData", () => {
  it("loads synced workspace data into state", async () => {
    const { request, state } = createSyncedState();
    request.mockResolvedValue({
      agentId: "alpha",
      workspaceDir: "/tmp/alpha",
      outputRootDir: "/tmp/alpha/memory/dingtalk-kb",
      workspaceCount: 1,
      documentCount: 2,
      metadataOnlyDocuments: 1,
      lastSyncedAt: "2026-03-29T00:00:00.000Z",
      workspaces: [],
      recentDocuments: [],
    });

    const result = await loadKnowledgeSyncedData(state, { agentId: " alpha " });

    expect(request).toHaveBeenCalledWith("knowledge.synced.list", { agentId: "alpha" });
    expect(result?.workspaceCount).toBe(1);
    expect(state.knowledgeDataAgentId).toBe("alpha");
    expect(state.knowledgeDataError).toBeNull();
    expect(state.knowledgeDataResult?.documentCount).toBe(2);
    expect(state.knowledgeDataLoading).toBe(false);
  });

  it("clears synced data state when agentId is empty", async () => {
    const { request, state } = createSyncedState();
    state.knowledgeDataAgentId = "alpha";
    state.knowledgeDataError = "boom";
    state.knowledgeDataResult = {
      agentId: "alpha",
      workspaceDir: "/tmp/alpha",
      outputRootDir: "/tmp/alpha/memory/dingtalk-kb",
      workspaceCount: 1,
      documentCount: 1,
      metadataOnlyDocuments: 0,
      workspaces: [],
      recentDocuments: [],
    };

    const result = await loadKnowledgeSyncedData(state, { agentId: "   " });

    expect(result).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect(state.knowledgeDataAgentId).toBeNull();
    expect(state.knowledgeDataError).toBeNull();
    expect(state.knowledgeDataResult).toBeNull();
  });
});

describe("clearKnowledgeSyncedData", () => {
  it("clears synced workspace cache for the selected agent", async () => {
    const { request, state } = createSyncedState();
    request.mockResolvedValue({
      agentId: "alpha",
      workspaceDir: "/tmp/alpha",
      outputRootDir: "/tmp/alpha/memory/dingtalk-kb",
      existed: true,
      clearedWorkspaceCount: 2,
      clearedDocumentCount: 12,
      clearedMetadataOnlyDocuments: 3,
    });

    const result = await clearKnowledgeSyncedData(state, { agentId: " alpha " });

    expect(request).toHaveBeenCalledWith("knowledge.synced.clear", { agentId: "alpha" });
    expect(result?.clearedWorkspaceCount).toBe(2);
    expect(state.knowledgeClearAgentId).toBeNull();
    expect(state.knowledgeClearBusy).toBe(false);
    expect(state.knowledgeClearError).toBeNull();
  });
});
