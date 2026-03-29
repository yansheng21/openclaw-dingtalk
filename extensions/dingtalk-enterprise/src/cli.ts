import type { Command } from "commander";
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { syncDingTalkKnowledgeBase, type DingTalkKnowledgeBaseSyncResult } from "./kb-sync.js";

type Logger = {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
};

type CliRuntime = {
  config: {
    loadConfig: () => OpenClawConfig;
  };
  agent: {
    resolveAgentWorkspaceDir: (
      cfg: OpenClawConfig,
      agentId: string,
    ) => string | undefined;
    ensureAgentWorkspace: (params?: {
      dir?: string;
      ensureBootstrapFiles?: boolean;
    }) => Promise<{ dir: string }>;
  };
};

type SyncCommandOptions = {
  account?: string;
  agent?: string;
  operatorId?: string;
  workspace: string[];
  maxWorkspaces?: number;
  maxNodes?: number;
  json?: boolean;
};

function collectOption(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function printSyncResult(result: DingTalkKnowledgeBaseSyncResult, asJson = false): void {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Account: ${result.accountId}`);
  console.log(`Agent: ${result.agentId}`);
  console.log(`Operator: ${result.operatorId}`);
  console.log(`Workspace Dir: ${result.workspaceDir}`);
  console.log(`Output Root: ${result.outputRootDir}`);
  console.log(`Workspaces: ${result.totals.workspaces}`);
  console.log(`Visited Nodes: ${result.totals.visitedNodes}`);
  console.log(`Documents Written: ${result.totals.documentsWritten}`);
  console.log(`Metadata-only Documents: ${result.totals.metadataOnlyDocuments}`);
  if (result.workspaces.length > 0) {
    console.log("");
    for (const workspace of result.workspaces) {
      console.log(
        `- ${workspace.name} (${workspace.workspaceId}) -> ${workspace.documentsWritten} docs, ${workspace.metadataOnlyDocuments} metadata-only`,
      );
    }
  }
}

export function registerDingTalkEnterpriseCli(params: {
  program: Command;
  runtime: CliRuntime;
  logger?: Logger;
}) {
  const root = params.program.command("dingtalk-enterprise").description("DingTalk enterprise utilities");
  const kb = root.command("kb").description("DingTalk knowledge base sync commands");

  kb.command("sync")
    .description("Sync DingTalk knowledge base documents into the target agent memory directory")
    .option("--account <id>", "DingTalk account id")
    .option("--agent <id>", "Target agent id")
    .option("--operator-id <unionId>", "Operator UnionId used for DingTalk KB API calls")
    .option("--workspace <id>", "Workspace id to sync (repeatable)", collectOption, [] as string[])
    .option(
      "--max-workspaces <n>",
      "Maximum number of visible workspaces to sync when --workspace is not provided",
      (value: string) => parsePositiveInteger(value, "--max-workspaces"),
    )
    .option(
      "--max-nodes <n>",
      "Maximum nodes to walk per workspace",
      (value: string) => parsePositiveInteger(value, "--max-nodes"),
    )
    .option("--json", "Print machine-readable JSON", false)
    .action(async (options: SyncCommandOptions) => {
      const cfg = params.runtime.config.loadConfig();
      const result = await syncDingTalkKnowledgeBase({
        cfg,
        runtime: params.runtime.agent,
        accountId: options.account,
        agentId: options.agent,
        operatorId: options.operatorId,
        workspaceIds: options.workspace,
        maxWorkspaces: options.maxWorkspaces,
        maxNodesPerWorkspace: options.maxNodes,
        logger: params.logger,
      });
      printSyncResult(result, options.json === true);
    });
}
