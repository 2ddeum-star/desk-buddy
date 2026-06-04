const { contextBridge, ipcRenderer } = require("electron");

// 렌더러(main.js)가 전역 입력 이벤트를 받을 수 있도록 안전하게 노출
contextBridge.exposeInMainWorld("deskBuddy", {
  onInput: (callback) => {
    ipcRenderer.on("input", (_event, data) => callback(data));
  },
  // 컨트롤 바 hover 시 마우스 통과 모드 토글 (drag/click 받기)
  setMouseEnabled: (enabled) => ipcRenderer.send("set-mouse-enabled", enabled),
  // 닫기 버튼 클릭 시 앱 종료
  quitApp: () => ipcRenderer.send("quit-app"),
});
