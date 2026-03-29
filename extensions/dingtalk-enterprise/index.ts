import {
  defineChannelPluginEntry,
  type GatewayRequestHandlerOptions,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/core";
import { registerPluginHttpRoute } from "openclaw/plugin-sdk/webhook-ingress";
import { dingtalkEnterprisePlugin } from "./src/channel.js";
import {
  dingtalkEnterprisePluginConfigSchema,
} from "./src/config.js";
import {
  createDingTalkEnterpriseAdminHttpHandler,
  createDingTalkEnterpriseWebhookHttpHandler,
  previewDingTalkEnterpriseRuntime,
  resolveDingTalkEnterpriseWebhookRoutes,
} from "./src/http.js";
import { syncDingTalkKnowledgeBase } from "./src/kb-sync.js";
import { registerDingTalkEnterpriseCli } from "./src/cli.js";
import { runDingTalkEnterpriseStaticTest } from "./src/test-runner.js";

export { dingtalkEnterprisePlugin } from "./src/channel.js";

const DINGTALK_ENTERPRISE_PLUGIN_ID = "dingtalk-enterprise";
const activeWebhookRouteUnregisters = new Map<string, () => void>();

type DingTalkRuntimeConfig = Parameters<typeof resolveDingTalkEnterpriseWebhookRoutes>[0];
type DingTalkLogger = {
  info?: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
};

function syncDingTalkEnterpriseWebhookRoutes(params: {
  cfg: DingTalkRuntimeConfig;
  loadConfig: () => DingTalkRuntimeConfig;
  logger?: DingTalkLogger;
}) {
  const desiredRoutes = resolveDingTalkEnterpriseWebhookRoutes(params.cfg);
  const desiredPaths = new Set(desiredRoutes.map((route) => route.path));

  for (const [path, unregister] of activeWebhookRouteUnregisters) {
    if (desiredPaths.has(path)) {
      continue;
    }
    unregister();
    activeWebhookRouteUnregisters.delete(path);
  }

  for (const route of desiredRoutes) {
    const previous = activeWebhookRouteUnregisters.get(route.path);
    if (previous) {
      previous();
      activeWebhookRouteUnregisters.delete(route.path);
    }
    const unregister = registerPluginHttpRoute({
      path: route.path,
      auth: "plugin",
      replaceExisting: true,
      pluginId: DINGTALK_ENTERPRISE_PLUGIN_ID,
      ...(route.accountIdHint ? { accountId: route.accountIdHint } : {}),
      log: (message) => params.logger?.info?.(message),
      handler: createDingTalkEnterpriseWebhookHttpHandler({
        logger: params.logger,
        route,
        loadConfig: params.loadConfig,
      }),
    });
    activeWebhookRouteUnregisters.set(route.path, unregister);
  }
}

async function handleDingTalkEnterpriseTest(
  api: OpenClawPluginApi,
  { params, respond }: GatewayRequestHandlerOptions,
) {
  const logger = api.runtime.logging.getChildLogger({
    plugin: "dingtalk-enterprise",
    surface: "gateway-method",
  });
  const cfg = api.runtime.config.loadConfig();
  const result = await runDingTalkEnterpriseStaticTest({
    cfg,
    accountId:
      typeof params?.accountId === "string" && params.accountId.trim()
        ? params.accountId.trim()
        : undefined,
    timeoutMs: typeof params?.timeoutMs === "number" ? params.timeoutMs : undefined,
    logger,
  });
  respond(true, result);
}

function resolveGatewayWebhookKind(raw: unknown): "message" | "card" | "oa" {
  return raw === "card" || raw === "oa" ? raw : "message";
}

async function handleDingTalkEnterpriseResolveClaims(
  api: OpenClawPluginApi,
  { params, respond }: GatewayRequestHandlerOptions,
) {
  const cfg = api.runtime.config.loadConfig();
  const preview = previewDingTalkEnterpriseRuntime({
    cfg,
    kind: resolveGatewayWebhookKind(params?.kind),
    body:
      params && typeof params === "object" && "body" in params && params.body
        ? params.body
        : {},
    accountId:
      typeof params?.accountId === "string" && params.accountId.trim()
        ? params.accountId.trim()
        : undefined,
    receivedAt: typeof params?.receivedAt === "number" ? params.receivedAt : undefined,
  });
  respond(true, {
    claims: preview.claims,
    route: preview.route,
  });
}

async function handleDingTalkEnterprisePreviewPolicy(
  api: OpenClawPluginApi,
  { params, respond }: GatewayRequestHandlerOptions,
) {
  const cfg = api.runtime.config.loadConfig();
  const preview = previewDingTalkEnterpriseRuntime({
    cfg,
    kind: resolveGatewayWebhookKind(params?.kind),
    body:
      params && typeof params === "object" && "body" in params && params.body
        ? params.body
        : {},
    accountId:
      typeof params?.accountId === "string" && params.accountId.trim()
        ? params.accountId.trim()
        : undefined,
    receivedAt: typeof params?.receivedAt === "number" ? params.receivedAt : undefined,
  });
  respond(true, preview);
}

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .map((entry) => readTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return items.length > 0 ? items : undefined;
}

function readPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

async function handleDingTalkEnterpriseKnowledgeBaseSync(
  api: OpenClawPluginApi,
  { params, respond }: GatewayRequestHandlerOptions,
) {
  const cfg = api.runtime.config.loadConfig();
  const logger = api.runtime.logging.getChildLogger({
    plugin: "dingtalk-enterprise",
    surface: "kb-sync",
  });
  const result = await syncDingTalkKnowledgeBase({
    cfg,
    runtime: api.runtime.agent,
    accountId: readTrimmedString(params?.accountId),
    agentId: readTrimmedString(params?.agentId),
    operatorId: readTrimmedString(params?.operatorId),
    workspaceIds: readStringArray(params?.workspaceIds),
    maxWorkspaces: readPositiveNumber(params?.maxWorkspaces),
    maxNodesPerWorkspace:
      readPositiveNumber(params?.maxNodesPerWorkspace) ?? readPositiveNumber(params?.maxNodes),
    logger,
  });
  respond(true, result);
}

function sendGatewayError(
  api: OpenClawPluginApi,
  respond: GatewayRequestHandlerOptions["respond"],
  err: unknown,
) {
  const message = err instanceof Error ? err.message : String(err);
  api.logger.warn(`dingtalk-enterprise: gateway method failed: ${message}`);
  respond(false, { error: message });
}

export default defineChannelPluginEntry({
  id: "dingtalk-enterprise",
  name: "DingTalk Enterprise",
  description: "Enterprise DingTalk connector for DingClaw.",
  plugin: dingtalkEnterprisePlugin,
  configSchema: dingtalkEnterprisePluginConfigSchema,
  registerFull(api) {
    const adminLogger = api.runtime.logging.getChildLogger({
      plugin: "dingtalk-enterprise",
      surface: "admin-http",
    });
    const webhookLogger = api.runtime.logging.getChildLogger({
      plugin: "dingtalk-enterprise",
      surface: "webhook",
    });

    api.registerGatewayMethod(
      "dingtalk-enterprise.test",
      async (ctx: GatewayRequestHandlerOptions) => {
        try {
          await handleDingTalkEnterpriseTest(api, ctx);
        } catch (err) {
          sendGatewayError(api, ctx.respond, err);
        }
      },
    );
    api.registerGatewayMethod(
      "dingtalk-enterprise.resolve-claims",
      async (ctx: GatewayRequestHandlerOptions) => {
        try {
          await handleDingTalkEnterpriseResolveClaims(api, ctx);
        } catch (err) {
          sendGatewayError(api, ctx.respond, err);
        }
      },
    );
    api.registerGatewayMethod(
      "dingtalk-enterprise.preview-policy",
      async (ctx: GatewayRequestHandlerOptions) => {
        try {
          await handleDingTalkEnterprisePreviewPolicy(api, ctx);
        } catch (err) {
          sendGatewayError(api, ctx.respond, err);
        }
      },
    );
    api.registerGatewayMethod(
      "dingtalk-enterprise.kb.sync",
      async (ctx: GatewayRequestHandlerOptions) => {
        try {
          await handleDingTalkEnterpriseKnowledgeBaseSync(api, ctx);
        } catch (err) {
          sendGatewayError(api, ctx.respond, err);
        }
      },
    );

    api.registerCli(
      ({ program }) => {
        registerDingTalkEnterpriseCli({
          program,
          runtime: {
            config: api.runtime.config,
            agent: api.runtime.agent,
          },
          logger: api.runtime.logging.getChildLogger({
            plugin: "dingtalk-enterprise",
            surface: "cli",
          }),
        });
      },
      { commands: ["dingtalk-enterprise"] },
    );

    api.registerHttpRoute({
      path: "/api/admin/connectors/dingtalk",
      auth: "gateway",
      match: "prefix",
      handler: createDingTalkEnterpriseAdminHttpHandler({
        loadConfig: () => api.runtime.config.loadConfig(),
        writeConfig: (nextConfig) => api.runtime.config.writeConfigFile(nextConfig),
        syncWebhookRoutes: (nextConfig) =>
          syncDingTalkEnterpriseWebhookRoutes({
            cfg: nextConfig,
            loadConfig: () => api.runtime.config.loadConfig(),
            logger: webhookLogger,
          }),
        logger: adminLogger,
      }),
    });

    syncDingTalkEnterpriseWebhookRoutes({
      cfg: api.runtime.config.loadConfig(),
      loadConfig: () => api.runtime.config.loadConfig(),
      logger: webhookLogger,
    });
  },
});
