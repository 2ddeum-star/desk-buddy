// Desk Buddy — 페이지 안의 마우스/키보드 입력을 따라 동작하는 캐릭터
// 순수 바닐라 JS + SVG. 빌드/설치 없이 index.html 을 열면 바로 동작합니다.

const svg = document.getElementById("scene");
const keyboardG = document.getElementById("keyboard");
const mouseG = document.getElementById("mouse");
const hint = document.getElementById("hint");

const charImg = document.getElementById("charImg");

const armLEl = document.getElementById("armL");
const armREl = document.getElementById("armR");
const handLEl = document.getElementById("handL");
const handREl = document.getElementById("handR");
const mouseBtnL = document.getElementById("mouseBtnL");
const mouseBtnR = document.getElementById("mouseBtnR");
const mouseWheelEl = document.getElementById("mouseWheel");

// 활성 캐릭터 설정 — character-config.js 가 window.CHARACTER_CONFIG 를 정의.
// 파일이 없거나 누락 필드가 있을 때를 대비한 fallback (poodle 기본값).
const CFG = Object.assign(
  {
    charImg: { x: 245, y: 135, width: 400, height: 450 },
    charRot: -5,
    charCenter: { x: 445, y: 375 },
    shoulderL: { x: 370, y: 438 },
    shoulderR: { x: 445, y: 438 },
    armFill: "texture",   // "texture" = leg_texture.png 패턴, 또는 "#ffffff" 같은 색 코드
    pawFill: "image",     // "image" = paw_only.png, 또는 "#ffffff" 같은 색 코드(SVG 발 모양)
    showFrame: true,      // 책상 위 액자 표시 여부
    armThickness: 44,     // 팔 두께(px, viewBox 단위). 캐릭터별 비율에 맞춰 조정
  },
  window.CHARACTER_CONFIG || {}
);

// 캐릭터 이미지 위치는 config 에 따라 즉시 갱신
if (charImg) {
  charImg.setAttribute("x", CFG.charImg.x);
  charImg.setAttribute("y", CFG.charImg.y);
  charImg.setAttribute("width", CFG.charImg.width);
  charImg.setAttribute("height", CFG.charImg.height);
}

// 팔 fill — "texture" 면 leg_texture.png 패턴, 그 외엔 색 코드 (예: "#ffffff")
const armFillValue = CFG.armFill === "texture" ? "url(#legTexture)" : CFG.armFill;
if (armLEl) armLEl.setAttribute("fill", armFillValue);
if (armREl) armREl.setAttribute("fill", armFillValue);

// 팔 두께 — 캐릭터별 설정. height/y/rx 모두 두께 기준으로 일관 적용 (반원 끝).
const armH = CFG.armThickness;
for (const el of [armLEl, armREl]) {
  if (!el) continue;
  el.setAttribute("height", armH);
  el.setAttribute("y", -armH / 2);
  el.setAttribute("rx", armH / 2);
}

// 발 — "image" 면 paw_only.png 그대로, "texture" 면 leg_texture.png 패턴, 그 외엔 색 코드
if (CFG.pawFill && CFG.pawFill !== "image") {
  const SVG_NS = "http://www.w3.org/2000/svg";
  // 손 영역(75×75) 에 맞춰 크게 — 발가락 없이 큰 타원 하나만 (민짜)
  const PAW_PARTS = [
    { cx: 0, cy: 0, rx: 30, ry: 26 },
  ];
  const pawFillValue = CFG.pawFill === "texture" ? "url(#legTexture)" : CFG.pawFill;
  function drawPaw(g) {
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    PAW_PARTS.forEach((p) => {
      const e = document.createElementNS(SVG_NS, "ellipse");
      e.setAttribute("cx", p.cx);
      e.setAttribute("cy", p.cy);
      e.setAttribute("rx", p.rx);
      e.setAttribute("ry", p.ry);
      e.setAttribute("fill", pawFillValue);
      g.appendChild(e);
    });
  }
  drawPaw(handLEl);
  drawPaw(handREl);
}

// 액자 — showFrame: false 면 숨김
if (CFG.showFrame === false) {
  const frameEl = document.getElementById("frame");
  if (frameEl) frameEl.style.display = "none";
}

// 어깨(=다리 시작점) — 캐릭터 사진 가슴 부근. shoulderL = 화면 좌측, shoulderR = 화면 우측.
const shoulderL = CFG.shoulderL;
const shoulderR = CFG.shoulderR;

