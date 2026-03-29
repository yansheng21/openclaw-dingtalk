import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureAgentWorkspace,
} from "../../agents/workspace.js";
import {
  listAgentIds,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "../../agents/agent-scope.js";
import { loadConfig } from "../../config/config.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../../routing/session-key.js";
import { resolveConfiguredSecretInputString } from "../resolve-configured-secret-input-string.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const DINGTALK_API = "https://api.dingtalk.com";
const DINGTALK_CONNECTOR_CHANNEL_ID = "dingtalk-connector";
const DINGTALK_ENTERPRISE_CHANNEL_ID = "dingtalk-enterprise";
const DEFAULT_MAX_WORKSPACES = 5;
const DEFAULT_MAX_NODES_PER_WORKSPACE = 300;
const KNOWLEDGE_OUTPUT_DIRNAME = "dingtalk-kb";
const KNOWLEDGE_RECENT_DOCUMENT_LIMIT = 24;
const TEXT_DOWNLOAD_EXTENSIONS = new Set([
  "md",
  "markdown",
  "txt",
  "text",
  "json",
  "jsonl",
  "csv",
  "tsv",
  "xml",
  "yaml",
  "yml",
  "ini",
  "conf",
  "log",
  "html",
  "htm",
  "css",
  "scss",
  "less",
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "sql",
  "py",
  "rb",
  "java",
  "kt",
  "go",
  "rs",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "sh",
  "bash",
  "zsh",
  "toml",
  "properties",
]);
const TEXT_RESPONSE_CONTENT_TYPES = [
  "text/",
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/javascript",
];
const DIRECT_METADATA_ONLY_CATEGORIES = new Set(["IMAGE"]);
const DIRECT_METADATA_ONLY_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "heic",
  "heif",
  "avif",
  "tif",
  "tiff",
  "ico",
]);

type Logger = {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
};

type JsonRecord = Record<string, unknown>;

type KnowledgeSyncConfig = {
  enabled?: boolean;
  operatorId?: string;
  targetAgentId?: string;
  workspaceIds?: string[];
  maxWorkspaces?: number;
  maxNodesPerWorkspace?: number;
};

type ResolvedDingtalkConnectorAccount = {
  channelId: typeof DINGTALK_CONNECTOR_CHANNEL_ID;
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
  unresolvedSecretReason?: string;
  syncConfig: KnowledgeSyncConfig;
};

type RawWorkspace = {
  workspaceId: string;
  name?: string;
  rootNodeId?: string;
  url?: string;
};

type RawNode = {
  nodeId: string;
  name?: string;
  type?: string;
  category?: string;
  url?: string;
  workspaceId?: string;
  hasChildren?: boolean;
  modifiedTime?: string;
  extension?: string;
  permissionRole?: string;
};

type ResolvedDentry = {
  dentryUuid?: string;
  dentryId?: string;
  spaceId?: string;
};

type DentryDownloadInfo = {
  resourceUrls: string[];
  headers: Record<string, string>;
};

type WorkspaceDocument = {
  node: RawNode;
  logicalPath: string;
};

type WorkspaceCollectionResult = {
  documents: WorkspaceDocument[];
  visitedNodes: number;
  truncated: boolean;
};

type ResolvedNodeContent = {
  content?: string;
  source: "node-content" | "storage-download" | "metadata-only";
};

type SyncSettings = {
  accountId: string;
  agentId: string;
  operatorId: string;
  workspaceIds: string[];
  maxWorkspaces: number;
  maxNodesPerWorkspace: number;
};

type DingTalkKnowledgeBaseSyncWorkspaceResult = {
  workspaceId: string;
  name: string;
  outputDir: string;
  visitedNodes: number;
  documentsWritten: number;
  metadataOnlyDocuments: number;
  truncated: boolean;
};

