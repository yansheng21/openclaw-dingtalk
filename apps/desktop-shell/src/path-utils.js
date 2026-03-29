import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const DEFAULT_GATEWAY_PORT = 18789;

/**
 * Resolve desktop-shell, repo and gateway script paths from the current file.
 */
export function resolveDesktopShellPathsFromFile(filePath) {
  const srcDir = path.dirname(filePath);
  const packageRoot = path.resolve(srcDir, "..");
  const repoRoot = path.resolve(packageRoot, "..", "..");

  return {
    packageRoot,
    repoRoot,
    runNodeScript: path.join(repoRoot, "scripts", "run-node.mjs"),
    rendererHtml: path.join(packageRoot, "src", "renderer", "index.html"),
    preloadScript: path.join(packageRoot, "src", "preload.js"),
  };
}

export function resolveDesktopShellPaths(importMetaUrl) {
  return resolveDesktopShellPathsFromFile(fileURLToPath(importMetaUrl));
}

function resolveWindowsExecutableCandidate(basePath) {
  if (path.extname(basePath).length > 0) {
    return [basePath];
  }
  return [basePath, `${basePath}.exe`, `${basePath}.cmd`, `${basePath}.bat`];
}

export function findExecutableInPath(
  executableName,
  envPath = process.env.PATH ?? "",
  platform = process.platform,
) {
  const entries = envPath.split(path.delimiter).filter(Boolean);
  for (const entry of entries) {
    const candidate = path.join(entry, executableName);
    const variants =
      platform === "win32" ? resolveWindowsExecutableCandidate(candidate) : [candidate];
    for (const variant of variants) {
      try {
        fs.accessSync(variant, fs.constants.X_OK);
        return variant;
      } catch {
        // ignore missing candidates
      }
    }
  }
  return null;
}

export function resolveNodeRuntime(
  embeddedRoot = "",
  env = process.env,
  platform = process.platform,
) {
  const override = env.OPENCLAW_DESKTOP_NODE_PATH?.trim();
  if (override) {
    return override;
  }

  const embeddedName = platform === "win32" ? "node.exe" : "node";
  const embeddedCandidates = [
    embeddedRoot ? path.join(embeddedRoot, "runtime", embeddedName) : null,
    embeddedRoot ? path.join(embeddedRoot, embeddedName) : null,
  ].filter(Boolean);
  for (const candidate of embeddedCandidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // ignore embedded candidates that are not ready yet
    }
  }

  return findExecutableInPath("node", env.PATH ?? "", platform) ?? "node";
}

export function buildGatewayCommand(
  paths,
  opts = {
    port: DEFAULT_GATEWAY_PORT,
    runtimePath: undefined,
    embeddedRoot: "",
  },
) {
  const port = opts.port ?? DEFAULT_GATEWAY_PORT;
  const runtimePath =
    opts.runtimePath ??
    resolveNodeRuntime(opts.embeddedRoot ?? "", process.env, process.platform);

  return {
    command: runtimePath,
    args: [paths.runNodeScript, "gateway", "--port", String(port), "--verbose"],
    cwd: paths.repoRoot,
  };
}