// 캐릭터 사진 회전 — 살짝 기울이기. 회전 중심은 charCenter (사진 중심에 가깝게).
const CHAR_ROT_DEG = CFG.charRot;
const CHAR_CENTER = CFG.charCenter;

// 어깨가 손 쪽으로 살짝 따라감 — 손 멀리 뻗어도 다리가 과하게 길어지지 않음
const SHOULDER_FOLLOW_X = 0.35;
const SHOULDER_FOLLOW_Y = 0.06;

// ---- 유틸 ----
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 화면 좌표(clientX/Y) -> SVG viewBox 좌표
function toSvg(clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
}

// ---- 키보드/마우스 회전 (강아지가 사용하는 방향, 살짝 비스듬) ----
// index.html 의 keyboard transform="rotate(185 115 47)" 와 일치해야 함
const VIEW_ROT_DEG = 185;
const KB_PIVOT = { x: 180, y: 48 };

function rotateAround(px, py, cx, cy, deg) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

// ---- 키보드 생성 ----
const KB = {
  gx: 170, gy: 460,
  u: 19,         // 1u 키 폭
  kh: 14,        // 메인 키 높이
  gapx: 1.5,     // 키 사이 가로 갭
  gapy: 1.5,     // 키 사이 세로 갭
  fnH: 9,        // 펑션 키 높이
  fnGap: 4.5,    // 펑션 ↔ 메인 행 간격
  arrowGap: 3,   // 방향키/우측 컬럼 앞 추가 여백 (메인 키와 살짝 분리)
};

// 펑션 행 — c: 컬러 그룹 (white/pink/red) — AULA Valentine Pink 풍
const FN_ROW = [
  { label: "Esc", k: "escape", c: "red" },
  { label: "F1",  k: "f1",  c: "white" }, { label: "F2",  k: "f2",  c: "pink" },
  { label: "F3",  k: "f3",  c: "pink" },  { label: "F4",  k: "f4",  c: "white" },
  { label: "F5",  k: "f5",  c: "white" }, { label: "F6",  k: "f6",  c: "pink" },
  { label: "F7",  k: "f7",  c: "pink" },  { label: "F8",  k: "f8",  c: "white" },
  { label: "F9",  k: "f9",  c: "white" }, { label: "F10", k: "f10", c: "pink" },
  { label: "F11", k: "f11", c: "pink" },  { label: "F12", k: "f12", c: "white" },
];

