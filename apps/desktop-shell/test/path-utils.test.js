import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  buildGatewayCommand,
  DEFAULT_GATEWAY_PORT,
  findExecutableInPath,
  resolveDesktopShellPathsFromFile,
} from "../src/path-utils.js";

test("resolveDesktopShellPathsFromFile resolves repo layout", () => {
  const resolved = resolveDesktopShellPathsFromFile("/repo/apps/desktop-shell/src/main.js");

  assert.equal(resolved.packageRoot, "/repo/apps/desktop-shell");
  assert.equal(resolved.repoRoot, "/repo");
  assert.equal(resolved.runNodeScript, "/repo/scripts/run-node.mjs");
  assert.equal(resolved.rendererHtml, "/repo/apps/desktop-shell/src/renderer/index.html");
  assert.equal(resolved.preloadScript, "/repo/apps/desktop-shell/src/preload.js");
});

test("findExecutableInPath returns null when candidate is absent", () => {
  const fakePath = ["/usr/local/bin", "/opt/bin"].join(path.delimiter);
  assert.equal(findExecutableInPath("definitely-missing", fakePath, "linux"), null);
});

test("buildGatewayCommand uses provided runtime and default port", () => {
  const command = buildGatewayCommand(
    {
      repoRoot: "/repo",
      runNodeScript: "/repo/scripts/run-node.mjs",
    },
    {
      runtimePath: "/custom/node",
      port: DEFAULT_GATEWAY_PORT,
    },
  );

  assert.equal(command.command, "/custom/node");
  assert.equal(command.cwd, "/repo");
  assert.deepEqual(command.args, [
    "/repo/scripts/run-node.mjs",
    "gateway",
    "--port",
    String(DEFAULT_GATEWAY_PORT),
    "--verbose",
  ]);
});
