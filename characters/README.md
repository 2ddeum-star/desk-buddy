# Characters

각 강아지(또는 다른 캐릭터)는 이 디렉토리 안에 자기 폴더를 가집니다.
폴더 안에는 그 캐릭터에 필요한 이미지 자산 4개와 `config.js` 1개를 둡니다.

```
characters/
├── poodle/         ← 디폴트 (검정 푸들)
│   ├── character.png    배경 제거된 강아지 사진 (몸통/얼굴)
│   ├── paw_only.png     발 사진 (배경 제거)
│   ├── leg_texture.png  팔/다리 fill 용 곱슬털 텍스처
│   ├── people.jpg       액자 안 사진
│   └── config.js        캐릭터별 좌표/회전 설정
└── <new-dog>/      ← 새 강아지 추가 시
```

## 새 강아지 추가하기

1. 폴더 만들기
   ```bash
   mkdir characters/shiba
   ```

2. 이미지 4개 넣기 (파일명 정확히 일치해야 함)
   - `character.png` — 배경 투명 PNG. 가슴까지 보이게.
   - `paw_only.png` — 배경 투명 PNG. 발 한 짝.
   - `leg_texture.png` — 알파 없는 곱슬털 텍스처 (팔 fill 용).
   - `people.jpg` — 액자 안 사진 (아무거나).

3. `config.js` 작성 — `characters/poodle/config.js` 를 복사해서 시작:
   ```js
   window.CHARACTER_CONFIG = {
     id: "shiba",
     charImg: { x: 245, y: 135, width: 400, height: 450 }, // SVG 내 사진 위치
     charRot: -5,
     charCenter: { x: 445, y: 375 },
     shoulderL: { x: 370, y: 438 },  // 화면 좌측 어깨
     shoulderR: { x: 445, y: 438 },  // 화면 우측 어깨

     // ===== 시각 옵션 =====
     // 팔 fill — "texture" 는 leg_texture.png 패턴, 또는 색 코드(예: "#ffffff", "#d0c4a0")
     armFill: "texture",
     // 발 — "image" 는 paw_only.png, 또는 색 코드 (예: "#ffffff" → SVG 발바닥+발가락 도형)
     pawFill: "image",
     // 책상 위 액자(people.jpg) 표시 여부
     showFrame: true,
   };
   ```

   **시각 옵션**
   - `armFill: "texture"` → `leg_texture.png` 의 곱슬털 패턴
   - `armFill: "#ffffff"` (또는 다른 색) → 단색 팔. `leg_texture.png` 는 안 쓰이지만 더미라도 파일은 있어야 빌드 통과.
   - `pawFill: "image"` → `paw_only.png` 사진을 발로 사용
   - `pawFill: "#ffffff"` (또는 다른 색) → 단색 SVG 발(발바닥+발가락 4개). `paw_only.png` 는 안 쓰이지만 더미라도 있어야 빌드 통과.
   - `showFrame: false` → 책상 위 액자 숨김. `people.jpg` 도 비슷하게 더미 파일이라도 있어야 빌드 통과.

4. 미리보기 (assets/ 에 자산 복사 + 실행):
   ```bash
   CHARACTER=shiba npm start
   # 또는
   node build-character.js shiba && npm start
   ```

5. 어깨/사진 위치가 어색하면 `config.js` 의 값들을 조정. 변경 후 다시 `npm start` (prestart 가 자동으로 갱신).

## 활성 캐릭터 영구 변경

`package.json` 의 `deskBuddy.activeCharacter` 를 수정:

```json
"deskBuddy": {
  "activeCharacter": "shiba"
}
```

이후 `npm start` / `npm run dist:win` / `npm run dist:mac` 모두 자동으로 이 캐릭터를 사용.

## 작동 방식

- `build-character.js` 가 `characters/{active}/` 의 이미지 4개를 `desk-buddy/assets/` 로,
  `config.js` 를 `desk-buddy/character-config.js` 로 복사합니다.
- `index.html` 은 `character-config.js` 를 먼저 로드하고, `main.js` 가 `window.CHARACTER_CONFIG`
  에서 좌표를 읽어 SVG 에 적용합니다.
- 이 복사는 `npm start`, `npm run dist`, GitHub Actions 빌드의 `prestart` / `predist` /
  `Stage active character` 단계에서 자동으로 일어납니다.
- `assets/` 와 `character-config.js` 는 빌드 산출물 성격이라 손으로 수정하지 마세요
  (다음 빌드에서 덮어쓰입니다). 변경은 항상 `characters/{name}/` 에서.
