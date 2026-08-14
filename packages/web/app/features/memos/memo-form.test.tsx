import "@testing-library/jest-dom/vitest";
import { parseWithZod } from "@conform-to/zod/v4";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { memoFormSchema } from "~/features/intake/schema";
import { MemoForm, type MemoFormValues } from "./memo-form";

const projects = [
  { id: "p1", name: "進行中PJ", endDate: null },
  { id: "p2", name: "別PJ", endDate: "2024-06-30T00:00:00.000Z" },
];
const tags = [
  { id: "t1", name: "技術チャレンジ" },
  { id: "t2", name: "チーム改善" },
];

const base: MemoFormValues = { body: "元の本文", projectId: "p1", tagIds: ["t1"] };

/** action に届いた FormData を検証し、payload を記録するスタブ。 */
function captureAction() {
  const calls: Record<string, unknown>[] = [];
  const fn = async ({ request }: { request: Request }) => {
    const fd = await request.formData();
    const submission = parseWithZod(fd, { schema: memoFormSchema });
    if (submission.status !== "success") return submission.reply();
    calls.push({ ...submission.value, tagIds: fd.getAll("tagIds") });
    return submission.reply();
  };
  return { fn, calls };
}

type StubAction = Parameters<typeof createRoutesStub>[0][number]["action"];

function renderForm(props: { memo?: MemoFormValues; action?: StubAction } = {}) {
  const Stub = createRoutesStub([
    {
      path: "/memos/:id/edit",
      Component: () => <MemoForm memo={props.memo ?? base} projects={projects} tags={tags} />,
      action: props.action ?? (() => ({ ok: true })),
    },
    { path: "/memos", Component: () => <div>一覧</div> },
    { path: "/resources/tags/create", action: () => ({ ok: true, tagId: "t-new" }) },
  ]);
  render(<Stub initialEntries={["/memos/m1/edit"]} />);
}

describe("MemoForm", () => {
  it("既存の本文とプロジェクトを反映する", async () => {
    renderForm();
    expect(await screen.findByLabelText("本文")).toHaveValue("元の本文");
    expect(screen.getByLabelText("プロジェクト")).toHaveValue("p1");
  });

  it("既存のタグを選択済みで表示する", async () => {
    renderForm();
    expect(await screen.findByRole("button", { name: "技術チャレンジ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "チーム改善" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("本文・プロジェクト・タグの変更を送信する", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction();
    renderForm({ action: fn });

    const body = await screen.findByLabelText("本文");
    await user.clear(body);
    await user.type(body, "書き直した本文");
    await user.selectOptions(screen.getByLabelText("プロジェクト"), "p2");
    await user.click(screen.getByRole("button", { name: "チーム改善" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ body: "書き直した本文", projectId: "p2" });
    expect(calls[0].tagIds).toEqual(["t1", "t2"]);
  });

  it("本文が空なら検証エラーを出して送信しない", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction();
    renderForm({ action: fn });

    await user.clear(await screen.findByLabelText("本文"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("本文を入力してください")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
