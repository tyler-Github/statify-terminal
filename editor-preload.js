const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    send: (channel, ...data) => {
        let validChannels = ["save-file-content", "close-editor"];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, ...data); // Use ipcRenderer.invoke for channels expecting a response
        }
    },
    receive: (channel, func) => {
        let validChannels = ["load-file"];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
});
