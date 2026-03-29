const phaseLabelMap = {
  stopped: "未运行",
  starting: "启动中",
  running: "运行中",
  attached: "已附着",
  stopping: "停止中",
  error: "异常",
};

const badge = document.getElementById("phase-badge");
const detail = document.getElementById("status-detail");
const terminal = document.getElementById("terminal");
const logInfo = document.getElementById("log-info");
const gatewayUrl = document.getElementById("gateway-url");
const logDirectory = document.getElementById("log-directory");
const workspaceRoot = document.getElementById("workspace-root");
const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");
const btnRestart = document.getElementById("btn-restart");
const btnAdmin = document.getElementById("btn-admin");
const btnOpenLogDir = document.getElementById("btn-open-log-dir");

function phaseTone(phase) {
  switch (phase) {
    case "running":
      return "success";
    case "attached":
      return "info";
    case "starting":
    case "stopping":
      return "warning";
    case "error":
      return "danger";
    default:
      return "idle";
  }
}

function describeState(state) {
  switch (state.phase) {
    case "running":
      return state.ownsGatewayProcess
        ? "当前网关由主入口启动并托管。"
        : "当前网关已可用。";
    case "attached":
      return "检测到已有网关实例，当前处于附着模式。";
    case "starting":
      return "正在启动本地网关，请等待端口就绪。";
    case "stopping":
      return "正在停止当前由主入口托管的网关实例。";
    case "error":
      return state.error || "桌面主入口检测到运行异常。";
    default:
      return "尚未检测到运行中的网关实例。";
  }
}

function render(state) {
  const phaseText = phaseLabelMap[state.phase] ?? state.phase;
  badge.textContent = phaseText;
  badge.dataset.tone = phaseTone(state.phase);
  detail.textContent = describeState(state);
  gatewayUrl.textContent = state.gatewayUrl;
  logDirectory.textContent = state.logDirectory;
  workspaceRoot.textContent = state.workspaceRoot;
  terminal.textContent = state.logs?.trimEnd() || "[desktop-shell] 等待日志输出…";
  terminal.scrollTop = terminal.scrollHeight;
  logInfo.textContent = `${phaseText} · 端口 ${state.port}`;

  const busy = state.phase === "starting" || state.phase === "stopping";
  btnStart.disabled = busy || state.phase === "running" || state.phase === "attached";
  btnStop.disabled = busy || !state.ownsGatewayProcess;
  btnRestart.disabled = busy || !state.ownsGatewayProcess;
  btnAdmin.disabled = busy;
  btnOpenLogDir.disabled = false;
}

async function callAction(action) {
  try {
    const state = await action();
    if (state) {
      render(state);
    }
  } catch (err) {
    detail.textContent = `操作失败: ${String(err?.message ?? err)}`;
    badge.textContent = "异常";
    badge.dataset.tone = "danger";
  }
}

btnStart.addEventListener("click", () => callAction(() => window.desktopShell.startGateway()));
btnStop.addEventListener("click", () => callAction(() => window.desktopShell.stopGateway()));
btnRestart.addEventListener("click", () => callAction(() => window.desktopShell.restartGateway()));
btnAdmin.addEventListener("click", () => callAction(() => window.desktopShell.openAdmin()));
btnOpenLogDir.addEventListener("click", () =>
  callAction(() => window.desktopShell.openLogDirectory()),
);

window.desktopShell.onStateChange((state) => {
  render(state);
});

window.desktopShell
  .getState()
  .then((state) => render(state))
  .catch((err) => {
    detail.textContent = `初始化失败: ${String(err?.message ?? err)}`;
  });
