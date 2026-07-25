import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { ProjectList } from "./project-list";
import type { ProjectSummary } from "./schema";

function renderList(projects: ProjectSummary[]) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <ProjectList projects={projects} /> },
    { path: "/projects/:id", Component: () => <div>編集</div> },
    { path: "/projects/new", Component: () => <div>新規</div> },
  ]);
  render(<Stub initialEntries={["/"]} />);
}

const base: ProjectSummary = {
  id: "p1",
  name: "PJ",
  startDate: "2024-01-01T00:00:00.000Z",
  endDate: null,
  summary: null,
  teamSize: null,
  role: null,
  techStack: [],
};

describe("ProjectList", () => {
  it("空なら作成導線を出す", async () => {
    renderList([]);
    expect(await screen.findByText("最初のプロジェクトを作成")).toBeInTheDocument();
  });

  it("進行中（endDate=null）のプロジェクトを進行中バッジ付きで出す", async () => {
    renderList([{ ...base, id: "p1", name: "進行中PJ", endDate: null }]);
    expect(await screen.findByText("進行中PJ")).toBeInTheDocument();
    expect(screen.getByText("進行中")).toBeInTheDocument();
  });

  it("終了済みプロジェクトは終了日を期間に表示し、進行中バッジは出さない", async () => {
    renderList([
      { ...base, id: "p2", name: "完了PJ", endDate: "2024-06-30T00:00:00.000Z", techStack: ["Go"] },
    ]);
    expect(await screen.findByText("完了PJ")).toBeInTheDocument();
    expect(screen.queryByText("進行中")).not.toBeInTheDocument();
    expect(screen.getByText("2024-01-01 〜 2024-06-30")).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
  });
});
