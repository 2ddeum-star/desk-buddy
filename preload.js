const { contextBridge, ipcRenderer } = require("electron");

// 렌더러(main.js)가 전역 입력 이벤트를 받을 수 있도록 안전하게 노출
contextBridge.exposeInMainWorld("deskBuddy", {
  onInput: (callback) => {
    ipcRenderer.on("input", (_event, data) => callback(data));
  },
});
