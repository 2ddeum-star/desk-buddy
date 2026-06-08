// ============================================================
// Desk Buddy — 캐릭터 설정 (poodle)
// ------------------------------------------------------------
// 이 파일은 build-character.js 가 빌드 직전 desk-buddy/character-config.js 로
// 그대로 복사합니다. 절대 root 의 character-config.js 를 직접 수정하지 마세요
// (다음 빌드에서 덮어쓰입니다). 변경은 항상 여기서.
//
// 새 강아지 추가 방법은 desk-buddy/characters/README.md 참고.
// ============================================================
window.CHARACTER_CONFIG = {
  // 식별자 — productName 등에 활용 (영문/숫자/하이픈만)
  id: "poodle",

  // 캐릭터 사진 (assets/character.png) 의 SVG 내 위치/크기 (viewBox 0~800 × 0~600 기준)
  charImg: { x: 245, y: 135, width: 400, height: 450 },

  // 캐릭터 사진 회전 — 살짝 기울임. 회전 중심은 charCenter
  charRot: -5,
  charCenter: { x: 445, y: 375 },

  // 어깨 위치 (다리/팔이 시작되는 점). 캐릭터 사진 가슴 부근에 오도록 조정
  // shoulderL = 화면 좌측 어깨(=강아지 우측), shoulderR = 화면 우측 어깨(=강아지 좌측)
  shoulderL: { x: 370, y: 438 },
  shoulderR: { x: 445, y: 438 },

  // ===== 시각 옵션 =====
  // 팔 fill — "texture" = leg_texture.png 패턴, 또는 색 코드 (예: "#ffffff", "#d0c4a0")
  armFill: "texture",
  // 발 — "image" = paw_only.png, 또는 색 코드 (예: "#ffffff" → SVG 발 모양)
  pawFill: "image",
  // 책상 위 액자(액자 안에 people.jpg) 표시 여부
  showFrame: true,
};
