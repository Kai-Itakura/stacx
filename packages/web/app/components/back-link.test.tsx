import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBrowserRouter, Link, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { BackLink } from "./back-link";

/**
 * 戻る判定に実際の window.history を使うため、メモリではなくブラウザのルーターで描画する。
 * 本番では ScrollRestoration のスクリプトが初回表示時に history.state へ key を書くので、それを再現する。
 */
function renderAt(path: string) {
  window.history.replaceState({ key: "from-scroll-restoration" }, "", path);
  const router = createBrowserRouter([
    {
      path: "/tags",
      Component: () => (
        <>
          <p>タグ管理</p>
          <Link to="/memos/m1/star">STAR を開く</Link>
        </>
      ),
    },
    { path: "/memos", Component: () => <p>メモ一覧</p> },
    { path: "/memos/:id/star", Component: () => <BackLink fallback="/memos">キャンセル</BackLink> },
  ]);
  render(<RouterProvider router={router} />);
}

describe("BackLink", () => {
  it("アプリ内で遷移してきたなら、来た画面に戻る", async () => {
    const user = userEvent.setup();
    renderAt("/tags");
    await user.click(await screen.findByRole("link", { name: "STAR を開く" }));
    await user.click(await screen.findByRole("link", { name: "キャンセル" }));
    expect(await screen.findByText("タグ管理")).toBeInTheDocument();
  });

  it("直接開いた画面では fallback へ遷移する", async () => {
    const user = userEvent.setup();
    renderAt("/memos/m1/star");
    await user.click(await screen.findByRole("link", { name: "キャンセル" }));
    expect(await screen.findByText("メモ一覧")).toBeInTheDocument();
  });

  it("新しいタブで開けるよう href は fallback を指す", async () => {
    renderAt("/memos/m1/star");
    expect(await screen.findByRole("link", { name: "キャンセル" })).toHaveAttribute(
      "href",
      "/memos",
    );
  });
});