type DingTalkKnowledgeBaseSyncResult = {
  channelId: string;
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

type KnowledgeSyncedWorkspaceEntry = {
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

type KnowledgeSyncedDocumentEntry = {
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

type KnowledgeSyncedListResult = {
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

type KnowledgeSyncedClearResult = {
  agentId: string;
  workspaceDir: string;
  outputRootDir: string;
  existed: boolean;
  clearedWorkspaceCount: number;
  clearedDocumentCount: number;
  clearedMetadataOnlyDocuments: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringOrNumber(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return asString(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items = value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return [...new Set(items)];
}

function parseNumberString(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBooleanString(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "yes" || value === "true") {
    return true;
  }
  if (value === "no" || value === "false") {
    return false;
  }
  return undefined;
}

function resolvePositiveInteger(value: unknown, fallback: number): number {
  const parsed = asNumber(value);
  if (parsed == null || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function clipErrorMessage(value: string, maxLength = 220): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function toErrorMessage(error: unknown): string {
  return clipErrorMessage(error instanceof Error ? error.message : String(error));
}

function truncatePreview(value: string, maxLength = 220): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function isMetadataOnlyPlaceholderBody(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const compact = value.replace(/\s+/g, " ").trim();
  return (
    compact.includes("_No body text was extracted; only document metadata was synced._") ||
    compact.includes("_未提取到正文；当前仅同步了文档元信息。_")
  );
}

function sanitizeFileSegment(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim();
  const normalized = raw
    .normalize("NFKC")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function toSingleLine(value: string | undefined, fallback = "Untitled"): string {
  return (value ?? fallback).replace(/\s+/g, " ").trim() || fallback;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function parseResponseBody(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as unknown;
  }
  return trimmed;
}

function parseKnowledgeMarkdown(content: string): {
  title?: string;
  metadata: Record<string, string>;
  content?: string;
} {
  const lines = content.split(/\r?\n/);
  const metadata: Record<string, string> = {};
  let title: string | undefined;
  let inMetadata = false;
  let contentStart = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (!title && line.startsWith("# ")) {
      title = line.slice(2).trim() || undefined;
      inMetadata = true;
      continue;
    }
    if (line === "## Content") {
      contentStart = index + 1;
      break;
    }
    if (!inMetadata || !line || !line.startsWith("- ")) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator <= 2) {
      continue;
    }
    const key = line.slice(2, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value) {
      metadata[key] = value;
    }
  }

  const body =
    contentStart >= 0
      ? lines
          .slice(contentStart)
          .join("\n")
          .trim()
      : undefined;

  return { title, metadata, content: body || undefined };
}

function resolveSyncedSourceFromRelativePath(relativePath: string): {
  channelId: string;
  accountId: string;
  workspaceId: string;
} | null {
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  if (parts[0] === DINGTALK_CONNECTOR_CHANNEL_ID || parts[0] === DINGTALK_ENTERPRISE_CHANNEL_ID) {
    if (parts.length < 4) {
      return null;
    }
    return {
      channelId: parts[0],
      accountId: parts[1] ?? "default",
      workspaceId: parts[2] ?? "",
    };
  }
  return {
    channelId: DINGTALK_ENTERPRISE_CHANNEL_ID,
    accountId: parts[0] ?? "default",
    workspaceId: parts[1] ?? "",
  };
}

function readStringAtPath(value: unknown, pathSegments: ReadonlyArray<string>): string | undefined {
  let current: unknown = value;
  for (const segment of pathSegments) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return asString(current);
}

function extractTextCandidates(value: unknown, seen: WeakSet<object>, out: string[]): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      out.push(trimmed);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      extractTextCandidates(entry, seen, out);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") {
      if (["text", "content", "plainText", "markdown", "title", "value"].includes(key)) {
        const trimmed = child.trim();
        if (trimmed) {
          out.push(trimmed);
        }
      }
      continue;
    }
    extractTextCandidates(child, seen, out);
  }
}

function extractTextFromDingTalkNodeContent(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  const directPaths: ReadonlyArray<ReadonlyArray<string>> = [
    ["markdown"],
    ["content"],
    ["text"],
    ["plainText"],
    ["body", "markdown"],
    ["body", "content"],
    ["data", "markdown"],
    ["data", "content"],
    ["result", "markdown"],
    ["result", "content"],
    ["node", "markdown"],
    ["node", "content"],
    ["node", "text"],
  ];
  for (const pathSegments of directPaths) {
    const resolved = readStringAtPath(value, pathSegments);
    if (resolved) {
      return resolved;
    }
  }

  const candidates: string[] = [];
  extractTextCandidates(value, new WeakSet<object>(), candidates);
  const unique = [...new Set(candidates.map((entry) => entry.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return undefined;
  }
  return unique.join("\n\n");
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const entries = Object.entries(value)
    .map(([key, entry]) => {
      const resolved = asStringOrNumber(entry);
      return resolved ? ([key, resolved] as const) : null;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));
  return Object.fromEntries(entries);
}

function resolveNodeExtension(node: RawNode): string | undefined {
  const raw =
    asString(node.extension) ??
    (() => {
      const name = asString(node.name);
      if (!name) {
        return undefined;
      }
      const lastDot = name.lastIndexOf(".");
      return lastDot >= 0 ? name.slice(lastDot + 1) : undefined;
    })();
  if (!raw) {
    return undefined;
  }
  const normalized = raw.trim().replace(/^\./, "").toLowerCase();
  return normalized || undefined;
}

function isTextDownloadCandidate(node: RawNode): boolean {
  const extension = resolveNodeExtension(node);
  return Boolean(extension && TEXT_DOWNLOAD_EXTENSIONS.has(extension));
}

function shouldUseMetadataOnlyPath(node: RawNode): boolean {
  const category = asString(node.category)?.toUpperCase();
  if (category && DIRECT_METADATA_ONLY_CATEGORIES.has(category)) {
    return true;
  }
  const extension = resolveNodeExtension(node);
  return Boolean(extension && DIRECT_METADATA_ONLY_EXTENSIONS.has(extension));
}

function isDocumentLikeNode(node: RawNode): boolean {
  const type = node.type?.trim().toUpperCase();
  if (type === "FILE") {
    return true;
  }
  if (type === "FOLDER") {
    return false;
  }
  return Boolean(node.url || node.category || node.extension) && node.hasChildren !== true;
}

function buildMarkdownDocument(params: {
  account: ResolvedDingtalkConnectorAccount;
  workspace: RawWorkspace;
  document: WorkspaceDocument;
  syncedAt: string;
  content?: string;
  contentSource: ResolvedNodeContent["source"];
}): string {
  const title = toSingleLine(params.document.node.name, params.document.node.nodeId);
  const lines = [
    `# ${title}`,
    "",
    `- Source: DingTalk knowledge base sync`,
    `- Channel: ${params.account.channelId}`,
    `- Account: ${params.account.name ?? params.account.accountId}`,
    `- Workspace: ${toSingleLine(params.workspace.name, params.workspace.workspaceId)}`,
    `- Workspace ID: ${params.workspace.workspaceId}`,
    `- Node ID: ${params.document.node.nodeId}`,
    `- Type: ${params.document.node.type ?? "unknown"}`,
    `- Category: ${params.document.node.category ?? "unknown"}`,
    `- Path: ${params.document.logicalPath}`,
    `- URL: ${params.document.node.url ?? params.workspace.url ?? "unavailable"}`,
    `- Synced At: ${params.syncedAt}`,
    `- Extracted Via: ${params.contentSource}`,
  ];
  if (params.document.node.modifiedTime) {
    lines.push(`- Modified At: ${params.document.node.modifiedTime}`);
  }
  if (params.document.node.permissionRole) {
    lines.push(`- Permission: ${params.document.node.permissionRole}`);
  }
  lines.push("", "## Content", "");
  if (params.content) {
    lines.push(params.content.trim());
  } else {
    lines.push("_No body text was extracted; only document metadata was synced._");
  }
  return ensureTrailingNewline(lines.join("\n"));
}

function buildWorkspaceIndex(params: {
  account: ResolvedDingtalkConnectorAccount;
  workspace: RawWorkspace;
  syncedAt: string;
  collection: WorkspaceCollectionResult;
  metadataOnlyDocuments: number;
}): string {
  const lines = [
    `# ${toSingleLine(params.workspace.name, params.workspace.workspaceId)}`,
    "",
    `- Source: DingTalk knowledge base sync`,
    `- Channel: ${params.account.channelId}`,
    `- Account: ${params.account.name ?? params.account.accountId}`,
    `- Workspace ID: ${params.workspace.workspaceId}`,
    `- Root Node ID: ${params.workspace.rootNodeId ?? "unavailable"}`,
    `- Synced At: ${params.syncedAt}`,
    `- Visited Nodes: ${String(params.collection.visitedNodes)}`,
    `- Documents: ${String(params.collection.documents.length)}`,
    `- Metadata-only Documents: ${String(params.metadataOnlyDocuments)}`,
    `- Truncated: ${params.collection.truncated ? "yes" : "no"}`,
    "",
    "## Documents",
    "",
  ];
  if (params.collection.documents.length === 0) {
    lines.push("_No document nodes were synced._");
  } else {
    for (const document of params.collection.documents) {
      lines.push(
        `- ${toSingleLine(document.node.name, document.node.nodeId)} | ${document.node.nodeId} | ${document.logicalPath}`,
      );
    }
  }
  return ensureTrailingNewline(lines.join("\n"));
}

async function readDirEntriesSafe(dirPath: string): Promise<fs.Dirent[]> {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function collectWorkspaceIndexPaths(
  dirPath: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 4) {
    return [];
  }
  const entries = await readDirEntriesSafe(dirPath);
  const paths: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await collectWorkspaceIndexPaths(absolutePath, depth + 1)));
      continue;
    }
    if (entry.isFile() && entry.name === "_workspace-index.md") {
      paths.push(absolutePath);
    }
  }
  return paths;
}

async function listSyncedKnowledgeData(params: {
  agentId: string;
  workspaceDir: string;
}): Promise<KnowledgeSyncedListResult> {
  const outputRootDir = path.join(params.workspaceDir, "memory", KNOWLEDGE_OUTPUT_DIRNAME);
  const indexPaths = await collectWorkspaceIndexPaths(outputRootDir);
  const workspaces: KnowledgeSyncedWorkspaceEntry[] = [];
  const recentDocuments: KnowledgeSyncedDocumentEntry[] = [];

  for (const indexPath of indexPaths) {
    const relativePath = path.relative(outputRootDir, indexPath);
    const source = resolveSyncedSourceFromRelativePath(relativePath);
    if (!source) {
      continue;
    }
    const raw = await fs.readFile(indexPath, "utf-8").catch(() => "");
    if (!raw.trim()) {
      continue;
    }
    const parsed = parseKnowledgeMarkdown(raw);
    const stat = await fs.stat(indexPath).catch(() => null);
    const workspaceDir = path.dirname(indexPath);
    const workspaceEntry: KnowledgeSyncedWorkspaceEntry = {
      channelId: source.channelId,
      accountId: source.accountId,
      accountLabel: parsed.metadata.Account,
      workspaceId: parsed.metadata["Workspace ID"] ?? source.workspaceId,
      workspaceName: parsed.title ?? source.workspaceId,
      outputDir: workspaceDir,
      indexFilePath: indexPath,
      syncedAt: parsed.metadata["Synced At"],
      visitedNodes: parseNumberString(parsed.metadata["Visited Nodes"]),
      documents: parseNumberString(parsed.metadata.Documents) ?? 0,
      metadataOnlyDocuments: parseNumberString(parsed.metadata["Metadata-only Documents"]) ?? 0,
      truncated: parseBooleanString(parsed.metadata.Truncated),
      rootNodeId: parsed.metadata["Root Node ID"],
      updatedAtMs: stat?.mtimeMs ?? 0,
    };
    workspaces.push(workspaceEntry);

    const documentEntries = await readDirEntriesSafe(workspaceDir);
    for (const entry of documentEntries) {
      if (!entry.isFile() || entry.name === "_workspace-index.md" || !entry.name.endsWith(".md")) {
        continue;
      }
      const filePath = path.join(workspaceDir, entry.name);
      const docRaw = await fs.readFile(filePath, "utf-8").catch(() => "");
      if (!docRaw.trim()) {
        continue;
      }
      const docParsed = parseKnowledgeMarkdown(docRaw);
      const docStat = await fs.stat(filePath).catch(() => null);
      const extractedVia = docParsed.metadata["Extracted Via"];
      const body = docParsed.content;
      const metadataOnly =
        extractedVia === "metadata-only" ||
        !body ||
        isMetadataOnlyPlaceholderBody(body);
      recentDocuments.push({
        channelId: source.channelId,
        accountId: source.accountId,
        accountLabel: docParsed.metadata.Account ?? parsed.metadata.Account,
        workspaceId: docParsed.metadata["Workspace ID"] ?? workspaceEntry.workspaceId,
        workspaceName: docParsed.metadata.Workspace ?? workspaceEntry.workspaceName,
        title: docParsed.title ?? entry.name,
        nodeId: docParsed.metadata["Node ID"],
        filePath,
        logicalPath: docParsed.metadata.Path,
        type: docParsed.metadata.Type,
        category: docParsed.metadata.Category,
        extractedVia,
        syncedAt: docParsed.metadata["Synced At"],
        modifiedAt: docParsed.metadata["Modified At"],
        updatedAtMs: docStat?.mtimeMs ?? workspaceEntry.updatedAtMs,
        preview: metadataOnly || !body ? undefined : truncatePreview(body),
        url: docParsed.metadata.URL,
        metadataOnly,
      });
    }
  }

  workspaces.sort((left, right) => {
    const leftAt = Date.parse(left.syncedAt ?? "") || left.updatedAtMs;
    const rightAt = Date.parse(right.syncedAt ?? "") || right.updatedAtMs;
    return rightAt - leftAt;
  });
  recentDocuments.sort((left, right) => {
    const leftAt = Date.parse(left.syncedAt ?? "") || left.updatedAtMs;
    const rightAt = Date.parse(right.syncedAt ?? "") || right.updatedAtMs;
    return rightAt - leftAt;
  });

  const lastSyncedAt = workspaces
    .map((entry) => entry.syncedAt)
    .filter((entry): entry is string => Boolean(entry))
    .toSorted((left, right) => Date.parse(right) - Date.parse(left))[0];

  return {
    agentId: params.agentId,
    workspaceDir: params.workspaceDir,
    outputRootDir,
    workspaceCount: workspaces.length,
    documentCount: workspaces.reduce((sum, entry) => sum + entry.documents, 0),
    metadataOnlyDocuments: workspaces.reduce((sum, entry) => sum + entry.metadataOnlyDocuments, 0),
    lastSyncedAt,
    workspaces,
    recentDocuments: recentDocuments.slice(0, KNOWLEDGE_RECENT_DOCUMENT_LIMIT),
  };
}

async function clearSyncedKnowledgeData(params: {
  agentId: string;
  workspaceDir: string;
}): Promise<KnowledgeSyncedClearResult> {
  const current = await listSyncedKnowledgeData(params);
  let existed = false;
  try {
    const stat = await fs.stat(current.outputRootDir);
    existed = stat.isDirectory();
  } catch {
    existed = false;
  }
  await fs.rm(current.outputRootDir, { recursive: true, force: true });
  return {
    agentId: params.agentId,
    workspaceDir: params.workspaceDir,
    outputRootDir: current.outputRootDir,
    existed,
    clearedWorkspaceCount: current.workspaceCount,
    clearedDocumentCount: current.documentCount,
    clearedMetadataOnlyDocuments: current.metadataOnlyDocuments,
  };
}

class DingtalkConnectorKnowledgeBaseClient {
  private readonly account: ResolvedDingtalkConnectorAccount;
  private readonly operatorId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly logger?: Logger;
  private accessTokenPromise: Promise<string> | null = null;

  constructor(params: {
    account: ResolvedDingtalkConnectorAccount;
    operatorId: string;
    fetchImpl: typeof fetch;
    logger?: Logger;
  }) {
    this.account = params.account;
    this.operatorId = params.operatorId;
    this.fetchImpl = params.fetchImpl;
    this.logger = params.logger;
  }

  private async getAccessToken(): Promise<string> {
    this.accessTokenPromise ??= (async () => {
      const appKey = this.account.clientId;
      const appSecret = this.account.clientSecret;
      if (!appKey || !appSecret) {
        throw new Error("Missing DingTalk clientId or clientSecret for KB sync.");
      }
      const response = await this.fetchImpl(`${DINGTALK_API}/v1.0/oauth2/accessToken`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          appKey,
          appSecret,
        }),
      });
      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`token request failed (${response.status}): ${clipErrorMessage(raw)}`);
      }
      const payload = parseResponseBody(raw);
      const token = isRecord(payload) ? asString(payload.accessToken) : undefined;
      if (!token) {
        throw new Error("DingTalk token response did not include accessToken.");
      }
      return token;
    })();
    return await this.accessTokenPromise;
  }

  private async request<T>(params: {
    method: "GET" | "POST";
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  }): Promise<T> {
    const url = new URL(params.path, DINGTALK_API);
    for (const [key, value] of Object.entries(params.query ?? {})) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    const token = await this.getAccessToken();
    const response = await this.fetchImpl(url, {
      method: params.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-acs-dingtalk-access-token": token,
      },
      ...(params.body === undefined ? {} : { body: JSON.stringify(params.body) }),
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`${params.method} ${url.pathname} failed (${response.status}): ${clipErrorMessage(raw)}`);
    }
    try {
      return parseResponseBody(raw) as T;
    } catch (error) {
      throw new Error(`${params.method} ${url.pathname} returned invalid JSON: ${toErrorMessage(error)}`, { cause: error });
    }
  }

  async listWorkspaces(maxWorkspaces: number): Promise<RawWorkspace[]> {
    const workspaces: RawWorkspace[] = [];
    let nextToken: string | undefined;
    do {
      const payload = await this.request<Record<string, unknown>>({
        method: "GET",
        path: "/v2.0/wiki/workspaces",
        query: {
          operatorId: this.operatorId,
          maxResults: Math.min(100, maxWorkspaces),
          ...(nextToken ? { nextToken } : {}),
        },
      });
      const entries = Array.isArray(payload.workspaces) ? payload.workspaces : [];
      for (const entry of entries) {
        if (!isRecord(entry)) {
          continue;
        }
        const workspaceId = asString(entry.workspaceId);
        if (!workspaceId) {
          continue;
        }
        workspaces.push({
          workspaceId,
          name: asString(entry.name),
          rootNodeId: asString(entry.rootNodeId),
          url: asString(entry.url),
        });
        if (workspaces.length >= maxWorkspaces) {
          return workspaces;
        }
      }
      nextToken = asString(payload.nextToken);
    } while (nextToken && workspaces.length < maxWorkspaces);
    return workspaces;
  }

  async getWorkspace(workspaceId: string): Promise<RawWorkspace> {
    const payload = await this.request<Record<string, unknown>>({
      method: "GET",
      path: `/v2.0/wiki/workspaces/${encodeURIComponent(workspaceId)}`,
      query: {
        operatorId: this.operatorId,
      },
    });
    const rawWorkspace = isRecord(payload.workspace) ? payload.workspace : payload;
    const resolvedWorkspaceId = asString(rawWorkspace.workspaceId) ?? workspaceId;
    return {
      workspaceId: resolvedWorkspaceId,
      name: asString(rawWorkspace.name),
      rootNodeId: asString(rawWorkspace.rootNodeId),
      url: asString(rawWorkspace.url),
    };
  }

  async listNodes(params: {
    parentNodeId: string;
    nextToken?: string;
  }): Promise<{ nodes: RawNode[]; nextToken?: string }> {
    const payload = await this.request<Record<string, unknown>>({
      method: "GET",
      path: "/v2.0/wiki/nodes",
      query: {
        operatorId: this.operatorId,
        parentNodeId: params.parentNodeId,
        maxResults: 100,
        ...(params.nextToken ? { nextToken: params.nextToken } : {}),
      },
    });
    const nodes = Array.isArray(payload.nodes)
      ? payload.nodes
          .map((entry) => {
            if (!isRecord(entry)) {
              return null;
            }
            const nodeId = asString(entry.nodeId);
            if (!nodeId) {
              return null;
            }
            return {
              nodeId,
              name: asString(entry.name),
              type: asString(entry.type),
              category: asString(entry.category),
              url: asString(entry.url),
              workspaceId: asString(entry.workspaceId),
              hasChildren: asBoolean(entry.hasChildren),
              modifiedTime: asString(entry.modifiedTime),
              extension: asString(entry.extension),
              permissionRole: asString(entry.permissionRole),
            } satisfies RawNode;
          })
          .filter((entry): entry is RawNode => Boolean(entry))
      : [];
    return {
      nodes,
      nextToken: asString(payload.nextToken),
    };
  }

  async readNodeContent(nodeId: string): Promise<unknown> {
    return await this.request<unknown>({
      method: "GET",
      path: `/v2.0/wiki/nodes/${encodeURIComponent(nodeId)}/content`,
      query: {
        operatorId: this.operatorId,
      },
    });
  }

  async resolveDentryByUuid(dentryUuid: string): Promise<ResolvedDentry | null> {
    const payload = await this.request<Record<string, unknown>>({
      method: "GET",
      path: `/v2.0/doc/dentries/${encodeURIComponent(dentryUuid)}/queryDentryId`,
      query: {
        operatorId: this.operatorId,
      },
    });
    const resolvedDentryUuid = asString(payload.dentryUuid) ?? dentryUuid;
    const dentryId = asString(payload.dentryId);
    const spaceId = asString(payload.spaceId);
    if (!dentryId || !spaceId) {
      return null;
    }
    return {
      dentryUuid: resolvedDentryUuid,
      dentryId,
      spaceId,
    };
  }

  async getFileDownloadInfo(spaceId: string, dentryId: string): Promise<DentryDownloadInfo | null> {
    const payload = await this.request<Record<string, unknown>>({
      method: "POST",
      path: `/v1.0/storage/spaces/${encodeURIComponent(spaceId)}/dentries/${encodeURIComponent(dentryId)}/downloadInfos/query`,
      query: {
        unionId: this.operatorId,
      },
      body: {
        option: {
          preferIntranet: false,
        },
      },
    });
    const signature = isRecord(payload.headerSignatureInfo) ? payload.headerSignatureInfo : payload;
    const resourceUrls =
      normalizeStringArray(signature.resourceUrls).length > 0
        ? normalizeStringArray(signature.resourceUrls)
        : normalizeStringArray(signature.internalResourceUrls);
    if (resourceUrls.length === 0) {
      return null;
    }
    return {
      resourceUrls,
      headers: normalizeStringMap(signature.headers),
    };
  }

  async downloadText(url: string, headers?: Record<string, string>): Promise<string | null> {
    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "text/plain, text/markdown, application/json;q=0.8",
        ...headers,
      },
    });
    if (!response.ok) {
      this.logger?.warn?.("dingtalk-connector: markdown download failed", {
        status: response.status,
        url,
      });
      return null;
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !TEXT_RESPONSE_CONTENT_TYPES.some((candidate) => contentType.startsWith(candidate))
    ) {
      this.logger?.warn?.("dingtalk-connector: skipped non-text knowledge download", {
        contentType,
        url,
      });
      return null;
    }
    const raw = await response.text();
    const trimmed = raw.trim();
    return trimmed || null;
  }
}

