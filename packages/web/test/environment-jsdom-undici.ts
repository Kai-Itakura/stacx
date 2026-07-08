import { builtinEnvironments } from "vitest/environments";

// なぜこのカスタム環境が必要か:
// jsdom は fetch 関連のグローバル（Request/Response/Headers/fetch/URL/URLSearchParams/
// AbortController/AbortSignal）を独自実装で上書きするが、それらは Node(undici) と非互換。
// React Router のルーターはルーター初期化や送信で Node の Request を使うため、
//   - AbortSignal 不一致 → "Expected signal to be an instance of AbortSignal"
//   - URLSearchParams 不一致 → Request が content-type を付けられず request.formData() が
//     "Content-Type was not one of ..." で失敗
// が起きる。jsdom 起動後にこれらだけ Node ネイティブへ戻して整合させる。
//
// FormData は jsdom のものを残す（new FormData(formElement) でフォームから構築できる）。
// 送信は encType=application/x-www-form-urlencoded で URLSearchParams に変換されるため、
// FormData がボディとして undici Request に渡ることはなく、impedance mismatch は起きない。
//
// happy-dom は submit イベントの target が form 要素にならず Conform の不変条件
// (event.target === document.forms.namedItem(formId)) を満たせないため採用できない。
const NATIVE_GLOBALS = [
  "AbortController",
  "AbortSignal",
  "Request",
  "Response",
  "Headers",
  "fetch",
  "URL",
  "URLSearchParams",
  "Blob",
  "File",
] as const;

export default {
  name: "jsdom-undici",
  transformMode: "web" as const,
  async setup(global: Record<string, unknown>, options: Record<string, unknown>) {
    const native: Record<string, unknown> = {};
    for (const key of NATIVE_GLOBALS) native[key] = global[key];

    const jsdom = await builtinEnvironments.jsdom.setup(global as never, options as never);

    for (const key of NATIVE_GLOBALS) global[key] = native[key];

    return jsdom;
  },
};
