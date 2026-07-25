/**
 * ファビコン一式（favicon.svg / favicon.ico / apple-touch-icon.png）を public/ に生成する。
 *
 * StacX のマークは「積み重なるメモ」を表す 3 枚のスラブ。右上に向かってずれながら
 * 明度が上がることで、日々の 1 分メモが職務経歴書という成果に積み上がる様子を表す。
 * デザインの正はこのファイルの定数のみ。SVG も画像もここから生成する。
 *
 * 実行: pnpm --filter @stacx/web icons
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// --- デザイン定義（32x32 のデザインキャンバス基準） -----------------------------

const CANVAS = 32;
/** app.css の --background(dark) / oklch(0.145 0 0) と同値。 */
const BG = [0x0a, 0x0a, 0x0a];
/** app.css の --foreground(dark) / oklch(0.985 0 0) と同値。 */
const FG = [0xfa, 0xfa, 0xfa];
/** --radius(0.625rem) をタイル 32px 相当に合わせた角丸。 */
const TILE_RADIUS = 7;

const SLAB_W = 15;
const SLAB_H = 5;
/** 下から上へ。x を右にずらして「積み上がり」を、opacity を上ほど濃くして新しさを表す。 */
const SLABS = [
  { x: 4, y: 21.5, opacity: 0.7 },
  { x: 8.5, y: 13.5, opacity: 0.85 },
  { x: 13, y: 5.5, opacity: 1 },
];

// --- ラスタライズ ---------------------------------------------------------------

/** 角丸長方形の符号付き距離（デザイン単位）。負なら内側。 */
function roundedRectDistance(px, py, x, y, w, h, r) {
  const dx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const dy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - r;
}

/** RGBA(ストレートアルファ)の src を dst にソースオーバー合成する。 */
function composite(dst, i, rgb, alpha) {
  if (alpha <= 0) return;
  const da = dst[i + 3] / 255;
  const outA = alpha + da * (1 - alpha);
  if (outA <= 0) return;
  for (let c = 0; c < 3; c++) {
    const dc = dst[i + c];
    dst[i + c] = Math.round((rgb[c] * alpha + dc * da * (1 - alpha)) / outA);
  }
  dst[i + 3] = Math.round(outA * 255);
}

/**
 * マークを size x size の RGBA バッファに描く。
 * 距離場を 1px 幅でクランプすることでアンチエイリアスを掛ける。
 * bleed=true は角丸なしの全面塗り（iOS が独自にマスクするため）。
 */
function render(size, { bleed = false } = {}) {
  const scale = size / CANVAS;
  const pixels = new Uint8Array(size * size * 4);
  const shapes = [
    { x: 0, y: 0, w: CANVAS, h: CANVAS, r: bleed ? 0 : TILE_RADIUS, rgb: BG, opacity: 1 },
    ...SLABS.map((s) => ({
      x: s.x,
      y: s.y,
      w: SLAB_W,
      h: SLAB_H,
      r: SLAB_H / 2,
      rgb: FG,
      opacity: s.opacity,
    })),
  ];

  for (let py = 0; py < size; py++) {
    const y = (py + 0.5) / scale;
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / scale;
      const i = (py * size + px) * 4;
      for (const s of shapes) {
        const d = roundedRectDistance(x, y, s.x, s.y, s.w, s.h, s.r) * scale;
        const coverage = Math.min(Math.max(0.5 - d, 0), 1);
        composite(pixels, i, s.rgb, coverage * s.opacity);
      }
    }
  }
  return pixels;
}

// --- PNG エンコード -------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // 10-12: compression / filter / interlace = 0

  // 各行の先頭にフィルタタイプ 0(None) を付ける。
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- ICO エンコード（PNG 埋め込み形式） -----------------------------------------

function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const dir = entries.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size < 256 ? size : 0;
    entry[1] = size < 256 ? size : 0;
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
}

// --- SVG -----------------------------------------------------------------------

function buildSvg() {
  const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  const slabs = SLABS.map((s) => {
    const opacity = s.opacity === 1 ? "" : ` opacity="${s.opacity}"`;
    return `    <rect x="${s.x}" y="${s.y}" width="${SLAB_W}" height="${SLAB_H}" rx="${SLAB_H / 2}"${opacity} />`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}" role="img" aria-label="StacX">
  <title>StacX</title>
  <rect width="${CANVAS}" height="${CANVAS}" rx="${TILE_RADIUS}" fill="${hex(BG)}" />
  <g fill="${hex(FG)}">
${slabs}
  </g>
</svg>
`;
}

// --- 出力 -----------------------------------------------------------------------

mkdirSync(PUBLIC_DIR, { recursive: true });

writeFileSync(join(PUBLIC_DIR, "favicon.svg"), buildSvg());

const icoSizes = [16, 32, 48];
writeFileSync(
  join(PUBLIC_DIR, "favicon.ico"),
  encodeIco(icoSizes.map((size) => ({ size, png: encodePng(render(size), size) }))),
);

// iOS はホーム画面追加時に独自の角丸マスクを掛けるため、角丸なしの全面塗りで出す。
writeFileSync(
  join(PUBLIC_DIR, "apple-touch-icon.png"),
  encodePng(render(180, { bleed: true }), 180),
);

console.log("generated: favicon.svg, favicon.ico, apple-touch-icon.png");
