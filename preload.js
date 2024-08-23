const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Existing methods
  executeCommandWithLogging: (command, callback) => {
    ipcRenderer.invoke('execute-command-with-logging', command).then((result) => {
      result.forEach(({ text, type }) => {
        callback(text, type);
      });
    });
  },
  minimizeWindow: () => {
    ipcRenderer.send('minimize-window');
  },
  closeWindow: () => {
    ipcRenderer.send('close-window');
  },
  toggleFullScreen: () => {
    ipcRenderer.send('toggle-fullscreen');
  },
  readFileContent: (filename) => ipcRenderer.invoke('read-file-content', filename),
  saveFileContent: (filename, content) => ipcRenderer.invoke('save-file-content', filename),
  loadTerminalHistory: (callback) => {
    ipcRenderer.once('load-terminal-history', (event, history) => {
      callback(history);
    });
  },
  getPlatform: () => process.platform, // Ensure process is not redeclared
  
  // New method for update status
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, status) => {
      callback(status);
    });
  }
});
