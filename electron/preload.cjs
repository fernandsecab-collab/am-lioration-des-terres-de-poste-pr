const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('secabDesktop', {
  saveJson: (payload) => ipcRenderer.invoke('save-json', payload),
  saveCsv: (csv) => ipcRenderer.invoke('save-csv', csv)
});
