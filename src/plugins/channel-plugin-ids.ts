import {
  hasMeaningfulChannelConfig,
  listPotentialConfiguredChannelIds,
} from "../channels/config-presence.js";
import type { OpenClawConfig } from "../config/config.js";
import { normalizePluginsConfig, resolveEffectiveEnableState } from "./config-state.js";
import { loadPluginManifestRegistry } from "./manifest-registry.js";

type ManifestRegistryPlugin = ReturnType<typeof loadPluginManifestRegistry>["plugins"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExplicitPluginConfig(cfg: OpenClawConfig, pluginId: string): boolean {
  const topLevelConfig = (cfg as Record<string, unknown>)[pluginId];
  if (hasMeaningfulChannelConfig(topLevelConfig)) {
    return true;
  }

  const plugins = isRecord(cfg.plugins) ? cfg.plugins : null;
  const entries = plugins && isRecord(plugins.entries) ? plugins.entries : null;
  const entry = entries && isRecord(entries[pluginId]) ? entries[pluginId] : null;
  if (entry?.enabled === true) {
    return true;
  }
  return hasMeaningfulChannelConfig(entry?.config);
}

function isConfiguredChannelPlugin(params: {
  plugin: ManifestRegistryPlugin;
  cfg: OpenClawConfig;
  configuredChannelIds: ReadonlySet<string>;
}): boolean {
  const { plugin, cfg, configuredChannelIds } = params;
  if (plugin.channels.some((channelId) => configuredChannelIds.has(channelId))) {
    return true;
  }
  if (plugin.channels.length === 0) {
    return false;
  }
  return hasExplicitPluginConfig(cfg, plugin.id);
}

export function resolveChannelPluginIds(params: {
  config: OpenClawConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  return loadPluginManifestRegistry({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  })
    .plugins.filter((plugin) => plugin.channels.length > 0)
    .map((plugin) => plugin.id);
}

export function resolveConfiguredChannelPluginIds(params: {
  config: OpenClawConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  const configuredChannelIds = new Set(
    listPotentialConfiguredChannelIds(params.config, params.env).map((id) => id.trim()),
  );
  return loadPluginManifestRegistry({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  })
    .plugins.filter(
      (plugin) =>
        plugin.channels.length > 0 &&
        isConfiguredChannelPlugin({
          plugin,
          cfg: params.config,
          configuredChannelIds,
        }),
    )
    .map((plugin) => plugin.id);
}

export function resolveConfiguredDeferredChannelPluginIds(params: {
  config: OpenClawConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  const configuredChannelIds = new Set(
    listPotentialConfiguredChannelIds(params.config, params.env).map((id) => id.trim()),
  );
  return loadPluginManifestRegistry({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  })
    .plugins.filter(
      (plugin) =>
        isConfiguredChannelPlugin({
          plugin,
          cfg: params.config,
          configuredChannelIds,
        }) &&
        plugin.startupDeferConfiguredChannelFullLoadUntilAfterListen === true,
    )
    .map((plugin) => plugin.id);
}

export function resolveGatewayStartupPluginIds(params: {
  config: OpenClawConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  const configuredChannelIds = new Set(
    listPotentialConfiguredChannelIds(params.config, params.env).map((id) => id.trim()),
  );
  const pluginsConfig = normalizePluginsConfig(params.config.plugins);
  const manifestRegistry = loadPluginManifestRegistry({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  });
  return manifestRegistry.plugins
    .filter((plugin) => {
      if (
        isConfiguredChannelPlugin({
          plugin,
          cfg: params.config,
          configuredChannelIds,
        })
      ) {
        return true;
      }
      if (plugin.channels.length > 0) {
        return false;
      }
      const enabled = resolveEffectiveEnableState({
        id: plugin.id,
        origin: plugin.origin,
        config: pluginsConfig,
        rootConfig: params.config,
        enabledByDefault: plugin.enabledByDefault,
      }).enabled;
      if (!enabled) {
        return false;
      }
      if (plugin.origin !== "bundled") {
        return true;
      }
      return (
        pluginsConfig.allow.includes(plugin.id) ||
        pluginsConfig.entries[plugin.id]?.enabled === true ||
        pluginsConfig.slots.memory === plugin.id
      );
    })
    .map((plugin) => plugin.id);
}
