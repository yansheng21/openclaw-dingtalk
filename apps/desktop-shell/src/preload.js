import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopShell", {
  getState: () => ipcRenderer.invoke("desktop:get-state"),
  startGateway: () => ipcRenderer.invoke("desktop:start-gateway"),
  stopGateway: () => ipcRenderer.invoke("desktop:stop-gateway"),
  restartGateway: () => ipcRenderer.invoke("desktop:restart-gateway"),
  openAdmin: () => ipcRenderer.invoke("desktop:open-admin"),
  openLogDirectory: () => ipcRenderer.invoke("desktop:open-log-directory"),
  onStateChange: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("desktop:state", handler);
    return () => {
      ipcRenderer.removeListener("desktop:state", handler);
    };
  },
});
