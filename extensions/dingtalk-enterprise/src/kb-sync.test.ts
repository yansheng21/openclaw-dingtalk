import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syncDingTalkKnowledgeBase } from "./kb-sync.js";

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

async function createWorkspaceDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "dingtalk-enterprise-kb-"));
}

async function readSyncedMarkdown(outputDir: string): Promise<string> {
  const entries = await fs.readdir(outputDir);
  const fileName = entries.find((entry) => entry.endsWith(".md") && entry !== "_workspace-index.md");
  if (!fileName) {
    throw new Error(`No synced markdown file found in ${outputDir}`);
  }
  return await fs.readFile(path.join(outputDir, fileName), "utf-8");
}

function createConfig(workspaceDir: string) {
  return {
    agents: {
      list: [
        {
          id: "kb-agent",
          default: true,
          workspace: workspaceDir,
        },
      ],
    },
    plugins: {
      entries: {
        "dingtalk-enterprise": {
          config: {
            clientId: "ding-client",
            clientSecret: "ding-secret",
            agentId: "ding-agent",
            knowledgeBaseSync: {
              enabled: true,
              operatorId: "union-1",
              targetAgentId: "kb-agent",
            },
          },
        },
      },
    },
  } as const;
}

function createRuntime(workspaceDir: string) {
  return {
    resolveAgentWorkspaceDir: () => workspaceDir,
    ensureAgentWorkspace: async (params?: { dir?: string }) => {
      const dir = params?.dir ?? workspaceDir;
      await fs.mkdir(dir, { recursive: true });
      return { dir };
    },
  };
}

const cleanupDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirs.splice(0, cleanupDirs.length).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("syncDingTalkKnowledgeBase", () => {
  it("writes wiki node content into the target agent memory directory and replaces stale files", async () => {
    const workspaceDir = await createWorkspaceDir();
    cleanupDirs.push(workspaceDir);
    const staleDir = path.join(workspaceDir, "memory", "dingtalk-kb", "default", "ws-1");
    await fs.mkdir(staleDir, { recursive: true });
    await fs.writeFile(path.join(staleDir, "stale.md"), "# stale\n", "utf-8");

    const fetchImpl = vi.fn(async (input: URL | RequestInfo | string, init?: RequestInit) => {
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
              modifiedTime: "2026-03-28T00:00:00Z",
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

    const result = await syncDingTalkKnowledgeBase({
      cfg: createConfig(workspaceDir) as never,
      runtime: createRuntime(workspaceDir),
      fetchImpl,
    });

    expect(result.totals.workspaces).toBe(1);
    expect(result.totals.visitedNodes).toBe(1);
    expect(result.totals.documentsWritten).toBe(1);
    expect(result.totals.metadataOnlyDocuments).toBe(0);

    const outputDir = path.join(workspaceDir, "memory", "dingtalk-kb", "default", "ws-1");
    const entries = await fs.readdir(outputDir);
    expect(entries).toContain("_workspace-index.md");
    expect(entries).not.toContain("stale.md");

    const markdown = await readSyncedMarkdown(outputDir);
    expect(markdown).toContain("差旅标准如下");
    expect(markdown).toContain("Workspace: 帮助中心");
  });

  it("falls back to the public storage download flow when wiki node content has no extracted text", async () => {
    const workspaceDir = await createWorkspaceDir();
    cleanupDirs.push(workspaceDir);

    const fetchImpl = vi.fn(async (input: URL | RequestInfo | string, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === "/v1.0/oauth2/accessToken") {
        return jsonResponse({ accessToken: "token-2", expireIn: 7200 });
      }
      if (url.pathname === "/v2.0/wiki/workspaces/ws-2") {
        return jsonResponse({
          workspace: {
            workspaceId: "ws-2",
            name: "销售知识库",
            rootNodeId: "root-2",
          },
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

    const result = await syncDingTalkKnowledgeBase({
      cfg: createConfig(workspaceDir) as never,
      runtime: createRuntime(workspaceDir),
      fetchImpl,
      workspaceIds: ["ws-2"],
    });

    expect(result.totals.workspaces).toBe(1);
    expect(result.totals.documentsWritten).toBe(1);
    expect(result.totals.metadataOnlyDocuments).toBe(0);

    const outputDir = path.join(workspaceDir, "memory", "dingtalk-kb", "default", "ws-2");
    const markdown = await readSyncedMarkdown(outputDir);
    expect(markdown).toContain("标准说法");
    expect(markdown).toContain("Extracted Via: storage-download");
  });

  it("skips direct content fetch for image nodes and keeps metadata only", async () => {
    const workspaceDir = await createWorkspaceDir();
    cleanupDirs.push(workspaceDir);

    let imageContentRequested = false;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo | string) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === "/v1.0/oauth2/accessToken") {
        return jsonResponse({ accessToken: "token-3", expireIn: 7200 });
      }
      if (url.pathname === "/v2.0/wiki/workspaces/ws-3") {
        return jsonResponse({
          workspace: {
            workspaceId: "ws-3",
            name: "素材库",
            rootNodeId: "root-3",
          },
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

    const result = await syncDingTalkKnowledgeBase({
      cfg: createConfig(workspaceDir) as never,
      runtime: createRuntime(workspaceDir),
      fetchImpl,
      workspaceIds: ["ws-3"],
    });

    expect(result.totals.workspaces).toBe(1);
    expect(result.totals.documentsWritten).toBe(1);
    expect(result.totals.metadataOnlyDocuments).toBe(1);
    expect(imageContentRequested).toBe(false);

    const outputDir = path.join(workspaceDir, "memory", "dingtalk-kb", "default", "ws-3");
    const markdown = await readSyncedMarkdown(outputDir);
    expect(markdown).toContain("Extracted Via: metadata-only");
    expect(markdown).toContain("海报.png");
  });
});