// 메인 5행 — 깔끔한 14.5u 통일. 방향키/추가 컬럼은 별도 그룹으로 메인 우측에 배치
const MAIN_ROWS = [
  [ // 숫자 행
    { label: "`", k: "`", c: "pink" },
    { label: "1", k: "1", c: "white" }, { label: "2", k: "2", c: "white" }, { label: "3", k: "3", c: "pink" },
    { label: "4", k: "4", c: "white" }, { label: "5", k: "5", c: "white" }, { label: "6", k: "6", c: "pink" },
    { label: "7", k: "7", c: "white" }, { label: "8", k: "8", c: "white" }, { label: "9", k: "9", c: "pink" },
    { label: "0", k: "0", c: "white" }, { label: "-", k: "-", c: "pink" },  { label: "=", k: "=", c: "white" },
    { label: "⌫", k: "backspace", w: 1.5, c: "red" },
  ],
  [ // QWERTY 행
    { label: "Tab", k: "tab", w: 1.5, c: "pink" },
    { label: "Q", k: "q", c: "white" }, { label: "W", k: "w", c: "white" }, { label: "E", k: "e", c: "pink" },
    { label: "R", k: "r", c: "white" }, { label: "T", k: "t", c: "white" }, { label: "Y", k: "y", c: "white" },
    { label: "U", k: "u", c: "pink" },  { label: "I", k: "i", c: "white" }, { label: "O", k: "o", c: "white" },
    { label: "P", k: "p", c: "pink" },  { label: "[", k: "[", c: "white" }, { label: "]", k: "]", c: "pink" },
    { label: "\\", k: "\\", c: "white" },
  ],
  [ // ASDF 행
    { label: "Caps", k: "capslock", w: 1.7, c: "pink" },
    { label: "A", k: "a", c: "white" }, { label: "S", k: "s", c: "pink" },  { label: "D", k: "d", c: "white" },
    { label: "F", k: "f", c: "white" }, { label: "G", k: "g", c: "pink" },  { label: "H", k: "h", c: "white" },
    { label: "J", k: "j", c: "white" }, { label: "K", k: "k", c: "pink" },  { label: "L", k: "l", c: "white" },
    { label: ";", k: ";", c: "pink" },  { label: "'", k: "'", c: "white" },
    { label: "Enter", k: "enter", w: 1.8, c: "red" },
  ],
  [ // ZXCV 행 — Shift_r 짧게(1.8u)해서 방향키가 안쪽으로 들어오게
    { label: "Shift", k: "shift_l", w: 2.2, c: "pink" },
    { label: "Z", k: "z", c: "white" }, { label: "X", k: "x", c: "white" }, { label: "C", k: "c", c: "pink" },
    { label: "V", k: "v", c: "white" }, { label: "B", k: "b", c: "white" }, { label: "N", k: "n", c: "pink" },
    { label: "M", k: "m", c: "white" }, { label: ",", k: ",", c: "white" }, { label: ".", k: ".", c: "pink" },
    { label: "/", k: "/", c: "white" }, { label: "Shift", k: "shift_r", w: 1.8, c: "pink" },
  ],
  [ // 모디파이어 행 — Ctrl_r 짧게(1.0u)해서 방향키가 안쪽으로
    { label: "Ctrl", k: "control_l", w: 1.5, c: "pink" },
    { label: "Win",  k: "meta_l",    w: 1.2, c: "pink" },
    { label: "Alt",  k: "alt_l",     w: 1.2, c: "pink" },
    { label: "",     k: " ",         w: 6.9, c: "red" },
    { label: "Alt",  k: "alt_r",     w: 1.2, c: "pink" },
    { label: "Fn",   k: "fn",        w: 1,   c: "pink" },
    { label: "Ctrl", k: "control_r", w: 1.0, c: "pink" },
  ],
];

// 방향키 인버티드 T — row 3 col 1 (↑), row 4 col 0~2 (←↓→)
const ARROW_KEYS = [
  { label: "↑", k: "arrowup",    col: 1, row: 3, c: "pink" },
  { label: "←", k: "arrowleft",  col: 0, row: 4, c: "pink" },
  { label: "↓", k: "arrowdown",  col: 1, row: 4, c: "pink" },
  { label: "→", k: "arrowright", col: 2, row: 4, c: "pink" },
];

// normalized 키 -> [{el, cx, cy, localCx}, ...] (좌/우 Shift 처럼 같은 키가 여러 개일 수 있어 배열)
const keyMap = {};

function makeKey(label, x, y, w, h, normalized, sizeClass, colorGroup) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const classes = ["key"];
  if (sizeClass) classes.push(sizeClass);
  if (colorGroup) classes.push("kc-" + colorGroup);
  g.setAttribute("class", classes.join(" "));
  g.setAttribute("transform", `translate(${x} ${y})`);

  const NS = "http://www.w3.org/2000/svg";
  const rect = document.createElementNS(NS, "rect");
  rect.setAttribute("class", "key-cap");
  rect.setAttribute("width", w);
  rect.setAttribute("height", h);
  rect.setAttribute("rx", Math.min(3, h * 0.3));

  // 상단 광택 — 키캡 위쪽 절반에 옅은 화이트 그라데이션 면. 입체감의 핵심.
  const hi = document.createElementNS(NS, "rect");
  hi.setAttribute("class", "key-hi");
  hi.setAttribute("x", 0.6);
  hi.setAttribute("y", 0.6);
  hi.setAttribute("width", Math.max(0, w - 1.2));
  hi.setAttribute("height", h * 0.42);
  hi.setAttribute("rx", Math.min(2.4, h * 0.25));

  // 하단 미세 음각 — 키캡 아랫면이 살짝 안쪽으로 들어가는 느낌
  const lo = document.createElementNS(NS, "rect");
  lo.setAttribute("class", "key-lo");
  lo.setAttribute("x", 0.6);
  lo.setAttribute("y", h - h * 0.18);
  lo.setAttribute("width", Math.max(0, w - 1.2));
  lo.setAttribute("height", h * 0.15);
  lo.setAttribute("rx", Math.min(1.8, h * 0.2));

  const text = document.createElementNS(NS, "text");
  text.setAttribute("x", w / 2);
  text.setAttribute("y", h / 2);
  text.textContent = label;

  g.appendChild(rect);
  g.appendChild(lo);
  g.appendChild(hi);
  g.appendChild(text);
  keyboardG.appendChild(g);

  if (!normalized) return;

  const localCx = x + w / 2;
  const localCy = y + h / 2;
  const rotated = rotateAround(localCx, localCy, KB_PIVOT.x, KB_PIVOT.y, VIEW_ROT_DEG);
  const entry = {
    el: g,
    cx: KB.gx + rotated.x,
    cy: KB.gy + rotated.y,
    localCx,
  };
  (keyMap[normalized] = keyMap[normalized] || []).push(entry);
}

