/* global process */

import { Outlet, useLoaderData, useRouteError } from "react-router";
import { useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || ""
  };
};

export default function App() {
  const { apiKey } = useLoaderData();
  const { t, i18n } = useTranslation();

  // Initialize language - force Bulgarian since user sees Bulgarian UI
  useEffect(() => {
    if (i18n.language !== 'bg') {
      i18n.changeLanguage('bg');
    }
  }, [i18n]);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">{t('app.navigation.overview')}</s-link>
        <s-link href="/app/settings">{t('app.navigation.settings')}</s-link>
        <s-link href="/app/filters">{t('app.navigation.filters')}</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