async function collectWorkspaceDocuments(params: {
  client: DingtalkConnectorKnowledgeBaseClient;
  workspace: RawWorkspace;
  maxNodesPerWorkspace: number;
}): Promise<WorkspaceCollectionResult> {
  const { client, workspace, maxNodesPerWorkspace } = params;
  if (!workspace.rootNodeId) {
    return {
      documents: [],
      visitedNodes: 0,
      truncated: false,
    };
  }

  const documents: WorkspaceDocument[] = [];
  const seenNodes = new Set<string>();
  let visitedNodes = 0;
  let truncated = false;

  async function walk(parentNodeId: string, pathPrefix: string[]): Promise<void> {
    let nextToken: string | undefined;
    do {
      const page = await client.listNodes({ parentNodeId, nextToken });
      nextToken = page.nextToken;
      for (const node of page.nodes) {
        if (seenNodes.has(node.nodeId)) {
          continue;
        }
        seenNodes.add(node.nodeId);
        visitedNodes += 1;
        if (visitedNodes > maxNodesPerWorkspace) {
          truncated = true;
          return;
        }
        const nodeName = toSingleLine(node.name, node.nodeId);
        const nextPath = [...pathPrefix, nodeName];
        if (isDocumentLikeNode(node)) {
          documents.push({
            node,
            logicalPath: nextPath.join(" / "),
          });
        }
        if (node.hasChildren === true) {
          await walk(node.nodeId, nextPath);
          if (truncated) {
            return;
          }
        }
      }
    } while (nextToken && !truncated);
  }

  await walk(workspace.rootNodeId, [toSingleLine(workspace.name, workspace.workspaceId)]);
  return {
    documents,
    visitedNodes: Math.min(visitedNodes, maxNodesPerWorkspace),
    truncated,
  };
}

