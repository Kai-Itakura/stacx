import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { TagList, type TagListItem } from "./tag-list";

const withMemos: TagListItem = {
  id: "t1",
  name: "トラブル",
  memos: [
    { id: "m1", title: "本番障害の対応" },
    { id: "m2", title: "DB 接続エラー" },
  ],
};

const unused: TagListItem = { id: "t2", name: "学び", memos: [] };

function renderList(tags: TagListItem[], error?: string | null) {
  const Stub = createRoutesStub([
    {
      path: "/tags",
      Component: () => <TagList tags={tags} error={error} />,
      action: () => ({ error: null }),
    },
  ]);
  render(<Stub initialEntries={["/tags"]} />);
}

describe("TagList", () => {
  it("タグが無ければ作成導線を案内する", async () => {
    renderList([]);
    expect(await screen.findByText(/まだタグがありません/)).toBeInTheDocument();
  });

  it("使用件数と使用メモを STAR エディタへのリンクで出す", async () => {
    renderList([withMemos]);
    expect(await screen.findByText("2 件のメモで使用中")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "本番障害の対応" })).toHaveAttribute(
      "href",
      "/memos/m1/star",
    );
    expect(screen.getByRole("link", { name: "DB 接続エラー" })).toHaveAttribute(
      "href",
      "/memos/m2/star",
    );
  });

  it("未使用のタグはその旨を出しリンクを並べない", async () => {
    renderList([unused]);
    expect(await screen.findByText("使用中のメモはありません")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("名前を変更を押すとリネームフォームが出る", async () => {
    const user = userEvent.setup();
    renderList([withMemos]);

    await user.click(await screen.findByRole("button", { name: "名前を変更" }));

    expect(screen.getByLabelText("トラブル の新しい名前")).toHaveValue("トラブル");
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  it("action のエラーを表示する", async () => {
    renderList([withMemos], "同名のタグが既にあります");
    expect(await screen.findByText("同名のタグが既にあります")).toBeInTheDocument();
  });
});
