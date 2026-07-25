import { Link } from "react-router";
import { type ProjectSummary, toDateInputValue } from "./schema";

function formatPeriod(p: ProjectSummary): string {
  const start = toDateInputValue(p.startDate);
  const end = p.endDate ? toDateInputValue(p.endDate) : "進行中";
  return `${start} 〜 ${end}`;
}

/** プロジェクト一覧（カード形式・進行中をハイライト）。 */
export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">まだプロジェクトがありません。</p>
        <Link
          to="/projects/new"
          className="text-primary mt-2 inline-block underline-offset-4 hover:underline"
        >
          最初のプロジェクトを作成
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {projects.map((p) => {
        const active = p.endDate === null;
        return (
          <li key={p.id}>
            <Link
              to={`/projects/${p.id}`}
              className={`hover:bg-muted block rounded-lg border p-4 transition-colors ${
                active ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                {active && (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                    進行中
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">{formatPeriod(p)}</p>
              {p.techStack.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.techStack.map((t) => (
                    <span key={t} className="bg-muted rounded-full px-2 py-0.5 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
