import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getModuleStatus, toggleModuleStatus } from "../models/Settings.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // Load module status from database
  const moduleStatus = await getModuleStatus();

  // Get shop locale from session
  const shopLocale = session?.locale || 'en';

  return {
    moduleStatus,
    shopLocale
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case "toggle_module":
      const status = formData.get("status") === "true";

      // Update module status in database
      await toggleModuleStatus(status);

      return { success: true, moduleStatus: status };

    default:
      return { success: false, error: "Unknown action" };
  }
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const { t, i18n } = useTranslation();
  const { moduleStatus: initialModuleStatus, shopLocale } = useLoaderData();

  // Initialize language based on shop locale
  useEffect(() => {
    if (shopLocale) {
      const normalizedLocale = shopLocale.split('-')[0].toLowerCase();
      const supportedLocale = ['en', 'bg'].includes(normalizedLocale) ? normalizedLocale : 'en';

      if (i18n.language !== supportedLocale) {
        i18n.changeLanguage(supportedLocale);
      }
    }
  }, [shopLocale, i18n]);
  const [moduleStatus, setModuleStatus] = useState(initialModuleStatus);

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(t('settings.updated_successfully'));
      // Update local state when database is updated
      if (fetcher.data.moduleStatus !== undefined) {
        setModuleStatus(fetcher.data.moduleStatus);
      }
    }
  }, [fetcher.data?.success, fetcher.data?.moduleStatus, shopify, t]);

  const toggleModuleStatus = () => {
    const newStatus = !moduleStatus;
    setModuleStatus(newStatus);
    fetcher.submit(
      { action: "toggle_module", status: newStatus },
      { method: "POST" }
    );
  };

  return (
    <s-page heading={t('overview.title')}>
      <s-button
        slot="primary-action"
        onClick={toggleModuleStatus}
        {...(fetcher.state === "submitting" ? { loading: true } : {})}
      >
        {moduleStatus ? t('overview.toggle.disable_module') : t('overview.toggle.enable_module')}
      </s-button>

      <s-section heading={t('app.title')}>
        <s-paragraph>
          <s-badge tone={moduleStatus ? "success" : "critical"}>
            {moduleStatus ? t('overview.module_active') : t('overview.module_inactive')}
          </s-badge>
        </s-paragraph>
        <s-paragraph>
          {t('overview.description')}
        </s-paragraph>
        <s-paragraph>
          {t('overview.description_extended')}
        </s-paragraph>
      </s-section>

      <s-section heading={t('overview.features.title')}>
        <s-paragraph>
          ✓ {t('overview.features.auto_calculation')}<br />
          ✓ {t('overview.features.individual_rates')}<br />
          ✓ {t('overview.features.bank_integration')}<br />
          ✓ {t('overview.features.secure_data')}<br />
          ✓ {t('overview.features.terms_support')}<br />
          ✓ {t('overview.features.inventory_update')}
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading={t('overview.quick_actions.title')}>
        <s-button
          onClick={toggleModuleStatus}
          {...(fetcher.state === "submitting" ? { loading: true } : {})}
          style={{ width: "100%" }}
        >
          {moduleStatus ? t('overview.toggle.disable_module') : t('overview.toggle.enable_module')}
        </s-button>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
