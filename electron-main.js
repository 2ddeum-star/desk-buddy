const { app, BrowserWindow, screen, globalShortcut, Tray, Menu, nativeImage, ipcMain } = require("electron");
const path = require("path");
const { uIOhook, UiohookKey } = require("uiohook-napi");

let win = null;
let tray = null;

// uiohook 키코드 -> normalized 키 매핑 (렌더러의 키보드 강조에 사용)
// 렌더러(main.js)의 keyMap 키 이름과 동일해야 함.
const code2char = {};
for (const [name, code] of Object.entries(UiohookKey)) {
  if (typeof code !== "number") continue;
  let mapped = null;
  if (name.length === 1) mapped = name.toLowerCase(); // 알파벳/숫자
  else if (name === "Space") mapped = " ";
  else if (/^F\d{1,2}$/.test(name)) mapped = name.toLowerCase(); // F1~F12
  else if (name === "Escape") mapped = "escape";
  else if (name === "Tab") mapped = "tab";
  else if (name === "Enter") mapped = "enter";
  else if (name === "Backspace") mapped = "backspace";
  else if (name === "CapsLock") mapped = "capslock";
  else if (name === "ArrowUp") mapped = "arrowup";
  else if (name === "ArrowDown") mapped = "arrowdown";
  else if (name === "ArrowLeft") mapped = "arrowleft";
  else if (name === "ArrowRight") mapped = "arrowright";
  // Ctrl/Shift/Alt 좌/우 분리. Meta 만 통합.
  // 정확 매칭 먼저 (uiohook-napi enum: Ctrl/CtrlRight, Shift/ShiftRight, Alt/AltRight)
  else if (name === "ShiftRight") mapped = "shift_r";
  else if (name === "Shift") mapped = "shift_l";
  else if (name === "AltRight") mapped = "alt_r";
  else if (name === "Alt") mapped = "alt_l";
  else if (name === "CtrlLeft" || name === "ControlLeft" || name === "Ctrl") mapped = "control_l";
  else if (name === "CtrlRight" || name === "ControlRight") mapped = "control_r";
  // fallback (위에서 안 잡힌 변종 이름)
  else if (/Right$/.test(name) && /^Shift/.test(name)) mapped = "shift_r";
  else if (/^Shift/.test(name)) mapped = "shift_l";
  else if (/Right$/.test(name) && /^Alt/.test(name)) mapped = "alt_r";
  else if (/^Alt/.test(name)) mapped = "alt_l";
  else if (/^(Ctrl|Control)/.test(name)) mapped = "control_l";
  else if (/^Meta/.test(name)) mapped = "meta";
  else if (name === "Minus") mapped = "-";
  else if (name === "Equal") mapped = "=";
  else if (name === "BracketLeft") mapped = "[";
  else if (name === "BracketRight") mapped = "]";
  else if (name === "Backslash") mapped = "\\";
  else if (name === "Semicolon") mapped = ";";
  else if (name === "Quote") mapped = "'";
  else if (name === "Comma") mapped = ",";
  else if (name === "Period") mapped = ".";
  else if (name === "Slash") mapped = "/";
  else if (name === "Backquote" || name === "Grave") mapped = "`";
  if (mapped) code2char[code] = mapped;
}

// 한국식 키보드 보정 — uiohook-napi enum 에 없는 키코드.
// 한자 키 위치(우측 Ctrl 자리) → control_r
// 한/영 키 위치(우측 Alt 자리) → alt_r
// keycode 는 키보드/드라이버 마다 달라서 알려진 후보를 모두 매핑.
const KR_CTRL_R_CODES = [121];      // 한자 키 (0x79)
const KR_ALT_R_CODES = [112, 114];  // 한/영 키 (0x70, 0x72)
for (const c of KR_CTRL_R_CODES) if (!(c in code2char)) code2char[c] = "control_r";
for (const c of KR_ALT_R_CODES) if (!(c in code2char)) code2char[c] = "alt_r";

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
const WIN_W = 240;
const WIN_H = 200;
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
    movable: true,
    focusable: true,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 마스코트 영역만 클릭/드래그 받음 (그 외 영역은 어차피 창 밖이라 아래 앱 정상 작동)
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
  uIOhook.on("mousedown", (e) => {
    // uiohook 1=Left, 2=Right → DOM e.button (0=L, 2=R)
    const button = e.button === 2 ? 2 : e.button === 3 ? 1 : 0;
    send({ type: "mousedown", button });
  });
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

  // 컨트롤 바 hover 시 클릭/드래그 받도록 토글
  ipcMain.on("set-mouse-enabled", (_event, enabled) => {
    if (!win || win.isDestroyed()) return;
    if (enabled) {
      win.setIgnoreMouseEvents(false);
    } else {
      win.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  // 닫기 버튼 클릭 → 앱 종료
  ipcMain.on("quit-app", () => app.quit());

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
