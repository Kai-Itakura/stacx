#!/usr/bin/env node
/**
 * StacX デザインレビュー用の撮影・計測ハーネス。
 *
 * 「崩れている気がする」を数値に変えるのが目的。目視では見えない次の 4 つを測る:
 *   1. 横方向の溢れ（+何 px か、どの要素か）
 *   2. 見出しの意図しない折り返し（ページが溢れないまま壊れるケースを捕まえる）
 *   3. 固有幅（min-content）より狭く潰されている入力（WebKit で溢れる予兆）
 *   4. タップ領域の不足
 *
 * 使い方:
 *   node review.mjs --session <SESSION_ID> [--pages /,/memos] [--viewports 390x844,1440x900]
 *                   [--base http://localhost:5173] [--out <dir>]
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// ---------------------------------------------------------------- 引数

const argv = process.argv.slice(2);
const arg = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const SESSION = arg("session");
if (!SESSION) {
  console.error("✘ --session <SESSION_ID> が必要。prepare.sh の出力を渡すこと。");
  process.exit(1);
}
const BASE = arg("base", "http://localhost:5173");
const PAGES = arg("pages", "/,/memos,/projects,/projects/p_review,/projects/new")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// SP と PC を必ず含める。375 / 320 も既定で回すのは、390px で無事でも
// より狭い幅で崩れることが実際にあったため（h1 の折返しは 320px で顕在化した）。
const VIEWPORTS = arg("viewports", "390x844,375x812,320x568,1440x900")
  .split(",")
  .map((s) => {
    const [w, h] = s.trim().split("x").map(Number);
    return { w, h, mobile: w < 768, key: `${w < 768 ? "sp" : "pc"}${w}` };
  });
const OUT = arg(
  "out",
  path.join(process.env.TMPDIR || "/tmp", `stacx-design-review-${process.pid}`),
);

// ---------------------------------------------------- Playwright の解決

/** この環境の Chromium を探す。playwright install は実行しない（環境で禁止）。 */
function findChromium() {
  const root = "/opt/pw-browsers";
  if (!fs.existsSync(root)) return undefined;
  const candidates = fs
    .readdirSync(root)
    .filter((d) => d.startsWith("chromium") && !d.includes("headless_shell"))
    .map((d) => path.join(root, d, "chrome-linux", "chrome"))
    .filter((p) => fs.existsSync(p));
  return candidates[0]; // 見つからなければ undefined → playwright の既定解決に任せる
}

/**
 * playwright を読み込む。リポジトリに無ければ作業ディレクトリ側へ入れる（package.json は汚さない）。
 * playwright は CJS なので、絶対パスで dynamic import すると named export を取り逃すことがある。
 * そのため createRequire 経由で読み、`chromium` が取れることまで確認して返す。
 */
async function loadPlaywright() {
  const pick = (m) => (m?.chromium ? m : m?.default?.chromium ? m.default : null);

  try {
    const found = pick(await import("playwright"));
    if (found) return found;
  } catch {
    // 解決できなければ下の導入へ進む
  }

  const dir = path.join(OUT, ".pw");
  fs.mkdirSync(dir, { recursive: true });
  console.log(
    "… playwright が未解決のため作業ディレクトリへ導入する（リポジトリの依存は変更しない）",
  );
  execSync("npm i --silent playwright", {
    cwd: dir,
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" },
  });
  const require_ = createRequire(path.join(dir, "noop.js"));
  const found = pick(require_("playwright"));
  if (!found) throw new Error("playwright を読み込めなかった（chromium が見つからない）");
  return found;
}

// ------------------------------------------------- ページ内で走る計測

