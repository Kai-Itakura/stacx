import "@testing-library/jest-dom/vitest";
import { parseWithZod } from "@conform-to/zod/v4";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { ProjectForm } from "./project-form";
import { type ProjectSummary, projectFormSchema, toProjectPayload } from "./schema";

/** action に届いた FormData を projectFormSchema で検証し、payload を記録するスタブ。 */
function captureAction() {
  const payloads: ReturnType<typeof toProjectPayload>[] = [];
  const fn = async ({ request }: { request: Request }) => {
    const submission = parseWithZod(await request.formData(), { schema: projectFormSchema });
    if (submission.status !== "success") return submission.reply();
    payloads.push(toProjectPayload(submission.value));
    return submission.reply({ resetForm: true });
  };
  return { fn, payloads };
}

type StubAction = Parameters<typeof createRoutesStub>[0][number]["action"];

function renderForm(props: { project?: ProjectSummary; action?: StubAction }) {
  const Stub = createRoutesStub([
    {
      path: "/projects/edit",
      Component: () => <ProjectForm project={props.project} submitLabel="保存" />,
      action: props.action ?? (() => ({ ok: true })),
    },
    { path: "/projects", Component: () => <div>一覧</div> },
  ]);
  render(<Stub initialEntries={["/projects/edit"]} />);
}

describe("ProjectForm", () => {
  it("必須項目が揃えば payload を送信する", async () => {
    const user = userEvent.setup();
    const { fn, payloads } = captureAction();
    renderForm({ action: fn });

    await user.type(screen.getByLabelText("プロジェクト名"), "案件A");
    await user.type(screen.getByLabelText("開始日"), "2024-01-01");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(payloads).toHaveLength(1));
    expect(payloads[0]).toMatchObject({ name: "案件A", startDate: "2024-01-01", endDate: null });
  });

  it("プロジェクト名が空なら検証エラーを出して送信しない", async () => {
    const user = userEvent.setup();
    const { fn, payloads } = captureAction();
    renderForm({ action: fn });

    await user.type(screen.getByLabelText("開始日"), "2024-01-01");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("プロジェクト名を入力してください")).toBeInTheDocument();
    expect(payloads).toHaveLength(0);
  });

  it("技術スタックのチップを追加すると techStack に含めて送信する", async () => {
    const user = userEvent.setup();
    const { fn, payloads } = captureAction();
    renderForm({ action: fn });

    await user.type(screen.getByLabelText("プロジェクト名"), "案件A");
    await user.type(screen.getByLabelText("開始日"), "2024-01-01");
    const techInput = screen.getByPlaceholderText("例: Go, React");
    await user.type(techInput, "Go{Enter}");
    await user.type(techInput, "React{Enter}");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(payloads).toHaveLength(1));
    expect(payloads[0].techStack).toEqual(["Go", "React"]);
  });

  it("チーム規模は数値に変換して送信する", async () => {
    const user = userEvent.setup();
    const { fn, payloads } = captureAction();
    renderForm({ action: fn });

    await user.type(screen.getByLabelText("プロジェクト名"), "案件A");
    await user.type(screen.getByLabelText("開始日"), "2024-01-01");
    await user.type(screen.getByLabelText("チーム規模"), "5");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(payloads).toHaveLength(1));
    expect(payloads[0].teamSize).toBe(5);
  });

  it("編集時は既存値をフォームに反映する", async () => {
    const project: ProjectSummary = {
      id: "p1",
      name: "既存PJ",
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-06-30T00:00:00.000Z",
      summary: "概要",
      teamSize: 3,
      role: "リード",
      techStack: ["Go"],
    };
    renderForm({ project });

    expect(await screen.findByLabelText("プロジェクト名")).toHaveValue("既存PJ");
    expect(screen.getByLabelText("開始日")).toHaveValue("2024-01-01");
    expect(screen.getByLabelText("終了日（空で進行中）")).toHaveValue("2024-06-30");
    expect(screen.getByRole("button", { name: "Go を削除" })).toBeInTheDocument();
  });
});
