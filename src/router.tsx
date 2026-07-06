import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toLang } from "./lib/localized";
import { PortfolioPage } from "./pages/PortfolioPage";

function RootLayout() {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = toLang(i18n.resolvedLanguage);
  }, [i18n.resolvedLanguage]);
  return <Outlet />;
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: PortfolioPage,
});

// FR-19/20: hash-based deep links — /#/scene/{slug}. `?thumb=1` switches the
// viewer into the build-time thumbnail rendering mode (§6.4).
const sceneRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/scene/$slug",
  component: PortfolioPage,
  validateSearch: (search: Record<string, unknown>): { thumb?: number } => {
    const thumb = search.thumb;
    return thumb === 1 || thumb === "1" || thumb === true ? { thumb: 1 } : {};
  },
});

const routeTree = rootRoute.addChildren([indexRoute, sceneRoute]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
