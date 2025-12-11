const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arsenal', {
  loadKeys: () => ipcRenderer.invoke('keys:load'),
  saveKey: (provider, key, model) => ipcRenderer.invoke('keys:save', { provider, key, model }),
  requestAI: (provider, prompt, images) => ipcRenderer.invoke('ai:request', { provider, prompt, images }),
  toggleDevTools: () => ipcRenderer.invoke('window:toggle-devtools'),
  setMode: (mode) => ipcRenderer.invoke('mode:set', mode),
  getProxyList: () => ipcRenderer.invoke('proxy:list'),
  getCurrentProxy: () => ipcRenderer.invoke('proxy:current'),
  rotateProxy: () => ipcRenderer.invoke('proxy:rotate'),
});
