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

// 어깨(=다리 시작점) — 몸통(사진 가슴) 쪽으로 더 올림 + 다리도 길어짐
const shoulderL = { x: 370, y: 438 };
const shoulderR = { x: 430, y: 438 };

// 캐릭터 사진 살짝 기울임 — 좌측 잘린 부분이 덜 거슬리게
// index.html 의 charImg 위치(x=275 y=200 w=300 h=327) 기준 사진 중심
const CHAR_ROT_DEG = -5;
const CHAR_CENTER = { x: 425, y: 363.5 };

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
const KB_PIVOT = { x: 115, y: 47 };

function rotateAround(px, py, cx, cy, deg) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

// ---- 키보드 생성 ----
const KB = { gx: 195, gy: 482, kw: 20, kh: 16, gapx: 3, gapy: 3 };
const ROWS = [
  { keys: "1234567890", indent: 0 },
  { keys: "QWERTYUIOP", indent: 8 },
  { keys: "ASDFGHJKL", indent: 18 },
  { keys: "ZXCVBNM", indent: 34 },
];
const keyMap = {}; // 정규화된 키 -> { el, cx, cy } — cx/cy 는 SVG 전역(회전 적용) 좌표
const KB_MID_X = KB.gx + (10 * (KB.kw + KB.gapx)) / 2; // 좌/우손 분기 기준 x (회전 전 로컬 기준)

function makeKey(label, x, y, w, normalized) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "key");
  g.setAttribute("transform", `translate(${x} ${y})`);

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", w);
  rect.setAttribute("height", KB.kh);
  rect.setAttribute("rx", 4);

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", w / 2);
  text.setAttribute("y", KB.kh / 2);
  text.textContent = label;

  g.appendChild(rect);
  g.appendChild(text);
  keyboardG.appendChild(g);

  // 키 중심을 키보드 로컬 좌표에서 회전 후 SVG 전역으로 변환
  const localCx = x + w / 2;
  const localCy = y + KB.kh / 2;
  const rotated = rotateAround(localCx, localCy, KB_PIVOT.x, KB_PIVOT.y, VIEW_ROT_DEG);
  keyMap[normalized] = {
    el: g,
    cx: KB.gx + rotated.x,
    cy: KB.gy + rotated.y,
    localCx: localCx, // 좌/우 분기용 (회전 전)
  };
}

ROWS.forEach((row, r) => {
  const y = r * (KB.kh + KB.gapy);
  [...row.keys].forEach((ch, i) => {
    const x = row.indent + i * (KB.kw + KB.gapx);
    makeKey(ch, x, y, KB.kw, ch.toLowerCase());
  });
});
// 스페이스바
{
  const y = ROWS.length * (KB.kh + KB.gapy);
  const w = 130;
  const x = (10 * (KB.kw + KB.gapx) - w) / 2;
  makeKey("space", x, y, w, " ");
}

// ---- 상태 ----
let deskMouse = { x: 508, y: 522 }; // 책상 위 마우스 목표 위치 (몸통쪽으로 더 가깝게)
const mouseRange = { x: [485, 545], y: [510, 545] };

const leftHome = keyMap["f"] || { cx: 360, cy: 540 };
let handL = { x: leftHome.cx, y: leftHome.cy };
let handR = { x: deskMouse.x, y: deskMouse.y - 8 };

let leftTap = { time: -9999, cx: 0, cy: 0 };
let rightTap = { time: -9999, cx: 0, cy: 0 };
const TAP_MS = 180;

let mouseDown = false;
let headBobTime = -9999;

let hintFaded = false;
function activity() {
  if (!hintFaded) {
    hint.classList.add("fade");
    hintFaded = true;
  }
}

// ---- 입력 처리 (브라우저 DOM / Electron 전역 입력 공용) ----
// fx, fy 는 화면(또는 창) 내 0~1 비율 좌표
function handleMove(fx, fy) {
  fx = clamp(fx, 0, 1);
  fy = clamp(fy, 0, 1);
  deskMouse.x = lerp(mouseRange.x[0], mouseRange.x[1], fx);
  deskMouse.y = lerp(mouseRange.y[0], mouseRange.y[1], fy);
  activity();
}

function handleMouseDown(button = 0) {
  mouseDown = true;
  headBobTime = performance.now();
  // 강아지 시점에 맞춤: 마우스가 180° 회전이라 사용자 좌클릭은 화면 좌측의 버튼(=강아지 우측 = mouseBtnR) 빛남
  flashMouseBtn(button === 2 ? mouseBtnL : mouseBtnR);
}
function handleMouseUp() {
  mouseDown = false;
}

function flashMouseBtn(el) {
  if (!el) return;
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 200);
}

function handleKey(char) {
  activity();
  const now = performance.now();
  headBobTime = now;

  const norm = char && char.length === 1 ? char.toLowerCase() : char === " " ? " " : null;
  const target = norm && keyMap[norm];
  if (!target) return; // 키보드에 그려지지 않은 키는 무시

  target.el.classList.add("active");
  setTimeout(() => target.el.classList.remove("active"), 130);

  // 키보드는 항상 왼발로 타이핑 (오른발은 마우스 전담)
  leftTap = { time: now, cx: target.cx, cy: target.cy };
}

// 입력 소스 연결: Electron(전역 입력)이 있으면 그쪽을, 없으면 브라우저 DOM 이벤트를 사용
const electronAPI = window.deskBuddy;
if (electronAPI) {
  document.body.classList.add("electron");
  const bg = document.getElementById("bg");
  if (bg) bg.style.display = "none"; // 오버레이에서는 배경 숨김(투명)
  // 작은 창에 캐릭터가 꽉 차도록 빈 여백을 잘라낸 viewBox (창 비율 360:300=1.2와 일치)
  svg.setAttribute("viewBox", "120 110 600 500");
  electronAPI.onInput((d) => {
    if (d.type === "move") handleMove(d.fx, d.fy);
    else if (d.type === "key") handleKey(d.char);
    else if (d.type === "mousedown") handleMouseDown();
    else if (d.type === "mouseup") handleMouseUp();
  });
} else {
  window.addEventListener("mousemove", (e) =>
    handleMove(e.clientX / window.innerWidth, e.clientY / window.innerHeight)
  );
  window.addEventListener("mousedown", (e) => handleMouseDown(e.button));
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    handleKey(e.key);
  });
}

// ---- 렌더 루프 ----
function frame() {
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

  // 오른손 목표: 기본은 마우스 윗부분(버튼) 위, 클릭 시 살짝 누름
  let rtx, rty;
  if (now - rightTap.time < TAP_MS) {
    rtx = rightTap.cx;
    rty = rightTap.cy + 3;
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

  // 다리(rect): 보정된 어깨에서 시작, 손 방향으로 회전, 길이는 어깨~손 거리
  const lenL = Math.hypot(handL.x - sLx, handL.y - sLy);
  const angL = (Math.atan2(handL.y - sLy, handL.x - sLx) * 180) / Math.PI;
  armLEl.setAttribute("width", lenL.toFixed(1));
  armLEl.setAttribute("transform", `translate(${sLx.toFixed(1)} ${sLy.toFixed(1)}) rotate(${angL.toFixed(2)})`);

  const lenR = Math.hypot(handR.x - sRx, handR.y - sRy);
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

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
