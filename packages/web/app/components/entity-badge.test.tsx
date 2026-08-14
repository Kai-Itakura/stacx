import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectBadge, TagBadge, TechBadge } from "./entity-badge";

/** バッジ本体（data-slot="badge"）を取り出す。 */
const badgeOf = (label: string) => screen.getByText(label).closest("[data-slot='badge']");

describe("entity badges", () => {
  it("プロジェクトとタグは形が異なる（pill か角丸四角か）", () => {
    render(
      <>
        <ProjectBadge name="StacX開発" />
        <TagBadge name="トラブル" />
      </>,
    );
    // 同じ行に並ぶため、色ではなく形で区別できる必要がある
    expect(badgeOf("StacX開発")).toHaveClass("rounded-md");
    expect(badgeOf("トラブル")).not.toHaveClass("rounded-md");
  });

  it("プロジェクトとタグはそれぞれアイコンを持つ", () => {
    const { container } = render(
      <>
        <ProjectBadge name="StacX開発" />
        <TagBadge name="トラブル" />
      </>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(2);
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