/** ブラウザ側で実行される。ここでの戻り値がレポートの生データになる。 */
function collectMetrics() {
  const de = document.documentElement;
  const clientW = de.clientWidth;

  // 1) 横溢れ。差分 px と、実際にはみ出している要素を控える。
  //    親子で重複して出るので、テキストの短いものから最大 8 件に絞る。
  const overflowing = [...document.querySelectorAll("body *")]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.right > clientW + 1 && r.width > 0)
    .slice(0, 8)
    .map(({ el, r }) => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || "").toString().slice(0, 80),
      right: Math.round(r.right),
      text: (el.textContent || "").trim().slice(0, 30),
    }));

  // 2) 見出しの折り返し。日本語は任意の位置で改行できるため、flex 行で幅が
  //    足りないと h1 が縦積みに潰れる。このときページは溢れないので、
  //    scrollWidth だけ見ていると「異常なし」に見えてしまう。
  const headings = [...document.querySelectorAll("h1, h2")].map((h) => {
    const r = h.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(h).lineHeight) || 1;
    return {
      tag: h.tagName.toLowerCase(),
      text: (h.textContent || "").trim().slice(0, 24),
      width: Math.round(r.width),
      height: Math.round(r.height),
      lines: Math.max(1, Math.round(r.height / lh)),
    };
  });

  // 3) 固有幅より狭く潰されている入力。UA が複合コントロール（日付テキスト + ピッカー）を
  //    描く型は、Chromium なら内部表示を圧縮して耐えるが、WebKit は圧縮せず枠外へ溢れる。
  //    つまり「Chromium で無事でも iOS で崩れる」予兆をここで検出する。
  //
  //    対象を日付・時刻系に限定するのは、text / number の min-content が既定の size 属性
  //    由来で常に 200px 超になり、縮めても中身がスクロールするだけで溢れないため。
  //    全 input を対象にすると誤検知だらけになって本当の予兆が埋もれる。
  const UA_COMPOSITE_TYPES = new Set(["date", "datetime-local", "month", "week", "time"]);
  const squeezed = [];
  for (const el of document.querySelectorAll("input")) {
    if (!UA_COMPOSITE_TYPES.has((el.getAttribute("type") || "").toLowerCase())) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    const probe = el.cloneNode(true);
    probe.style.cssText = "width:min-content;position:absolute;visibility:hidden;left:-9999px";
    document.body.appendChild(probe);
    const minContent = Math.round(probe.getBoundingClientRect().width);
    probe.remove();
    if (minContent > Math.round(r.width) + 1) {
      squeezed.push({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || "",
        name: el.getAttribute("name") || "",
        rendered: Math.round(r.width),
        minContent,
        deficit: minContent - Math.round(r.width),
      });
    }
  }

  // 4) タップ領域。WCAG 2.5.8(AA) は 24px、2.5.5(AAA) と iOS HIG は 44px。
  //    両方の閾値を分けて出す（44px 未満を一律「違反」と書くと不正確になる）。
  const targets = [...document.querySelectorAll("button, a[href], select, input, textarea")]
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        w: Math.round(r.width),
        h: Math.round(r.height),
        label: (
          el.textContent ||
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          ""
        )
          .trim()
          .slice(0, 20),
      };
    })
    .filter((t) => t.h > 0 && t.h < 44);

  // 5) 主要フォーム下の未使用領域。最重要画面が画面上部の細い帯になっていないかを見る。
  const ta = document.querySelector("textarea");
  const mainForm = ta ? ta.closest("form") : null;
  // フォームがビューポートを超える場合（unused が負）は「未使用領域」ではなく
  // 単にスクロールが必要なだけなので、指標として報告しない。
  const dead = mainForm
    ? (() => {
        const bottom = Math.round(mainForm.getBoundingClientRect().bottom);
        const unused = window.innerHeight - bottom;
        if (unused <= 0) return { overflowsViewport: true };
        return {
          formBottom: bottom,
          viewportH: window.innerHeight,
          unused,
          pct: Math.round((unused / window.innerHeight) * 100),
        };
      })()
    : null;
  const textarea = ta
    ? {
        w: Math.round(ta.getBoundingClientRect().width),
        h: Math.round(ta.getBoundingClientRect().height),
        rowsAttr: ta.getAttribute("rows"),
      }
    : null;

  return {
    scrollW: de.scrollWidth,
    clientW,
    overflow: de.scrollWidth - clientW,
    overflowing,
    headings,
    squeezed,
    smallTargets: targets,
    deadSpace: dead,
    textarea,
  };
}

// ---------------------------------------------------------------- 実行

