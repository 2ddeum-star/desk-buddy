const { app, BrowserWindow, screen, globalShortcut, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { uIOhook, UiohookKey } = require("uiohook-napi");

let win = null;
let tray = null;

// uiohook 키코드 -> 문자 매핑 (렌더러의 키보드 강조에 사용)
const code2char = {};
for (const [name, code] of Object.entries(UiohookKey)) {
  if (typeof code !== "number") continue;
  if (name.length === 1) code2char[code] = name.toLowerCase(); // 알파벳/숫자
  else if (name === "Space") code2char[code] = " ";
}

// 화면 정규화용 (전역 좌표 -> 0~1 비율)
let bounds = { x: 0, y: 0, width: 1920, height: 1080 };
function refreshBounds() {
  const d = screen.getPrimaryDisplay();
  bounds = d.bounds;
}

function send(data) {
  if (win && !win.isDestroyed() && win.webContents) {
    win.webContents.send("input", data);
  }
}

// 마스코트 창 크기 (작게, 화면 전체를 덮지 않음)
const WIN_W = 300;
const WIN_H = 250;
const MARGIN = 24;

function createWindow() {
  refreshBounds();
  const wa = screen.getPrimaryDisplay().workArea; // 작업표시줄 제외 영역
  win = new BrowserWindow({
    x: wa.x + wa.width - WIN_W - MARGIN, // 우하단 모서리
    y: wa.y + wa.height - WIN_H - MARGIN,
    width: WIN_W,
    height: WIN_H,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 클릭이 아래 앱으로 통과되도록 (오버레이가 입력을 가로채지 않음)
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setAlwaysOnTop(true, "screen-saver");
  win.loadFile("index.html");
}

function startGlobalInput() {
  let lastMove = 0;
  uIOhook.on("mousemove", (e) => {
    const now = Date.now();
    if (now - lastMove < 16) return; // ~60fps로 제한
    lastMove = now;
    const fx = (e.x - bounds.x) / bounds.width;
    const fy = (e.y - bounds.y) / bounds.height;
    send({ type: "move", fx, fy });
  });
  uIOhook.on("mousedown", () => send({ type: "mousedown" }));
  uIOhook.on("mouseup", () => send({ type: "mouseup" }));
  uIOhook.on("keydown", (e) => {
    send({ type: "key", char: code2char[e.keycode] || null });
  });
  uIOhook.start();
}

function createTray() {
  try {
    // 빈 아이콘이라도 트레이를 만들어 종료 메뉴를 제공
    tray = new Tray(nativeImage.createEmpty());
    tray.setToolTip("Desk Buddy");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Desk Buddy 실행 중", enabled: false },
        { type: "separator" },
        { label: "종료 (Ctrl+Shift+Q)", click: () => app.quit() },
      ])
    );
  } catch (err) {
    console.warn("트레이 생성 실패(무시 가능):", err.message);
  }
}

app.whenReady().then(() => {
  createWindow();
  startGlobalInput();
  createTray();

  // 오버레이 창은 포커스를 받지 않으므로 전역 단축키로 종료
  globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit());

  screen.on("display-metrics-changed", refreshBounds);
  screen.on("display-added", refreshBounds);
  screen.on("display-removed", refreshBounds);

  console.log("Desk Buddy 실행됨. 종료하려면 Ctrl+Shift+Q 또는 트레이 메뉴를 사용하세요.");
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  try {
    uIOhook.stop();
  } catch (_) {}
});

// 모든 창이 닫혀도 오버레이 특성상 트레이로 유지 (명시적 종료만)
app.on("window-all-closed", () => {
  app.quit();
});