async function resolveNodeContent(params: {
  client: DingtalkConnectorKnowledgeBaseClient;
  document: WorkspaceDocument;
  logger?: Logger;
}): Promise<ResolvedNodeContent> {
  const { client, document, logger } = params;
  if (shouldUseMetadataOnlyPath(document.node)) {
    return { source: "metadata-only" };
  }
  try {
    const directPayload = await client.readNodeContent(document.node.nodeId);
    const directText = extractTextFromDingTalkNodeContent(directPayload);
    if (directText) {
      return {
        content: directText,
        source: "node-content",
      };
    }
  } catch (error) {
    logger?.warn?.("dingtalk-connector: direct node content fetch failed", {
      nodeId: document.node.nodeId,
      error: toErrorMessage(error),
    });
  }

  if (!isTextDownloadCandidate(document.node)) {
    return { source: "metadata-only" };
  }

  try {
    const dentry = await client.resolveDentryByUuid(document.node.nodeId);
    const dentryId = asString(dentry?.dentryId);
    const spaceId = asString(dentry?.spaceId);
    if (!dentryId || !spaceId) {
      return { source: "metadata-only" };
    }
    const downloadInfo = await client.getFileDownloadInfo(spaceId, dentryId);
    const resourceUrl = downloadInfo?.resourceUrls[0];
    if (!resourceUrl) {
      return { source: "metadata-only" };
    }
    const downloaded = await client.downloadText(resourceUrl, downloadInfo?.headers);
    if (downloaded) {
      return {
        content: downloaded,
        source: "storage-download",
      };
    }
  } catch (error) {
    logger?.warn?.("dingtalk-connector: storage download fallback failed", {
      nodeId: document.node.nodeId,
      error: toErrorMessage(error),
    });
  }

  return { source: "metadata-only" };
}