// 펑션 행 — 좌측 정렬, 균등 폭
{
  let x = 0;
  FN_ROW.forEach((key) => {
    makeKey(key.label, x, 0, KB.u, KB.fnH, key.k, "fn", key.c);
    x += KB.u + KB.gapx;
  });
}

// 메인 5행
const MAIN_OFFSET_Y = KB.fnH + KB.fnGap;
MAIN_ROWS.forEach((row, r) => {
  const y = MAIN_OFFSET_Y + r * (KB.kh + KB.gapy);
  let x = 0;
  row.forEach((key) => {
    if (key.gap) x += KB.arrowGap; // 우측 키들 앞에 추가 여백
    const kw = (key.w || 1) * KB.u;
    if (key.spacer) { // 빈 자리 (인버티드 T 정렬용)
      x += kw + KB.gapx;
      return;
    }
    const sizeClass = key.label.length > 1 ? "mod" : "";
    makeKey(key.label, x, y, kw, KB.kh, key.k, sizeClass, key.c);
    x += kw + KB.gapx;
  });
});

// 방향키 — ZXCV/모디파이어 행이 14.0u(끝 키 0.5u 줄임)라 방향키가 그 옆에 자연 정렬
const MAIN_TOTAL_W = 14.5 * KB.u + 13 * KB.gapx;
const ARROW_X_BASE = 14.0 * KB.u + 14 * KB.gapx; // 14.0u 끝 + 1 gap
ARROW_KEYS.forEach((key) => {
  const x = ARROW_X_BASE + key.col * (KB.u + KB.gapx);
  const y = MAIN_OFFSET_Y + key.row * (KB.kh + KB.gapy);
  makeKey(key.label, x, y, KB.u, KB.kh, key.k, "arrow", key.c);
});

// Win 키 한 개라 OS 우측 Win 입력도 동일 키 점등
if (keyMap["meta_l"]) keyMap["meta_r"] = keyMap["meta_l"];

// ---- LCD: 입력 타이핑 모드 + idle 시 시계 ----
const lcdTimeEl = document.getElementById("lcdTime");
const LCD_MAX_CHARS = 8;             // 한 번에 보여줄 글자 수
const LCD_IDLE_MS = 2500;            // 무입력 시 시계로 복귀
let lcdMode = "clock";               // "clock" | "input"
let lcdBuf = "";
let lcdIdleTimer = null;

function updateClock() {
  if (!lcdTimeEl || lcdMode !== "clock") return;
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  lcdTimeEl.textContent = `${hh}:${mm}`;
}
function pushLcdInput(char) {
  if (!lcdTimeEl || !char || char.length !== 1) return;
  const ch = char === " " ? "_" : char.toUpperCase();
  lcdMode = "input";
  lcdBuf = (lcdBuf + ch).slice(-LCD_MAX_CHARS);
  lcdTimeEl.textContent = lcdBuf;
  if (lcdIdleTimer) clearTimeout(lcdIdleTimer);
  lcdIdleTimer = setTimeout(() => {
    lcdMode = "clock";
    lcdBuf = "";
    updateClock();
  }, LCD_IDLE_MS);
}
updateClock();
setTimeout(() => {
  updateClock();
  setInterval(updateClock, 60000);
}, 60000 - (Date.now() % 60000));

// ---- 상태 ----
// 마우스 어깨 쪽으로 살짝 가까이 — 키보드 우측 끝(약 535)과 7px 정도 여유 유지
let deskMouse = { x: 580, y: 524 };
const mouseRange = { x: [560, 605], y: [512, 547] };