const { chromium } = await loadPlaywright();
const shotsDir = path.join(OUT, "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const executablePath = findChromium();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const report = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 2 : 1,
    locale: "ja-JP",
    colorScheme: "dark",
  });
  // Secure 属性付きでも localhost は secure context 扱いなのでブラウザが受け付ける。
  await ctx.addCookies([
    {
      name: "stacx_session",
      value: SESSION,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: true,
    },
  ]);
  const page = await ctx.newPage();

  for (const p of PAGES) {
    const slug = p === "/" ? "root" : p.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
    let metrics;
    try {
      await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(300);
      metrics = await page.evaluate(collectMetrics);
      await page.screenshot({ path: path.join(shotsDir, `${vp.key}-${slug}.png`), fullPage: true });
    } catch (e) {
      metrics = { error: String(e).slice(0, 200) };
    }
    // ログインへ飛ばされていないかを確認する。全ページがログイン画面のスクショに
    // なっている事故を後から気づくのは面倒なので、URL を残しておく。
    const finalUrl = page.url();
    report.push({ viewport: vp.key, width: vp.w, height: vp.h, path: p, finalUrl, ...metrics });
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

// ---------------------------------------------------------- 要約の出力

const redirected = report.filter((r) => /\/login/.test(r.finalUrl || ""));
if (redirected.length === report.length) {
  console.error("\n✘ すべてログインへリダイレクトされた。セッションが効いていない。");
  console.error("  prepare.sh を再実行し、Cookie 名（ローカルは stacx_session）と");
  console.error("  疎通確認（認証あり=200）を先に通すこと。\n");
}

let issues = 0;
for (const vp of VIEWPORTS) {
  const rows = report.filter((r) => r.viewport === vp.key);
  console.log(`\n===== ${vp.key.toUpperCase()} (${vp.w}x${vp.h}) =====`);
  for (const r of rows) {
    if (r.error) {
      console.log(`  ${r.path.padEnd(22)} ✘ ${r.error}`);
      continue;
    }
    const flags = [];
    if (r.overflow > 0) flags.push(`⚠ 横スクロール +${r.overflow}px`);
    const wrapped = (r.headings || []).filter((h) => h.lines > 1);
    for (const h of wrapped)
      flags.push(`⚠ ${h.tag}"${h.text}" が ${h.lines} 行に折返し（幅 ${h.width}px）`);
    for (const s of r.squeezed || [])
      flags.push(
        `⚠ ${s.tag}[${s.type}] が固有幅より ${s.deficit}px 狭い（実幅 ${s.rendered} < min-content ${s.minContent}）→ WebKit で溢れる恐れ`,
      );
    issues += flags.length;
    console.log(
      `  ${r.path.padEnd(22)} ${flags.length ? flags.join(`\n${" ".repeat(26)}`) : "OK"}`,
    );
    for (const o of r.overflowing || [])
      console.log(`${" ".repeat(26)}はみ出し: <${o.tag}> right=${o.right} "${o.text}" [${o.cls}]`);
    if (r.textarea)
      console.log(
        `${" ".repeat(26)}textarea ${r.textarea.w}x${r.textarea.h}px (rows=${r.textarea.rowsAttr})` +
          (r.deadSpace?.unused
            ? ` / フォーム下の未使用 ${r.deadSpace.unused}px (${r.deadSpace.pct}%)`
            : r.deadSpace?.overflowsViewport
              ? " / フォームがビューポートを超える（スクロール要）"
              : ""),
      );
    const small = r.smallTargets || [];
    // 24px 未満は WCAG 2.5.8(AA) 違反なので、どの要素かまで出す。件数だけでは直せない。
    const belowAA = small.filter((t) => t.w < 24 || t.h < 24);
    if (small.length)
      console.log(
        `${" ".repeat(26)}44px 未満のタップ領域 ${small.length} 件` +
          (belowAA.length
            ? `（うち ${belowAA.length} 件は 24px 未満 = WCAG 2.5.8 AA 違反）`
            : "（WCAG 2.5.8 AA の 24px は充足）"),
      );
    for (const t of belowAA)
      console.log(`${" ".repeat(26)}  ⚠ AA 違反: <${t.tag}> ${t.w}x${t.h}px "${t.label}"`);
  }
}

console.log(`\n検出: ${issues} 件`);
console.log(`スクショ: ${shotsDir}`);
console.log(`生データ: ${path.join(OUT, "report.json")}`);
console.log(
  "\n次: references/checklist.md を読んで結果を解釈する（特に date 入力と WebKit の項）。",
);