async function syncSingleWorkspace(params: {
  account: ResolvedDingtalkConnectorAccount;
  client: DingtalkConnectorKnowledgeBaseClient;
  workspace: RawWorkspace;
  outputRootDir: string;
  maxNodesPerWorkspace: number;
  logger?: Logger;
}): Promise<DingTalkKnowledgeBaseSyncWorkspaceResult> {
  const syncedAt = new Date().toISOString();
  const collection = await collectWorkspaceDocuments({
    client: params.client,
    workspace: params.workspace,
    maxNodesPerWorkspace: params.maxNodesPerWorkspace,
  });

  const workspaceDirName = sanitizeFileSegment(params.workspace.workspaceId, "workspace");
  const outputDir = path.join(params.outputRootDir, workspaceDirName);
  const tempDir = `${outputDir}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });

  let metadataOnlyDocuments = 0;

  try {
    for (const document of collection.documents) {
      const content = await resolveNodeContent({
        client: params.client,
        document,
        logger: params.logger,
      });
      if (!content.content) {
        metadataOnlyDocuments += 1;
      }
      const fileName = `${sanitizeFileSegment(document.node.name, "document")}--${sanitizeFileSegment(
        document.node.nodeId,
        "node",
      )}.md`;
      const filePath = path.join(tempDir, fileName);
      const markdown = buildMarkdownDocument({
        account: params.account,
        workspace: params.workspace,
        document,
        syncedAt,
        content: content.content,
        contentSource: content.source,
      });
      await fs.writeFile(filePath, markdown, "utf-8");
    }

    const workspaceIndexPath = path.join(tempDir, "_workspace-index.md");
    await fs.writeFile(
      workspaceIndexPath,
      buildWorkspaceIndex({
        account: params.account,
        workspace: params.workspace,
        syncedAt,
        collection,
        metadataOnlyDocuments,
      }),
      "utf-8",
    );

    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.rename(tempDir, outputDir);
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }

  return {
    workspaceId: params.workspace.workspaceId,
    name: toSingleLine(params.workspace.name, params.workspace.workspaceId),
    outputDir,
    visitedNodes: collection.visitedNodes,
    documentsWritten: collection.documents.length,
    metadataOnlyDocuments,
    truncated: collection.truncated,
  };
}

function normalizeKnowledgeSyncConfig(value: unknown): KnowledgeSyncConfig {
  const raw = isRecord(value) ? value : {};
  const normalized: KnowledgeSyncConfig = {
    ...(asBoolean(raw.enabled) !== undefined ? { enabled: asBoolean(raw.enabled) } : {}),
    ...(asString(raw.operatorId) ? { operatorId: asString(raw.operatorId) } : {}),
    ...(asString(raw.targetAgentId) ? { targetAgentId: asString(raw.targetAgentId) } : {}),
    ...(normalizeStringArray(raw.workspaceIds).length > 0
      ? { workspaceIds: normalizeStringArray(raw.workspaceIds) }
      : {}),
    ...(asNumber(raw.maxWorkspaces) && asNumber(raw.maxWorkspaces)! > 0
      ? { maxWorkspaces: Math.floor(asNumber(raw.maxWorkspaces)!) }
      : {}),
    ...(asNumber(raw.maxNodesPerWorkspace) && asNumber(raw.maxNodesPerWorkspace)! > 0
      ? { maxNodesPerWorkspace: Math.floor(asNumber(raw.maxNodesPerWorkspace)!) }
      : {}),
  };
  return normalized;
}

function mergeKnowledgeSyncConfig(
  base: KnowledgeSyncConfig,
  override: KnowledgeSyncConfig,
): KnowledgeSyncConfig {
  return {
    ...base,
    ...override,
    workspaceIds:
      (override.workspaceIds ?? []).length > 0 ? override.workspaceIds : base.workspaceIds,
  };
}

function resolveNormalizedAccountRecord(
  accounts: JsonRecord,
  accountId: string,
): { key: string; value: JsonRecord } | null {
  for (const [key, value] of Object.entries(accounts)) {
    if (normalizeAccountId(key) !== accountId || !isRecord(value)) {
      continue;
    }
    return { key, value };
  }
  return null;
}

function resolveDingtalkConnectorDefaultAccountId(channelConfig: JsonRecord): string {
  const explicitDefault = asString(channelConfig.defaultAccount);
  if (explicitDefault) {
    return normalizeAccountId(explicitDefault);
  }
  const accounts = isRecord(channelConfig.accounts) ? channelConfig.accounts : {};
  const accountIds = Object.keys(accounts)
    .map((key) => normalizeAccountId(key))
    .filter(Boolean)
    .toSorted((left, right) => left.localeCompare(right));
  if (accountIds.length === 0) {
    return DEFAULT_ACCOUNT_ID;
  }
  if (accountIds.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return accountIds[0] ?? DEFAULT_ACCOUNT_ID;
}

async function resolveDingtalkConnectorAccount(
  cfg: OpenClawConfig,
  requestedAccountId: string | undefined,
): Promise<ResolvedDingtalkConnectorAccount> {
  const channelConfig = isRecord(cfg.channels?.[DINGTALK_CONNECTOR_CHANNEL_ID])
    ? (cfg.channels?.[DINGTALK_CONNECTOR_CHANNEL_ID])
    : {};
  const accounts = isRecord(channelConfig.accounts) ? channelConfig.accounts : {};
  const accountId = requestedAccountId
    ? normalizeAccountId(requestedAccountId)
    : resolveDingtalkConnectorDefaultAccountId(channelConfig);
  const accountRecord = resolveNormalizedAccountRecord(accounts, accountId);
  const baseEnabled = channelConfig.enabled !== false;
  const accountEnabled = accountRecord?.value.enabled !== false;
  const enabled = baseEnabled && accountEnabled;

  const clientIdRaw =
    accountRecord && hasOwn(accountRecord.value, "clientId")
      ? accountRecord.value.clientId
      : channelConfig.clientId;
  const clientSecretRaw =
    accountRecord && hasOwn(accountRecord.value, "clientSecret")
      ? accountRecord.value.clientSecret
      : channelConfig.clientSecret;
  const clientSecretPath =
    accountRecord && hasOwn(accountRecord.value, "clientSecret")
      ? `channels.dingtalk-connector.accounts.${accountRecord.key}.clientSecret`
      : "channels.dingtalk-connector.clientSecret";
  const clientSecretResolution = await resolveConfiguredSecretInputString({
    config: cfg,
    env: process.env,
    value: clientSecretRaw,
    path: clientSecretPath,
  });

  const baseSync = normalizeKnowledgeSyncConfig(channelConfig.knowledgeBaseSync);
  const accountSync = normalizeKnowledgeSyncConfig(accountRecord?.value.knowledgeBaseSync);

  return {
    channelId: DINGTALK_CONNECTOR_CHANNEL_ID,
    accountId,
    name: asString(accountRecord?.value.name) ?? asString(channelConfig.name),
    enabled,
    configured: Boolean(asStringOrNumber(clientIdRaw) && clientSecretResolution.value),
    clientId: asStringOrNumber(clientIdRaw),
    clientSecret: clientSecretResolution.value,
    unresolvedSecretReason: clientSecretResolution.unresolvedRefReason,
    syncConfig: mergeKnowledgeSyncConfig(baseSync, accountSync),
  };
}

function resolveSyncSettings(params: {
  cfg: OpenClawConfig;
  account: ResolvedDingtalkConnectorAccount;
  input: {
    agentId?: string | null;
    operatorId?: string | null;
    workspaceIds?: string[] | null;
    maxWorkspaces?: number | null;
    maxNodesPerWorkspace?: number | null;
  };
}): SyncSettings {
  const syncConfig = params.account.syncConfig;
  const operatorId = asString(params.input.operatorId) ?? asString(syncConfig.operatorId);
  if (!operatorId) {
    throw new Error(
      "DingTalk KB sync requires operatorId. Set knowledgeBaseSync.operatorId or pass operatorId.",
    );
  }
  const agentId =
    asString(params.input.agentId) ??
    asString(syncConfig.targetAgentId) ??
    resolveDefaultAgentId(params.cfg);
  const workspaceIds =
    (params.input.workspaceIds ?? []).length > 0
      ? normalizeStringArray(params.input.workspaceIds)
      : normalizeStringArray(syncConfig.workspaceIds);
  return {
    accountId: params.account.accountId,
    agentId,
    operatorId,
    workspaceIds,
    maxWorkspaces: resolvePositiveInteger(
      params.input.maxWorkspaces ?? syncConfig.maxWorkspaces,
      DEFAULT_MAX_WORKSPACES,
    ),
    maxNodesPerWorkspace: resolvePositiveInteger(
      params.input.maxNodesPerWorkspace ?? syncConfig.maxNodesPerWorkspace,
      DEFAULT_MAX_NODES_PER_WORKSPACE,
    ),
  };
}

async function resolveWorkspaceDir(cfg: OpenClawConfig, agentId: string): Promise<string> {
  const knownAgents = new Set(listAgentIds(cfg));
  if (!knownAgents.has(agentId)) {
    throw new Error(`Unknown agent "${agentId}".`);
  }
  const configuredWorkspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  const workspace = await ensureAgentWorkspace({
    dir: configuredWorkspaceDir,
  });
  return workspace.dir;
}

async function syncDingtalkConnectorKnowledgeBase(params: {
  cfg: OpenClawConfig;
  account: ResolvedDingtalkConnectorAccount;
  input: {
    agentId?: string | null;
    operatorId?: string | null;
    workspaceIds?: string[] | null;
    maxWorkspaces?: number | null;
    maxNodesPerWorkspace?: number | null;
  };
  fetchImpl?: typeof fetch;
  logger?: Logger;
}): Promise<DingTalkKnowledgeBaseSyncResult> {
  if (!params.account.enabled) {
    throw new Error(`DingTalk account "${params.account.accountId}" is disabled.`);
  }
  if (!params.account.clientId) {
    throw new Error(`DingTalk account "${params.account.accountId}" is missing clientId.`);
  }
  if (!params.account.clientSecret) {
    throw new Error(
      params.account.unresolvedSecretReason ??
        `DingTalk account "${params.account.accountId}" is missing clientSecret.`,
    );
  }

  const settings = resolveSyncSettings({
    cfg: params.cfg,
    account: params.account,
    input: params.input,
  });
  const workspaceDir = await resolveWorkspaceDir(params.cfg, settings.agentId);
  const outputRootDir = path.join(
    workspaceDir,
    "memory",
    "dingtalk-kb",
    DINGTALK_CONNECTOR_CHANNEL_ID,
    normalizeAccountId(settings.accountId),
  );
  await fs.mkdir(outputRootDir, { recursive: true });

  const client = new DingtalkConnectorKnowledgeBaseClient({
    account: params.account,
    operatorId: settings.operatorId,
    fetchImpl: params.fetchImpl ?? fetch,
    logger: params.logger,
  });
  const startedAt = new Date().toISOString();

  const workspaces =
    settings.workspaceIds.length > 0
      ? await Promise.all(settings.workspaceIds.map((workspaceId) => client.getWorkspace(workspaceId)))
      : await client.listWorkspaces(settings.maxWorkspaces);

  const results: DingTalkKnowledgeBaseSyncWorkspaceResult[] = [];
  for (const workspace of workspaces) {
    if (!workspace.workspaceId) {
      continue;
    }
    results.push(
      await syncSingleWorkspace({
        account: params.account,
        client,
        workspace,
        outputRootDir,
        maxNodesPerWorkspace: settings.maxNodesPerWorkspace,
        logger: params.logger,
      }),
    );
  }

  const completedAt = new Date().toISOString();
  return {
    channelId: DINGTALK_CONNECTOR_CHANNEL_ID,
    accountId: settings.accountId,
    agentId: settings.agentId,
    operatorId: settings.operatorId,
    workspaceDir,
    outputRootDir,
    startedAt,
    completedAt,
    workspaces: results,
    totals: {
      workspaces: results.length,
      visitedNodes: results.reduce((sum, entry) => sum + entry.visitedNodes, 0),
      documentsWritten: results.reduce((sum, entry) => sum + entry.documentsWritten, 0),
      metadataOnlyDocuments: results.reduce((sum, entry) => sum + entry.metadataOnlyDocuments, 0),
    },
  };
}

function normalizeSyncParams(params: Record<string, unknown>) {
  return {
    accountId: asString(params.accountId),
    agentId: asString(params.agentId) ?? null,
    operatorId: asString(params.operatorId) ?? null,
    workspaceIds: normalizeStringArray(params.workspaceIds),
    maxWorkspaces:
      asNumber(params.maxWorkspaces) && asNumber(params.maxWorkspaces)! > 0
        ? Math.floor(asNumber(params.maxWorkspaces)!)
        : null,
    maxNodesPerWorkspace:
      asNumber(params.maxNodesPerWorkspace) && asNumber(params.maxNodesPerWorkspace)! > 0
        ? Math.floor(asNumber(params.maxNodesPerWorkspace)!)
        : null,
  };
}

function normalizeSyncedListParams(params: Record<string, unknown>) {
  return {
    agentId: asString(params.agentId) ?? null,
  };
}

function normalizeSyncedClearParams(params: Record<string, unknown>) {
  return {
    agentId: asString(params.agentId) ?? null,
  };
}

export const knowledgeHandlers: GatewayRequestHandlers = {
  "dingtalk-connector.kb.sync": async ({ params, respond, context }) => {
    try {
      const cfg = loadConfig();
      const input = normalizeSyncParams(params);
      const account = await resolveDingtalkConnectorAccount(cfg, input.accountId ?? undefined);
      const logger = context.logGateway;
      const result = await syncDingtalkConnectorKnowledgeBase({
        cfg,
        account,
        input,
        logger,
      });
      respond(true, result);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, error instanceof Error ? error.message : String(error)),
      );
    }
  },
  "knowledge.synced.list": async ({ params, respond }) => {
    try {
      const input = normalizeSyncedListParams(params);
      if (!input.agentId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "knowledge.synced.list requires agentId."),
        );
        return;
      }
      const cfg = loadConfig();
      const workspaceDir = await resolveWorkspaceDir(cfg, input.agentId);
      const result = await listSyncedKnowledgeData({
        agentId: input.agentId,
        workspaceDir,
      });
      respond(true, result);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, error instanceof Error ? error.message : String(error)),
      );
    }
  },
  "knowledge.synced.clear": async ({ params, respond }) => {
    try {
      const input = normalizeSyncedClearParams(params);
      if (!input.agentId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "knowledge.synced.clear requires agentId."),
        );
        return;
      }
      const cfg = loadConfig();
      const workspaceDir = await resolveWorkspaceDir(cfg, input.agentId);
      const result = await clearSyncedKnowledgeData({
        agentId: input.agentId,
        workspaceDir,
      });
      respond(true, result);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, error instanceof Error ? error.message : String(error)),
      );
    }
  },
};
