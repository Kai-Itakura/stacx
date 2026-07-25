/**
 * ファビコン一式（favicon.svg / favicon.ico / apple-touch-icon.png）を public/ に生成する。
 *
 * StacX のマークは、アイソメトリックに積み重なった 3 枚のプレート。日々の 1 分メモが
 * 層として積み上がり、最上段（最も明るいライム）が職務経歴書という成果になる、という
 * コンセプトを表す。下段ほど濃い緑にして、蓄積の深さと成長を同時に見せている。
 *
 * デザインの正はこのファイルの定数のみ。SVG も画像もここから生成する。
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
const TILE_BG = "#0a0a0a";
/** --radius(0.625rem) をタイル 32px 相当に合わせた角丸。 */
const TILE_RADIUS = 7;

/** プレート（菱形）の半幅・半高・角丸。半高との比でアイソメトリックな厚みを出す。 */
const PLATE_HW = 12;
const PLATE_HH = 5.6;
const PLATE_R = 1.5;
/** プレート同士の間に入れる背景色の抜き幅。 */
const PLATE_GAP = 1.15;

/** 下から上へ。上のプレートが下のプレートの奥半分を隠すので、この順に描く。 */
const PLATES = [
  { cy: 21.2, color: "#2f7d32" },
  { cy: 16.0, color: "#69b52f" },
  { cy: 10.8, color: "#b7e03a" },
];

/** 菱形の頂点。角丸 PLATE_R 分だけ内側に縮めておき、描画側で膨らませて元の大きさに戻す。 */
function plateVertices(cy, grow) {
  const hw = PLATE_HW - PLATE_R + grow;
  const hh = PLATE_HH - PLATE_R + grow;
  return [
    [CANVAS / 2 - hw, cy],
    [CANVAS / 2, cy - hh],
    [CANVAS / 2 + hw, cy],
    [CANVAS / 2, cy + hh],
  ];
}

/** タイル → 各プレート（手前に抜きを敷いてから本体）の順に重ねた描画リスト。 */
function buildLayers({ bleed = false } = {}) {
  const layers = [
    { kind: "rect", radius: bleed ? 0 : TILE_RADIUS, color: TILE_BG },
    ...PLATES.flatMap(({ cy, color }) => [
      { kind: "plate", points: plateVertices(cy, PLATE_GAP), color: TILE_BG },
      { kind: "plate", points: plateVertices(cy, 0), color },
    ]),
  ];
  return layers;
}

const parseHex = (h) => [
  Number.parseInt(h.slice(1, 3), 16),
  Number.parseInt(h.slice(3, 5), 16),
  Number.parseInt(h.slice(5, 7), 16),
];

// --- ラスタライズ ---------------------------------------------------------------

/** 角丸長方形の符号付き距離（デザイン単位）。負なら内側。 */
function roundedRectDistance(px, py, x, y, w, h, r) {
  const dx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const dy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

/** 凸多角形を r だけ膨らませた形の符号付き距離。各辺の外向き半平面の最大値で求める。 */
function convexPolygonEdges(points) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  return points.map((v, i) => {
    const w = points[(i + 1) % points.length];
    const len = Math.hypot(w[1] - v[1], w[0] - v[0]);
    let nx = (w[1] - v[1]) / len;
    let ny = -(w[0] - v[0]) / len;
    // 重心が正側に来る向きは内向きなので反転して外向きに揃える。
    if (nx * (cx - v[0]) + ny * (cy - v[1]) > 0) {
      nx = -nx;
      ny = -ny;
    }
    return [v[0], v[1], nx, ny];
  });
}

function roundedPolygonDistance(px, py, edges, r) {
  let d = Number.NEGATIVE_INFINITY;
  for (const [vx, vy, nx, ny] of edges) d = Math.max(d, (px - vx) * nx + (py - vy) * ny);
  return d - r;
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
function render(size, options) {
  const scale = size / CANVAS;
  const pixels = new Uint8Array(size * size * 4);
  const shapes = buildLayers(options).map((layer) => ({
    rgb: parseHex(layer.color),
    edges: layer.kind === "plate" ? convexPolygonEdges(layer.points) : null,
    radius: layer.radius,
  }));

  for (let py = 0; py < size; py++) {
    const y = (py + 0.5) / scale;
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / scale;
      const i = (py * size + px) * 4;
      for (const s of shapes) {
        const d = s.edges
          ? roundedPolygonDistance(x, y, s.edges, PLATE_R)
          : roundedRectDistance(x, y, 0, 0, CANVAS, CANVAS, s.radius);
        composite(pixels, i, s.rgb, Math.min(Math.max(0.5 - d * scale, 0), 1));
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

/**
 * 角丸多角形は「多角形 + 同色の stroke-linejoin=round」で表現する。
 * stroke は輪郭の外側に半分だけ乗るので、太さ 2r はラスタライズ側の「r 膨らませ」と等価。
 */
function buildSvg() {
  const body = buildLayers()
    .map((layer) => {
      if (layer.kind === "rect") {
        return `  <rect width="${CANVAS}" height="${CANVAS}" rx="${layer.radius}" fill="${layer.color}" />`;
      }
      const points = layer.points.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(" ");
      return `  <polygon points="${points}" fill="${layer.color}" stroke="${layer.color}" stroke-width="${PLATE_R * 2}" stroke-linejoin="round" />`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}" role="img" aria-label="StacX">
  <title>StacX</title>
${body}
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