// 키보드는 강아지 시점(180° 회전)이라 화면상 좌/우가 일반 키보드와 반대.
// → 화면 좌측 손(handL)이 갈 home 은 회전 후 화면 좌측에 있는 J(강아지 우손 검지),
//   화면 우측 손(handR)이 갈 home 은 회전 후 화면 우측에 있는 F(강아지 좌손 검지).
// 이렇게 두면 어깨 → 손 방향이 자연스럽게 같은 쪽으로 뻗어 팔이 교차되지 않음.
const leftHome = (keyMap["j"] && keyMap["j"][0]) || { cx: 360, cy: 540 };
// 오른손 home — F 키 위치에서 살짝 우측 offset (어깨 우측 이동에 맞춰 팔 평행 이동)
const rightHomeKey = (keyMap["f"] && keyMap["f"][0]) || { cx: 400, cy: 540 };
const rightHome = { cx: rightHomeKey.cx + 15, cy: rightHomeKey.cy };
let handL = { x: leftHome.cx, y: leftHome.cy };
let handR = { x: deskMouse.x, y: deskMouse.y - 8 };

let leftTap = { time: -9999, cx: 0, cy: 0 };
let rightTap = { time: -9999, cx: 0, cy: 0 };
const TAP_MS = 180;

// 마우스가 일정 시간 안 움직이면 오른손도 키보드 모드로 (양손 타이핑)
const MOUSE_IDLE_MS = 1500;
let lastMouseMove = performance.now(); // 디폴트는 마우스 잡고 있는 상태 — idle 까지 1.5초 대기

let mouseDown = false;
let headBobTime = -9999;

let hintFaded = false;
function activity() {
  if (!hintFaded) {
    //hint.classList.add("fade");
    //hintFaded = true;
  }
}

// ---- 입력 처리 (브라우저 DOM / Electron 전역 입력 공용) ----
// fx, fy 는 화면(또는 창) 내 0~1 비율 좌표
let mouseIdleWakeup = null;
function handleMove(fx, fy) {
  fx = clamp(fx, 0, 1);
  fy = clamp(fy, 0, 1);
  deskMouse.x = lerp(mouseRange.x[0], mouseRange.x[1], fx);
  deskMouse.y = lerp(mouseRange.y[0], mouseRange.y[1], fy);
  lastMouseMove = performance.now();
  activity();
  // 마지막 마우스 이벤트로부터 MOUSE_IDLE_MS 뒤에 양손 모드로 자동 전환 — rAF가
  // 멈춰있어도 한 번 깨워서 손을 home 위치로 이동시켜야 함.
  if (mouseIdleWakeup) clearTimeout(mouseIdleWakeup);
  mouseIdleWakeup = setTimeout(scheduleFrame, MOUSE_IDLE_MS + 50);
  scheduleFrame();
}

function handleMouseDown(button = 0) {
  mouseDown = true;
  lastMouseMove = performance.now(); // 클릭도 마우스 활동으로 간주
  headBobTime = performance.now();
  // 마우스 본체에 드래그 글로우 효과
  mouseG.classList.add("dragging");
  // 강아지 시점에 맞춤: 마우스가 180° 회전이라 사용자 좌클릭은 화면 좌측의 버튼(=강아지 우측 = mouseBtnR) 빛남
  flashMouseBtn(button === 2 ? mouseBtnL : mouseBtnR);
  scheduleFrame();
}
function handleMouseUp() {
  mouseDown = false;
  mouseG.classList.remove("dragging");
  scheduleFrame();
}

// 마우스 휠 굴리기 — 휠에 잠깐 컬러 점등 (연속 굴림은 타이머 갱신)
let wheelTimeout = null;
function handleWheel() {
  if (!mouseWheelEl) return;
  mouseWheelEl.classList.add("scrolling");
  if (wheelTimeout) clearTimeout(wheelTimeout);
  wheelTimeout = setTimeout(() => mouseWheelEl.classList.remove("scrolling"), 220);
}

function flashMouseBtn(el) {
  if (!el) return;
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 200);
}

function normalizeKey(rawKey, code) {
  if (rawKey == null) return null;
  const k = String(rawKey);
  // Control/Shift/Alt/Meta 좌/우 분리 (KeyboardEvent.code 기반).
  if (code) {
    if (k === "Control") return code === "ControlRight" ? "control_r" : "control_l";
    if (k === "Shift")   return code === "ShiftRight"   ? "shift_r"   : "shift_l";
    if (k === "Alt")     return code === "AltRight"     ? "alt_r"     : "alt_l";
    if (k === "Meta" || k === "OS") {
      return (code === "MetaRight" || code === "OSRight") ? "meta_r" : "meta_l";
    }
  }
  if (k.length === 1) return k.toLowerCase();
  if (k.toLowerCase() === "space") return " ";
  // "ArrowUp"→"arrowup", "F1"→"f1", "Meta", "Escape"/"Tab"/...
  // Electron 모드의 "control_l"/"shift_r"/"alt_r" 등도 그대로 통과
  return k.toLowerCase();
}

