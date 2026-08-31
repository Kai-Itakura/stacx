import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/lib/api.server";
import EditProject, { action } from "~/routes/projects.$id";

vi.mock("~/lib/auth.server", () => ({ requireUser: vi.fn() }));
vi.mock("~/lib/api.server", () => ({ apiClient: vi.fn() }));

/** apiClient().api.projects[":id"] の $put / $delete を差し替える。 */
function mockApi(res: { ok: boolean } = { ok: true }) {
  const $put = vi.fn().mockResolvedValue(res);
  const $delete = vi.fn().mockResolvedValue(res);
  vi.mocked(apiClient).mockReturnValue({
    api: { projects: { ":id": { $put, $delete } } },
  } as unknown as ReturnType<typeof apiClient>);
  return { $put, $delete };
}

const call = (fields: [string, string][]) =>
  action({
    request: new Request("http://localhost/projects/p1", {
      method: "post",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: { id: "p1" },
  } as Parameters<typeof action>[0]);

const EDIT: [string, string][] = [
  ["intent", "edit"],
  ["name", "工場生産管理システム"],
  ["startDate", "2026-01-01"],
];

describe("プロジェクト編集画面の action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("intent=edit なら更新して一覧へ戻る", async () => {
    const { $put, $delete } = mockApi();

    const result = await call([...EDIT, ["teamSize", "5"], ["techStack", "TS"]]);

    expect($put).toHaveBeenCalledWith({
      param: { id: "p1" },
      json: {
        name: "工場生産管理システム",
        startDate: "2026-01-01",
        endDate: null,
        summary: null,
        teamSize: 5,
        role: null,
        techStack: ["TS"],
      },
    });
    expect($delete).not.toHaveBeenCalled();
    expect((result as Response).headers.get("location")).toBe("/projects");
  });

  it("intent=delete なら削除して一覧へ戻る", async () => {
    const { $put, $delete } = mockApi();

    const result = await call([["intent", "delete"]]);

    expect($delete).toHaveBeenCalledWith({ param: { id: "p1" } });
    expect($put).not.toHaveBeenCalled();
    expect((result as Response).headers.get("location")).toBe("/projects");
  });

  it("検証に失敗したら API を叩かずエラーを返す", async () => {
    const { $put } = mockApi();

    const result = await call([
      ["intent", "edit"],
      ["name", "   "],
      ["startDate", "2026-01-01"],
    ]);

    expect($put).not.toHaveBeenCalled();
    expect(result).toMatchObject({ error: { name: ["プロジェクト名を入力してください"] } });
  });

  // refine は object の外側に付くため、判別子で分岐したあとも効くことを確かめる。
  it("終了日が開始日より前ならエラーを返す", async () => {
    const { $put } = mockApi();

    const result = await call([
      ["intent", "edit"],
      ["name", "工場生産管理システム"],
      ["startDate", "2026-06-01"],
      ["endDate", "2026-01-01"],
    ]);

    expect($put).not.toHaveBeenCalled();
    expect(result).toMatchObject({ error: { endDate: ["終了日は開始日以降にしてください"] } });
  });

  it("判別子が無ければ API を叩かない", async () => {
    const { $put, $delete } = mockApi();

    await call([
      ["name", "工場生産管理システム"],
      ["startDate", "2026-01-01"],
    ]);

    expect($put).not.toHaveBeenCalled();
    expect($delete).not.toHaveBeenCalled();
  });

  it("更新 API が失敗したらフォーム全体のエラーを返す", async () => {
    mockApi({ ok: false });

    const result = await call(EDIT);

    expect(result).toMatchObject({ error: { "": ["プロジェクトの更新に失敗しました"] } });
  });

  // 以前は 500 を throw してエラー画面に飛ばしていた。フォーム上に出す形へ揃える。
  it("削除 API が失敗したらフォーム全体のエラーを返す", async () => {
    mockApi({ ok: false });

    const result = await call([["intent", "delete"]]);

    expect(result).toMatchObject({ error: { "": ["プロジェクトの削除に失敗しました"] } });
  });
});

const baseProject = {
  id: "p1",
  name: "工場生産管理システム",
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: null,
  summary: null,
  teamSize: null,
  role: null,
  techStack: [] as string[],
};

function renderEdit(onAction: (request: Request) => Promise<unknown>) {
  const Stub = createRoutesStub([
    {
      path: "/projects/:id",
      // biome-ignore lint/suspicious/noExplicitAny: stub の Component 型は実 route と差異がある
      Component: EditProject as any,
      loader: () => ({ project: baseProject }),
      action: ({ request }: { request: Request }) => onAction(request),
      HydrateFallback: () => null,
    },
    { path: "/projects", Component: () => <div>一覧</div> },
  ]);
  render(<Stub initialEntries={["/projects/p1"]} />);
}

describe("プロジェクト編集画面のフォーム", () => {
  // action は判別子でハンドラを引くため、route が intent を渡さないと保存が無反応になる。
  it("更新すると intent=edit を送る", async () => {
    const user = userEvent.setup();
    const intents: (string | null)[] = [];
    renderEdit(async (request) => {
      intents.push((await request.formData()).get("intent") as string | null);
      return null;
    });

    await user.click(await screen.findByRole("button", { name: "更新" }));

    await waitFor(() => expect(intents).toEqual(["edit"]));
  });

  it("確認に同意すると intent=delete を送る", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const user = userEvent.setup();
    const intents: (string | null)[] = [];
    renderEdit(async (request) => {
      intents.push((await request.formData()).get("intent") as string | null);
      return null;
    });

    await user.click(await screen.findByRole("button", { name: "プロジェクトを削除" }));

    await waitFor(() => expect(intents).toEqual(["delete"]));
    vi.unstubAllGlobals();
  });
});
