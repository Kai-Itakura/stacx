import "@testing-library/jest-dom/vitest";
import { parseWithZod } from "@conform-to/zod/v4";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { StarEditor } from "./star-editor";
import { type StarEditorMemo, type StarValues, starFormSchema, toStarPayload } from "./star-schema";

const memo: StarEditorMemo = {
  id: "m1",
  body: "クエリ最適化と Redis 導入",
  projectName: "進行中PJ",
  tagNames: ["技術チャレンジ"],
};

const empty: StarValues = { situation: "", task: "", action: "", result: "" };

/** action に届いた FormData を starFormSchema で検証し、payload を記録するスタブ。 */
function captureAction() {
  const payloads: ReturnType<typeof toStarPayload>[] = [];
  const fn = async ({ request }: { request: Request }) => {
    const submission = parseWithZod(await request.formData(), { schema: starFormSchema });
    if (submission.status !== "success") return submission.reply();
    payloads.push(toStarPayload(submission.value));
    return submission.reply();
  };
  return { fn, payloads };
}

type StubAction = Parameters<typeof createRoutesStub>[0][number]["action"];

function renderEditor(props: { values?: StarValues; action?: StubAction }) {
  const Stub = createRoutesStub([
    {
      path: "/memos/:id/star",
      Component: () => <StarEditor memo={memo} values={props.values ?? empty} />,
      action: props.action ?? (() => ({ ok: true })),
    },
    { path: "/memos", Component: () => <div>一覧</div> },
  ]);
  render(<Stub initialEntries={["/memos/m1/star"]} />);
}

describe("StarEditor", () => {
  it("メモを左ペインに表示する", async () => {
    renderEditor({});
    expect(await screen.findByText("クエリ最適化と Redis 導入")).toBeInTheDocument();
    expect(screen.getByText("進行中PJ")).toBeInTheDocument();
    expect(screen.getByText("技術チャレンジ")).toBeInTheDocument();
  });

  it("既存の STAR 値をフォームに反映する", async () => {
    renderEditor({ values: { ...empty, situation: "本番障害が発生" } });
    expect(await screen.findByLabelText(/Situation/)).toHaveValue("本番障害が発生");
  });

  it("1 項目でも入力すれば payload を送信する", async () => {
    const user = userEvent.setup();
    const { fn, payloads } = captureAction();
    renderEditor({ action: fn });

    await user.type(await screen.findByLabelText(/Result/), "p99 を 280ms に改善");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(payloads).toHaveLength(1));
    expect(payloads[0]).toMatchObject({ result: "p99 を 280ms に改善", situation: "" });
  });

  it("全項目が空なら検証エラーを出して送信しない", async () => {
    const user = userEvent.setup();
    const { fn, payloads } = captureAction();
    renderEditor({ action: fn });

    await user.click(await screen.findByRole("button", { name: "保存" }));

    expect(
      await screen.findByText("S/T/A/R のいずれか 1 つは入力してください"),
    ).toBeInTheDocument();
    expect(payloads).toHaveLength(0);
  });
});
