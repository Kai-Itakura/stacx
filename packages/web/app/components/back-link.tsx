import { Link, type LinkProps, useNavigate } from "react-router";

type BackLinkProps = Omit<LinkProps, "to"> & { fallback: string };

/**
 * 来た画面に戻るリンク。直接開いた画面で戻るとアプリの外に出るため、`fallback` へ遷移する。
 * 直接開いたかは React Router が `history.state.idx` に持つ履歴の位置で判定する。
 * `location.key` は ScrollRestoration が初回表示時に書き込むため、判定に使えない。
 */
export function BackLink({ fallback, onClick, ...props }: BackLinkProps) {
  const navigate = useNavigate();

  return (
    <Link
      {...props}
      to={fallback}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !(window.history.state?.idx > 0)) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(-1);
      }}
    />
  );
}
