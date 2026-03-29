import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectOk, installGatewayTestHooks, rpcReq } from "../test-helpers.js";
import { withServer } from "../test-with-server.js";

installGatewayTestHooks({ scope: "suite" });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
    },
  });
}

async function readSyncedMarkdown(outputDir: string): Promise<string> {
  const entries = await fs.readdir(outputDir);
  const fileName = entries.find((entry) => entry.endsWith(".md") && entry !== "_workspace-index.md");
  if (!fileName) {
    throw new Error(`No synced markdown file found in ${outputDir}`);
  }
  return await fs.readFile(path.join(outputDir, fileName), "utf-8");
}

const cleanupDirs: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    cleanupDirs.splice(0, cleanupDirs.length).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("gateway dingtalk-connector.kb.sync", () => {
  it("syncs DingTalk knowledge base content into the selected agent workspace", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "dingtalk-connector-kb-"));
    cleanupDirs.push(workspaceDir);

    const fetchImpl = vi.fn(async (input: URL | RequestInfo | string) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === "/v1.0/oauth2/accessToken") {
        return jsonResponse({ accessToken: "token-1", expireIn: 7200 });
      }
      if (url.pathname === "/v2.0/wiki/workspaces") {
        return jsonResponse({
          workspaces: [
            {
              workspaceId: "ws-1",
              name: "帮助中心",
              rootNodeId: "root-1",
            },
          ],
        });
      }
      if (url.pathname === "/v2.0/wiki/nodes" && url.searchParams.get("parentNodeId") === "root-1") {
        return jsonResponse({
          nodes: [
            {
              nodeId: "doc-1",
              name: "报销规则",
              type: "FILE",
              hasChildren: false,
              workspaceId: "ws-1",
              url: "https://alidocs.dingtalk.com/i/nodes/doc-1",
            },
          ],
        });
      }
      if (url.pathname === "/v2.0/wiki/nodes/doc-1/content") {
        return jsonResponse({
          markdown: "# 报销规则\n\n差旅标准如下。",
        });
      }
      throw new Error(`Unexpected fetch: ${url.href}`);
    });

    vi.stubGlobal("fetch", fetchImpl);

    const { writeConfigFile } = await import("../../config/config.js");
    await writeConfigFile({
      agents: {
        list: [
          {
            id: "kb-agent",
            default: true,
            workspace: workspaceDir,
          },
        ],
      },
      channels: {
        "dingtalk-connector": {
          clientId: "ding-client",
          clientSecret: "ding-secret",
          knowledgeBaseSync: {
            enabled: true,
            operatorId: "union-1",
            targetAgentId: "kb-agent",
          },
        },
      },
    });

    await withServer(async (ws) => {
      await connectOk(ws, { token: "secret", scopes: ["operator.write"] });
      const res = await rpcReq<{
        accountId?: string;
        channelId?: string;
        outputRootDir?: string;
        totals?: { documentsWritten?: number; workspaces?: number };
      }>(ws, "dingtalk-connector.kb.sync", {});

      expect(res.ok).toBe(true);
      expect(res.payload?.channelId).toBe("dingtalk-connector");
      expect(res.payload?.accountId).toBe("default");
      expect(res.payload?.totals?.workspaces).toBe(1);
      expect(res.payload?.totals?.documentsWritten).toBe(1);

      const outputDir = path.join(
        workspaceDir,
        "memory",
        "dingtalk-kb",
        "dingtalk-connector",
        "default",
        "ws-1",
      );
      const markdown = await readSyncedMarkdown(outputDir);
      expect(markdown).toContain("差旅标准如下");
      expect(markdown).toContain("Channel: dingtalk-connector");
    });
  });

  it("uses the public storage download fallback for text files when wiki node content is empty", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "dingtalk-connector-kb-"));
    cleanupDirs.push(workspaceDir);

    const fetchImpl = vi.fn(async (input: URL | RequestInfo | string, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === "/v1.0/oauth2/accessToken") {
        return jsonResponse({ accessToken: "token-2", expireIn: 7200 });
      }
      if (url.pathname === "/v2.0/wiki/workspaces") {
        return jsonResponse({
          workspaces: [
            {
              workspaceId: "ws-2",
              name: "销售知识库",
              rootNodeId: "root-2",
            },
          ],
        });
      }
      if (url.pathname === "/v2.0/wiki/nodes" && url.searchParams.get("parentNodeId") === "root-2") {
        return jsonResponse({
          nodes: [
            {
              nodeId: "doc-2",
              name: "销售手册",
              type: "FILE",
              category: "DOCUMENT",
              extension: "md",
              hasChildren: false,
              workspaceId: "ws-2",
            },
          ],
        });
      }
      if (url.pathname === "/v2.0/wiki/nodes/doc-2/content") {
        return jsonResponse({
          node: {
            nodeId: "doc-2",
            name: "销售手册",
          },
        });
      }
      if (url.pathname === "/v2.0/doc/dentries/doc-2/queryDentryId") {
        return jsonResponse({
          dentryUuid: "doc-2",
          dentryId: "dentry-2",
          spaceId: "space-2",
        });
      }
      if (url.pathname === "/v1.0/storage/spaces/space-2/dentries/dentry-2/downloadInfos/query") {
        return jsonResponse({
          headerSignatureInfo: {
            resourceUrls: ["https://download.example/doc-2.md"],
            headers: {
              authorization: "Bearer signed-token",
            },
          },
        });
      }
      if (url.hostname === "download.example" && url.pathname === "/doc-2.md") {
        const headers = new Headers(init?.headers);
        expect(headers.get("authorization")).toBe("Bearer signed-token");
        return textResponse("# 销售手册\n\n标准说法。");
      }
      throw new Error(`Unexpected fetch: ${url.href}`);
    });

    vi.stubGlobal("fetch", fetchImpl);

    const { writeConfigFile } = await import("../../config/config.js");
    await writeConfigFile({
      agents: {
        list: [
          {
            id: "kb-agent",
            default: true,
            workspace: workspaceDir,
          },
        ],
      },
      channels: {
        "dingtalk-connector": {
          clientId: "ding-client",
          clientSecret: "ding-secret",
          knowledgeBaseSync: {
            enabled: true,
            operatorId: "union-1",
            targetAgentId: "kb-agent",
          },
        },
      },
    });

    await withServer(async (ws) => {
      await connectOk(ws, { token: "secret", scopes: ["operator.write"] });
      const res = await rpcReq<{
        outputRootDir?: string;
        totals?: { documentsWritten?: number; metadataOnlyDocuments?: number };
      }>(ws, "dingtalk-connector.kb.sync", {});

      expect(res.ok).toBe(true);
      expect(res.payload?.totals?.documentsWritten).toBe(1);
      expect(res.payload?.totals?.metadataOnlyDocuments).toBe(0);

      const outputDir = path.join(
        workspaceDir,
        "memory",
        "dingtalk-kb",
        "dingtalk-connector",
        "default",
        "ws-2",
      );
      const markdown = await readSyncedMarkdown(outputDir);
      expect(markdown).toContain("标准说法");
      expect(markdown).toContain("Extracted Via: storage-download");
    });
  });

  it("lists synced knowledge data from the selected agent workspace", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "dingtalk-connector-kb-"));
    cleanupDirs.push(workspaceDir);

    const fetchImpl = vi.fn(async (input: URL | RequestInfo | string) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === "/v1.0/oauth2/accessToken") {
        return jsonResponse({ accessToken: "token-4", expireIn: 7200 });
      }
      if (url.pathname === "/v2.0/wiki/workspaces") {
        return jsonResponse({
          workspaces: [
            {
              workspaceId: "ws-4",
              name: "产品知识库",
              rootNodeId: "root-4",
            },
          ],
        });
      }
      if (url.pathname === "/v2.0/wiki/nodes" && url.searchParams.get("parentNodeId") === "root-4") {
        return jsonResponse({
          nodes: [
            {
              nodeId: "doc-4",
              name: "价格策略",
              type: "FILE",
              hasChildren: false,
              workspaceId: "ws-4",
              url: "https://alidocs.dingtalk.com/i/nodes/doc-4",
            },
          ],
        });
      }
      if (url.pathname === "/v2.0/wiki/nodes/doc-4/content") {
        return jsonResponse({
          markdown: "# 价格策略\n\n核心内容。",
        });
      }
      throw new Error(`Unexpected fetch: ${url.href}`);
    });

    vi.stubGlobal("fetch", fetchImpl);

    const { writeConfigFile } = await import("../../config/config.js");
    await writeConfigFile({
      agents: {
        list: [
          {
            id: "kb-agent",
            default: true,
            workspace: workspaceDir,
          },
        ],
      },
      channels: {
        "dingtalk-connector": {
          clientId: "ding-client",
          clientSecret: "ding-secret",
          knowledgeBaseSync: {
            enabled: true,
            operatorId: "union-1",
            targetAgentId: "kb-agent",
          },
        },
      },
    });

    await withServer(async (ws) => {
      await connectOk(ws, { token: "secret", scopes: ["operator.write"] });
      const syncRes = await rpcReq(ws, "dingtalk-connector.kb.sync", {});
      expect(syncRes.ok).toBe(true);

      const listRes = await rpcReq<{
        workspaceCount?: number;
        documentCount?: number;
        workspaces?: Array<{ workspaceName?: string; channelId?: string; accountId?: string }>;
        recentDocuments?: Array<{ title?: string; preview?: string; extractedVia?: string }>;
      }>(ws, "knowledge.synced.list", {
        agentId: "kb-agent",
      });

      expect(listRes.ok).toBe(true);
      expect(listRes.payload?.workspaceCount).toBe(1);
      expect(listRes.payload?.documentCount).toBe(1);
      expect(listRes.payload?.workspaces?.[0]).toMatchObject({
        workspaceName: "产品知识库",
        channelId: "dingtalk-connector",
        accountId: "default",
      });
      expect(listRes.payload?.recentDocuments?.[0]).toMatchObject({
        title: "价格策略",
        extractedVia: "node-content",
      });
      expect(listRes.payload?.recentDocuments?.[0]?.preview).toContain("核心内容");
    });
  });

  it("treats Chinese metadata-only placeholders as synced metadata without preview", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "dingtalk-kb-list-"));
    cleanupDirs.push(workspaceDir);

    const outputDir = path.join(
      workspaceDir,
      "memory",
      "dingtalk-kb",
      "dingtalk-enterprise",
      "enterprise-1",
      "workspace-cn",
    );
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, "_workspace-index.md"),
      [
        "# 企业知识库",
        "",
        "- Source: DingTalk knowledge base sync",
        "- Account: 企业机器人",
        "- Workspace ID: workspace-cn",
        "- Root Node ID: root-cn",
        "- Synced At: 2026-03-29T00:00:00.000Z",
        "- Visited Nodes: 1",
        "- Documents: 1",
        "- Metadata-only Documents: 1",
        "- Truncated: no",
        "",
        "## Documents",
        "",
        "- 图片素材 | node-cn | 企业知识库 / 图片素材",
        "",
      ].join("\n"),
      "utf-8",
    );
    await fs.writeFile(
      path.join(outputDir, "图片素材--node-cn.md"),
      [
        "# 图片素材",
        "",
        "- Source: DingTalk knowledge base sync",
        "- Account: 企业机器人",
        "- Workspace: 企业知识库",
        "- Workspace ID: workspace-cn",
        "- Node ID: node-cn",
        "- Type: FILE",
        "- Category: IMAGE",
        "- Path: 企业知识库 / 图片素材",
        "- URL: https://example.invalid/node-cn",
        "- Synced At: 2026-03-29T00:00:00.000Z",
        "- Extracted Via: metadata-only",
        "",
        "## Content",
        "",
        "_未提取到正文；当前仅同步了文档元信息。_",
        "",
      ].join("\n"),
      "utf-8",
    );

    const { writeConfigFile } = await import("../../config/config.js");
    await writeConfigFile({
      agents: {
        list: [
          {
            id: "kb-agent",
            default: true,
            workspace: workspaceDir,
          },
        ],
      },
    });

    await withServer(async (ws) => {
      await connectOk(ws, { token: "secret", scopes: ["operator.read"] });
      const listRes = await rpcReq<{
        workspaceCount?: number;
        documentCount?: number;
        recentDocuments?: Array<{ title?: string; preview?: string; metadataOnly?: boolean }>;
      }>(ws, "knowledge.synced.list", {
        agentId: "kb-agent",
      });

      expect(listRes.ok).toBe(true);
      expect(listRes.payload?.workspaceCount).toBe(1);
      expect(listRes.payload?.documentCount).toBe(1);
      expect(listRes.payload?.recentDocuments?.[0]).toMatchObject({
        title: "图片素材",
        metadataOnly: true,
      });
      expect(listRes.payload?.recentDocuments?.[0]?.preview).toBeUndefined();
    });
  });

  it("clears synced knowledge cache from the selected agent workspace", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "dingtalk-kb-clear-"));
    cleanupDirs.push(workspaceDir);

    const outputDir = path.join(
      workspaceDir,
      "memory",
      "dingtalk-kb",
      "dingtalk-connector",
      "relay-main",
      "workspace-1",
    );
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, "_workspace-index.md"),
      [
        "# 销售知识库",
        "",
        "- Source: DingTalk knowledge base sync",
        "- Channel: dingtalk-connector",
        "- Account: 总部知识库",
        "- Workspace ID: workspace-1",
        "- Root Node ID: root-1",
        "- Synced At: 2026-03-29T00:00:00.000Z",
        "- Visited Nodes: 3",
        "- Documents: 2",
        "- Metadata-only Documents: 1",
        "- Truncated: no",
        "",
        "## Documents",
        "",
        "- 文档一 | node-1 | 销售知识库 / 文档一",
        "",
      ].join("\n"),
      "utf-8",
    );
    await fs.writeFile(
      path.join(outputDir, "文档一--node-1.md"),
      [
        "# 文档一",
        "",
        "- Source: DingTalk knowledge base sync",
        "- Channel: dingtalk-connector",
        "- Account: 总部知识库",
        "- Workspace: 销售知识库",
        "- Workspace ID: workspace-1",
        "- Node ID: node-1",
        "- Type: FILE",
        "- Category: DOCUMENT",
        "- Path: 销售知识库 / 文档一",
        "- URL: https://example.invalid/node-1",
        "- Synced At: 2026-03-29T00:00:00.000Z",
        "- Extracted Via: node-content",
        "",
        "## Content",
        "",
        "正文。",
        "",
      ].join("\n"),
      "utf-8",
    );

    const { writeConfigFile } = await import("../../config/config.js");
    await writeConfigFile({
      agents: {
        list: [
          {
            id: "kb-agent",
            default: true,
            workspace: workspaceDir,
          },
        ],
      },
    });

    await withServer(async (ws) => {
      await connectOk(ws, { token: "secret", scopes: ["operator.write"] });

      const clearRes = await rpcReq<{
        existed?: boolean;
        clearedWorkspaceCount?: number;
        clearedDocumentCount?: number;
      }>(ws, "knowledge.synced.clear", {
        agentId: "kb-agent",
      });

      expect(clearRes.ok).toBe(true);
      expect(clearRes.payload).toMatchObject({
        existed: true,
        clearedWorkspaceCount: 1,
        clearedDocumentCount: 2,
      });

      const rootDir = path.join(workspaceDir, "memory", "dingtalk-kb");
      await expect(fs.stat(rootDir)).rejects.toThrow();
    });
  });

  it("skips direct content fetch for image nodes and syncs metadata only", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "dingtalk-connector-kb-"));
    cleanupDirs.push(workspaceDir);

    let imageContentRequested = false;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo | string) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === "/v1.0/oauth2/accessToken") {
        return jsonResponse({ accessToken: "token-3", expireIn: 7200 });
      }
      if (url.pathname === "/v2.0/wiki/workspaces") {
        return jsonResponse({
          workspaces: [
            {
              workspaceId: "ws-3",
              name: "素材库",
              rootNodeId: "root-3",
            },
          ],
        });
      }
      if (url.pathname === "/v2.0/wiki/nodes" && url.searchParams.get("parentNodeId") === "root-3") {
        return jsonResponse({
          nodes: [
            {
              nodeId: "img-1",
              name: "海报.png",
              type: "FILE",
              category: "IMAGE",
              extension: "png",
              hasChildren: false,
              workspaceId: "ws-3",
              url: "https://alidocs.dingtalk.com/i/nodes/img-1",
            },
          ],
        });
      }
      if (url.pathname === "/v2.0/wiki/nodes/img-1/content") {
        imageContentRequested = true;
        throw new Error("image content endpoint should not be requested");
      }
      throw new Error(`Unexpected fetch: ${url.href}`);
    });

    vi.stubGlobal("fetch", fetchImpl);

    const { writeConfigFile } = await import("../../config/config.js");
    await writeConfigFile({
      agents: {
        list: [
          {
            id: "kb-agent",
            default: true,
            workspace: workspaceDir,
          },
        ],
      },
      channels: {
        "dingtalk-connector": {
          clientId: "ding-client",
          clientSecret: "ding-secret",
          knowledgeBaseSync: {
            enabled: true,
            operatorId: "union-1",
            targetAgentId: "kb-agent",
          },
        },
      },
    });

    await withServer(async (ws) => {
      await connectOk(ws, { token: "secret", scopes: ["operator.write"] });
      const res = await rpcReq<{
        totals?: { documentsWritten?: number; metadataOnlyDocuments?: number };
      }>(ws, "dingtalk-connector.kb.sync", {});

      expect(res.ok).toBe(true);
      expect(res.payload?.totals?.documentsWritten).toBe(1);
      expect(res.payload?.totals?.metadataOnlyDocuments).toBe(1);
      expect(imageContentRequested).toBe(false);

      const outputDir = path.join(
        workspaceDir,
        "memory",
        "dingtalk-kb",
        "dingtalk-connector",
        "default",
        "ws-3",
      );
      const markdown = await readSyncedMarkdown(outputDir);
      expect(markdown).toContain("Extracted Via: metadata-only");
      expect(markdown).toContain("海报.png");
    });
  });
});
