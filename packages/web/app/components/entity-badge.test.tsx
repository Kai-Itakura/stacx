import "@testing-library/jest-dom/vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { ProjectBadge, TagBadge, TechBadge } from "./entity-badge";

/** ProjectBadge が Link を含み得るため、router 内で描画する。 */
function render(ui: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{ui}</> }]);
  return rtlRender(<Stub initialEntries={["/"]} />);
}

/** バッジ本体（data-slot="badge"）を取り出す。 */
const badgeOf = (label: string) => screen.getByText(label).closest("[data-slot='badge']");

describe("entity badges", () => {
  it("プロジェクトはバッジにせず、タグとは見た目の種類から分ける", () => {
    render(
      <>
        <ProjectBadge name="StacX開発" />
        <TagBadge name="トラブル" />
      </>,
    );
    expect(badgeOf("StacX開発")).toBeNull();
    expect(badgeOf("トラブル")).not.toBeNull();
  });

  it("プロジェクトは進行中と完了をアイコンで示す", () => {
    render(
      <>
        <ProjectBadge name="進行中PJ" active />
        <ProjectBadge name="完了PJ" active={false} />
      </>,
    );
    expect(screen.getByLabelText("進行中")).toBeInTheDocument();
    expect(screen.getByLabelText("完了")).toBeInTheDocument();
  });

  it("3 種すべてが軸を示すアイコンを持つ", () => {
    const { container } = render(
      <>
        <ProjectBadge name="StacX開発" />
        <TagBadge name="トラブル" />
        <TechBadge name="React" />
      </>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(3);
  });

  it("タグ名ごとに配色クラスが変わる", () => {
    render(
      <>
        <TagBadge name="トラブル" />
        <TagBadge name="学び" />
      </>,
    );
    const a = badgeOf("トラブル")?.className ?? "";
    const b = badgeOf("学び")?.className ?? "";
    expect(a).toMatch(/tag-\d/);
    expect(a).not.toBe(b);
  });

  it("id を渡すと下線付きのプロジェクト詳細リンクになる", () => {
    render(<ProjectBadge id="p1" name="StacX開発" />);
    const link = screen.getByRole("link", { name: /StacX開発/ });
    expect(link).toHaveAttribute("href", "/projects/p1");
    expect(link).toHaveClass("underline");
  });

  it("id が無ければリンクにしない", () => {
    render(<ProjectBadge name="StacX開発" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("技術スタックは枠線で描き、タグと形で区別できる", () => {
    render(
      <>
        <TechBadge name="React" />
        <TagBadge name="React" />
      </>,
    );
    const [tech, tag] = screen.getAllByText("React").map((el) => el.closest("[data-slot='badge']"));
    // 同名でも軸が違えば見た目が変わる
    expect(tech?.className).not.toBe(tag?.className);
    expect(tech).toHaveAttribute("data-variant", "outline");
  });
});
