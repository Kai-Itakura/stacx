import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { TagList, type TagListItem } from "./tag-list";

const withMemos: TagListItem = {
  id: "t1",
  name: "トラブル",
  memos: [
    { id: "m1", body: "本番障害の対応" },
    { id: "m2", body: "DB 接続エラー" },
  ],
};

const unused: TagListItem = { id: "t2", name: "学び", memos: [] };

type StubAction = Parameters<typeof createRoutesStub>[0][number]["action"];

function renderList(tags: TagListItem[], action?: StubAction) {
  const Stub = createRoutesStub([
    {
      path: "/tags",
      Component: () => <TagList tags={tags} />,
      action: action ?? (() => null),
    },
  ]);
  return render(<Stub initialEntries={["/tags"]} />);
}

/** action が返す失敗結果。Conform は initialValue から送信元のフォームを引く。 */
function failure(intent: string, id: string, message: string) {
  return () => ({
    status: "error",
    initialValue: { intent, id },
    error: { "": [message] },
  });
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

  it("空の名前では送信せずエラーを出す", async () => {
    const user = userEvent.setup();
    const action = vi.fn(() => null);
    renderList([withMemos], action);

    await user.click(await screen.findByRole("button", { name: "名前を変更" }));
    await user.clear(screen.getByLabelText("トラブル の新しい名前"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("タグ名を入力してください")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("リネームの失敗はリネームフォーム上に出す", async () => {
    const user = userEvent.setup();
    renderList([withMemos], failure("rename", "t1", "同名のタグが既にあります"));

    await user.click(await screen.findByRole("button", { name: "名前を変更" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("同名のタグが既にあります")).toBeInTheDocument();
  });

  // action の結果は画面で 1 つしか無いため、行を絞らないと無関係な行にエラーが出る。
  it("失敗した行以外にはエラーを出さない", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    renderList([withMemos, unused], failure("delete", "t1", "タグの削除に失敗しました"));

    const [firstDelete] = await screen.findAllByRole("button", { name: "削除" });
    await user.click(firstDelete);

    expect(await screen.findByText("タグの削除に失敗しました")).toBeInTheDocument();
    expect(screen.getAllByText("タグの削除に失敗しました")).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("リネーム成功（name が変わる）と編集フォームが閉じる", async () => {
    const user = userEvent.setup();
    // loader 再検証で新しい name が届く状況を、同一ツリー内の再レンダリングで再現する。
    // 木ごと作り直すと key に関係なく state が消えるため、TagList の props だけを差し替える。
    function Harness() {
      const [tags, setTags] = useState([withMemos]);
      return (
        <>
          <button type="button" onClick={() => setTags([{ ...withMemos, name: "障害対応" }])}>
            revalidate
          </button>
          <TagList tags={tags} />
        </>
      );
    }
    const Stub = createRoutesStub([{ path: "/tags", Component: Harness, action: () => ({}) }]);
    render(<Stub initialEntries={["/tags"]} />);

    await user.click(await screen.findByRole("button", { name: "名前を変更" }));
    expect(screen.getByLabelText("トラブル の新しい名前")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "revalidate" }));

    expect(await screen.findByText("障害対応")).toBeInTheDocument();
    expect(screen.queryByLabelText(/新しい名前/)).not.toBeInTheDocument();
  });
});