function handleKey(char, code) {
  activity();
  const now = performance.now();
  headBobTime = now;

  // LCD 에 입력 글자 흘리기 (단일 글자만, modifier 등 제외)
  pushLcdInput(char);

  const norm = normalizeKey(char, code);
  const targets = norm && keyMap[norm];
  if (!targets || !targets.length) return;

  // 같은 normalized 가 여러 키일 수 있음(좌/우 Shift 등) — 전부 깜빡임
  targets.forEach((t) => {
    t.el.classList.add("active");
    setTimeout(() => t.el.classList.remove("active"), 130);
  });

  const target = targets[0];
  // 마우스 idle 시 양손 모드: 키 위치(화면상 cx)에 따라 가까운 손이 타이핑
  // 마우스 활성 시: 왼손만 타이핑 (오른손은 마우스 전담)
  const mouseIdle = now - lastMouseMove > MOUSE_IDLE_MS;
  // 분기 기준은 키보드 가운데 근처 고정값 — 어깨 위치를 옮겨도 분기 일관성 유지
  const handSplitX = 400;
  if (mouseIdle && target.cx > handSplitX) {
    rightTap = { time: now, cx: target.cx, cy: target.cy };
  } else {
    leftTap = { time: now, cx: target.cx, cy: target.cy };
  }
  scheduleFrame();
}

// 입력 소스 연결: Electron(전역 입력)이 있으면 그쪽을, 없으면 브라우저 DOM 이벤트를 사용
const electronAPI = window.deskBuddy;
if (electronAPI) {
  document.body.classList.add("electron");
  const bg = document.getElementById("bg");
  if (bg) bg.style.display = "none"; // 오버레이에서는 배경 숨김(투명)
  // 작은 창에 캐릭터가 꽉 차도록 빈 여백을 잘라낸 viewBox (창 비율 1.2:1)
  // 좌측을 70 까지 확장해서 책상 좌측 옆선이 잘리지 않도록
  svg.setAttribute("viewBox", "70 110 650 542");
  electronAPI.onInput((d) => {
    if (d.type === "move") handleMove(d.fx, d.fy);
    else if (d.type === "key") handleKey(d.char);
    else if (d.type === "mousedown") handleMouseDown(d.button || 0);
    else if (d.type === "mouseup") handleMouseUp();
    else if (d.type === "wheel") handleWheel();
  });

} else {
  window.addEventListener("mousemove", (e) =>
    handleMove(e.clientX / window.innerWidth, e.clientY / window.innerHeight)
  );
  window.addEventListener("mousedown", (e) => handleMouseDown(e.button));
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("wheel", handleWheel, { passive: true });
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    handleKey(e.key, e.code); // e.code 로 좌/우 modifier 구분
  });
}

// ---- 렌더 루프 (lazy rAF) ----
// 입력 이벤트가 들어올 때만 깨어남. 손이 목표 위치에 수렴하고 모든 애니메이션이
// 끝나면 자동 정지 → idle 시 CPU/GPU 거의 0%.
let rafId = null;
function scheduleFrame() {
  if (rafId == null) rafId = requestAnimationFrame(frame);
}

