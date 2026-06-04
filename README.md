# Desk Buddy 🖱️⌨️

페이지 위에서 마우스를 움직이거나 키보드를 누르면, 책상 앞에 앉은 캐릭터가 그 입력을 따라 동작하는 웹 프로그램입니다.

## 동작
- **마우스 이동** → 책상 위 마우스가 함께 움직이고, 오른손이 마우스를 따라가며, 눈동자가 커서를 추적합니다.
- **마우스 클릭** → 오른손이 마우스를 살짝 누릅니다.
- **키보드 입력** → 해당 키가 강조되고, 키 위치에 가까운 손(좌/우)이 타이핑하며, 입이 잠깐 벌어집니다.
- 가만히 두면 주기적으로 눈을 깜빡입니다.

## 두 가지 실행 모드

### 1) 브라우저 (가볍게 보기)
설치할 것이 없습니다. `index.html` 을 브라우저로 열면 끝. 단, 보안상 **그 페이지/창 안의 입력만** 감지합니다.

정적 호스팅(GitHub Pages, Netlify, Vercel 등)에 폴더째 올리면 웹에서 바로 동작합니다.

### 2) Electron 데스크톱 앱 (OS 전역 입력 + 바탕화면 마스코트)
투명·항상 위·클릭 통과 오버레이 창으로 떠서, **다른 프로그램을 쓰는 동안에도** 화면 전체의 마우스/키보드를 따라 동작합니다.

```bash
cd desk-buddy
npm install     # electron + uiohook-napi 설치
npm start       # 앱 실행
```

- 종료: **Ctrl + Shift + Q** 또는 시스템 트레이 아이콘 → 종료
- 설치형 `.exe` 빌드: `npm run dist` (electron-builder, `dist/` 에 생성)

> Windows에서 `uiohook-napi`는 보통 미리 빌드된 바이너리를 받아오지만, 환경에 따라 빌드 도구(Visual Studio Build Tools)가 필요할 수 있습니다.
> macOS에서는 "손쉬운 사용/입력 모니터링" 권한을 앱에 허용해야 전역 입력이 감지됩니다.

## 기술
- 프레임워크 없는 바닐라 JavaScript + SVG, `requestAnimationFrame` 보간 루프
- 렌더러(`main.js`)는 브라우저 DOM 입력과 Electron 전역 입력(`window.deskBuddy`) 둘 다 자동 지원
- Electron 메인 프로세스(`electron-main.js`)가 `uiohook-napi`로 전역 마우스/키보드를 받아 IPC로 전달

## 파일 구조
```
desk-buddy/
├── index.html         # 화면(SVG 씬) 구조
├── style.css          # 스타일 / 키캡 강조 / 오버레이 모드
├── main.js            # 입력 처리 · 애니메이션 루프 (렌더러)
├── electron-main.js   # Electron 메인 프로세스 + 전역 입력 캡처
├── preload.js         # 안전한 IPC 브릿지 (window.deskBuddy)
├── package.json       # Electron 실행/빌드 설정
└── README.md
```
