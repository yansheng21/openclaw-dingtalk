import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { buildGatewayCommand, DEFAULT_GATEWAY_PORT, resolveDesktopShellPaths } from "./path-utils.js";

const paths = resolveDesktopShellPaths(import.meta.url);
const LOG_LIMIT = 120_000;
const HEALTH_POLL_MS = 2_000;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let adminWindow = null;
/** @type {import("node:child_process").ChildProcessWithoutNullStreams | null} */
let gatewayChild = null;
/** @type {NodeJS.Timeout | null} */
let healthPollTimer = null;
let logBuffer = "";
let phase = "stopped"; // stopped | starting | running | attached | stopping | error
let lastError = "";
let ownsGatewayProcess = false;
const gatewayPort = DEFAULT_GATEWAY_PORT;

function gatewayUrl() {
  return `http://127.0.0.1:${gatewayPort}/`;
}

function appendLog(text) {
  if (!text) {
    return;
  }
  logBuffer += text;
  if (logBuffer.length > LOG_LIMIT) {
    logBuffer = logBuffer.slice(logBuffer.length - LOG_LIMIT);
  }
  emitState();
}

function setPhase(nextPhase, errorMessage = "") {
  phase = nextPhase;
  lastError = errorMessage;
  emitState();
}

function currentState() {
  return {
    phase,
    ownsGatewayProcess,
    port: gatewayPort,
    gatewayUrl: gatewayUrl(),
    logDirectory: path.join(os.tmpdir(), "openclaw"),
    workspaceRoot: paths.repoRoot,
    error: lastError,
    logs: logBuffer,
    canOpenAdmin: phase === "running" || phase === "attached",
    appLabel: "应用端",
    adminLabel: "管理端",
  };
}

function emitState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("desktop:state", currentState());
}

async function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(700);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPortReady(port, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnect(port)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

function attachToExistingGateway() {
  ownsGatewayProcess = false;
  setPhase("attached");
  appendLog("[desktop-shell] 检测到网关端口已占用，已附着到现有网关实例。\n");
}

async function detectInitialGateway() {
  try {
    const occupied = await canConnect(gatewayPort);
    if (occupied) {
      attachToExistingGateway();
      return;
    }
    setPhase("stopped");
  } catch (err) {
    setPhase("error", `检测网关端口失败: ${String(err?.message ?? err)}`);
  }
}

async function startGateway() {
  if (gatewayChild) {
    return currentState();
  }

  try {
    const occupied = await canConnect(gatewayPort);
    if (occupied) {
      attachToExistingGateway();
      return currentState();
    }
  } catch (err) {
    setPhase("error", `启动前端口检测失败: ${String(err?.message ?? err)}`);
    return currentState();
  }

  const spec = buildGatewayCommand(paths, { port: gatewayPort });
  appendLog(
    `[desktop-shell] 启动网关: ${spec.command} ${spec.args.join(" ")} (cwd=${spec.cwd})\n`,
  );
  setPhase("starting");
  ownsGatewayProcess = true;

  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  gatewayChild = child;

  child.stdout.on("data", (chunk) => {
    appendLog(String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    appendLog(String(chunk));
  });
  child.on("error", (err) => {
    setPhase("error", `网关进程启动失败: ${String(err?.message ?? err)}`);
    appendLog(`[desktop-shell] 网关进程错误: ${String(err?.message ?? err)}\n`);
  });
  child.on("exit", async (code, signal) => {
    gatewayChild = null;
    ownsGatewayProcess = false;
    appendLog(`[desktop-shell] 网关进程退出，code=${String(code)} signal=${String(signal)}\n`);

    const occupied = await canConnect(gatewayPort).catch(() => false);
    if (occupied) {
      attachToExistingGateway();
      return;
    }
    setPhase("stopped");
  });

  const ready = await waitForPortReady(gatewayPort);
  if (ready) {
    setPhase("running");
    appendLog("[desktop-shell] 网关已就绪。\n");
  } else {
    setPhase("error", "网关启动超时，请查看日志。");
    appendLog("[desktop-shell] 网关在预期时间内未就绪。\n");
  }

  return currentState();
}

async function stopGateway() {
  if (!gatewayChild) {
    if (phase === "attached") {
      appendLog("[desktop-shell] 当前为附着模式，不能直接停止外部网关实例。\n");
    }
    return currentState();
  }

  const child = gatewayChild;
  setPhase("stopping");
  appendLog("[desktop-shell] 正在停止网关进程...\n");

  const exited = new Promise((resolve) => {
    child.once("exit", () => resolve(true));
  });

  child.kill("SIGTERM");
  const graceful = await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(() => resolve(false), 6_000)),
  ]);

  if (!graceful && !child.killed) {
    child.kill("SIGKILL");
  }

  return currentState();
}

async function restartGateway() {
  if (!gatewayChild && phase === "attached") {
    appendLog("[desktop-shell] 当前为附着模式，不能直接重启外部网关实例。\n");
    return currentState();
  }
  await stopGateway();
  await startGateway();
  return currentState();
}

async function openAdminCenter() {
  const reachable = await canConnect(gatewayPort);
  if (!reachable) {
    const state = await startGateway();
    if (!(await canConnect(gatewayPort))) {
      throw new Error(state.error || "网关尚未运行，无法打开管理中心。");
    }
  }

  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.focus();
    return currentState();
  }

  adminWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "DingClaw 管理端",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  adminWindow.on("closed", () => {
    adminWindow = null;
  });

  await adminWindow.loadURL(gatewayUrl());
  return currentState();
}

async function openLogDirectory() {
  const result = await shell.openPath(path.join(os.tmpdir(), "openclaw"));
  if (result) {
    appendLog(`[desktop-shell] 打开日志目录失败: ${result}\n`);
  }
  return currentState();
}

function startHealthPoller() {
  if (healthPollTimer) {
    return;
  }
  healthPollTimer = setInterval(async () => {
    const reachable = await canConnect(gatewayPort).catch(() => false);
    if (gatewayChild) {
      if (reachable && phase === "starting") {
        setPhase("running");
      }
      if (!reachable && phase === "running") {
        setPhase("error", "网关连接丢失，请查看日志。");
      }
      return;
    }
    if (reachable) {
      if (phase !== "attached") {
        attachToExistingGateway();
      }
      return;
    }
    if (phase === "attached") {
      setPhase("stopped");
      appendLog("[desktop-shell] 已附着的网关实例当前不可达。\n");
    }
  }, HEALTH_POLL_MS);
}

function stopHealthPoller() {
  if (!healthPollTimer) {
    return;
  }
  clearInterval(healthPollTimer);
  healthPollTimer = null;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: "DingClaw 应用端",
    autoHideMenuBar: true,
    webPreferences: {
      preload: paths.preloadScript,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadFile(paths.rendererHtml);
}

function registerIpc() {
  ipcMain.handle("desktop:get-state", async () => currentState());
  ipcMain.handle("desktop:start-gateway", async () => startGateway());
  ipcMain.handle("desktop:stop-gateway", async () => stopGateway());
  ipcMain.handle("desktop:restart-gateway", async () => restartGateway());
  ipcMain.handle("desktop:open-admin", async () => openAdminCenter());
  ipcMain.handle("desktop:open-log-directory", async () => openLogDirectory());
}

app.whenReady().then(async () => {
  registerIpc();
  createMainWindow();
  startHealthPoller();
  await detectInitialGateway();
});

app.on("before-quit", () => {
  stopHealthPoller();
  if (gatewayChild) {
    gatewayChild.kill("SIGTERM");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (!mainWindow) {
    createMainWindow();
  }
});
