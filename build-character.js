#!/usr/bin/env node
// ============================================================
// Desk Buddy — 활성 캐릭터 자산을 assets/ + character-config.js 로 복사
// ------------------------------------------------------------
// 사용법:
//   node build-character.js              → package.json 의 "deskBuddy.activeCharacter" 사용
//   node build-character.js shiba        → 강제로 shiba 사용
//   CHARACTER=shiba node build-character.js
//
// npm start / electron-builder 실행 전 prebuild 단계에서 자동 호출됨.
// ============================================================
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const pkg = require(path.join(ROOT, "package.json"));
const argChar = process.argv[2];
const envChar = process.env.CHARACTER;
const pkgChar = pkg.deskBuddy && pkg.deskBuddy.activeCharacter;
const character = argChar || envChar || pkgChar || "poodle";

const charDir = path.join(ROOT, "characters", character);
if (!fs.existsSync(charDir)) {
  console.error(`[build-character] characters/${character}/ not found.`);
  console.error(`available: ${fs.readdirSync(path.join(ROOT, "characters")).filter(n => fs.statSync(path.join(ROOT, "characters", n)).isDirectory()).join(", ")}`);
  process.exit(1);
}

const assetsDir = path.join(ROOT, "assets");
fs.mkdirSync(assetsDir, { recursive: true });

const imageFiles = ["character.png", "paw_only.png", "leg_texture.png", "people.jpg"];
for (const f of imageFiles) {
  const src = path.join(charDir, f);
  if (!fs.existsSync(src)) {
    console.error(`[build-character] characters/${character}/${f} missing.`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(assetsDir, f));
}

const configSrc = path.join(charDir, "config.js");
if (!fs.existsSync(configSrc)) {
  console.error(`[build-character] characters/${character}/config.js missing.`);
  process.exit(1);
}
fs.copyFileSync(configSrc, path.join(ROOT, "character-config.js"));

console.log(`[build-character] active character: ${character}`);