function frame() {
  rafId = null;
  const now = performance.now();
  const k = 0.22; // 보간 강도

  // 책상 위 마우스 (키보드와 같은 각도로 회전)
  mouseG.setAttribute(
    "transform",
    `translate(${deskMouse.x.toFixed(1)} ${deskMouse.y.toFixed(1)}) rotate(${VIEW_ROT_DEG})`
  );

  // 왼손 목표
  let ltx, lty;
  if (now - leftTap.time < TAP_MS) {
    ltx = leftTap.cx;
    lty = leftTap.cy + 3;
  } else {
    ltx = leftHome.cx;
    lty = leftHome.cy;
  }

  // 오른손 목표 (3가지 상태):
  //  1) 키보드 타이핑 중 (양손 모드)
  //  2) 마우스 idle — 키보드 home(J 키) 위에 대기
  //  3) 마우스 활성 — 마우스 위
  const mouseIdleNow = now - lastMouseMove > MOUSE_IDLE_MS;
  let rtx, rty;
  if (now - rightTap.time < TAP_MS) {
    rtx = rightTap.cx;
    rty = rightTap.cy + 3;
  } else if (mouseIdleNow) {
    rtx = rightHome.cx;
    rty = rightHome.cy;
  } else {
    rtx = deskMouse.x;
    rty = deskMouse.y - 16 + (mouseDown ? 4 : 0); // 발이 마우스를 덜 가리게 위로 띄움
  }

  handL.x = lerp(handL.x, ltx, k);
  handL.y = lerp(handL.y, lty, k);
  handR.x = lerp(handR.x, rtx, k);
  handR.y = lerp(handR.y, rty, k);

  // 어깨를 손 쪽으로 살짝 보간한 위치
  const sLx = shoulderL.x + (handL.x - shoulderL.x) * SHOULDER_FOLLOW_X;
  const sLy = shoulderL.y + (handL.y - shoulderL.y) * SHOULDER_FOLLOW_Y;
  const sRx = shoulderR.x + (handR.x - shoulderR.x) * SHOULDER_FOLLOW_X;
  const sRy = shoulderR.y + (handR.y - shoulderR.y) * SHOULDER_FOLLOW_Y;

  // 다리(rect): 보정된 어깨에서 시작, 손 방향으로 회전.
  // 길이는 어깨~손 거리 - HAND_INSET. 0 이면 팔 끝이 손 위치까지 그대로 와서
  // 손 ellipse 가 팔 끝 둥근 부분과 겹쳐 단일 덩어리처럼 보임.
  const HAND_INSET = 0;
  const lenL = Math.max(0, Math.hypot(handL.x - sLx, handL.y - sLy) - HAND_INSET);
  const angL = (Math.atan2(handL.y - sLy, handL.x - sLx) * 180) / Math.PI;
  armLEl.setAttribute("width", lenL.toFixed(1));
  armLEl.setAttribute("transform", `translate(${sLx.toFixed(1)} ${sLy.toFixed(1)}) rotate(${angL.toFixed(2)})`);

  const lenR = Math.max(0, Math.hypot(handR.x - sRx, handR.y - sRy) - HAND_INSET);
  const angR = (Math.atan2(handR.y - sRy, handR.x - sRx) * 180) / Math.PI;
  armREl.setAttribute("width", lenR.toFixed(1));
  armREl.setAttribute("transform", `translate(${sRx.toFixed(1)} ${sRy.toFixed(1)}) rotate(${angR.toFixed(2)})`);

  // 발(g): 손 좌표로 이동, 오른발은 좌우 반전
  handLEl.setAttribute("transform", `translate(${handL.x.toFixed(1)} ${handL.y.toFixed(1)})`);
  handREl.setAttribute("transform", `translate(${handR.x.toFixed(1)} ${handR.y.toFixed(1)}) scale(-1,1)`);

  // 캐릭터 살짝 끄덕임 (입력 시) — 사진 전체를 위아래로 미세 이동
  let bob = 0;
  if (now - headBobTime < 200) {
    bob = Math.sin(((now - headBobTime) / 200) * Math.PI) * -4;
  }
  charImg.setAttribute(
    "transform",
    `rotate(${CHAR_ROT_DEG} ${CHAR_CENTER.x} ${CHAR_CENTER.y}) translate(0 ${bob.toFixed(2)})`
  );

  // 수렴 판정 — 손이 목표에 근접 + 모든 시간 기반 애니메이션 종료 → rAF 정지
  const EPS = 0.1;
  const handLDone = Math.abs(handL.x - ltx) < EPS && Math.abs(handL.y - lty) < EPS;
  const handRDone = Math.abs(handR.x - rtx) < EPS && Math.abs(handR.y - rty) < EPS;
  const tapsDone = (now - leftTap.time >= TAP_MS) && (now - rightTap.time >= TAP_MS);
  const bobDone = (now - headBobTime >= 200);
  if (handLDone && handRDone && tapsDone && bobDone) {
    return; // 정지. 다음 입력이 scheduleFrame() 으로 깨움
  }
  rafId = requestAnimationFrame(frame);
}

scheduleFrame();
