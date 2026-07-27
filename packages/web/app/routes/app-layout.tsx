import { Outlet } from "react-router";
import { AppLayout } from "~/components/app-layout";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/app-layout";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export default function AppLayoutRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AppLayout user={loaderData.user}>
      <Outlet />
    </AppLayout>
  );
}
