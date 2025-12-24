import { useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getFilters, deleteFilter } from "../models/Filters.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // Load all filters
  const filters = await getFilters();

  // Get shop locale from session
  const shopLocale = session?.locale || 'en';

  return {
    filters,
    shopLocale
  };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const filterId = formData.get("filterId");

  switch (action) {
    case "delete_filter":
      try {
        await deleteFilter(filterId);
        return { success: true, message: "Filter deleted successfully" };
      } catch (error) {
        return { success: false, error: error.message };
      }

    default:
      return { success: false, error: "Unknown action" };
  }
};

export default function Filters() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const { t, i18n } = useTranslation();
  const { filters, shopLocale } = useLoaderData();

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

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.message) {
      shopify.toast.show(t('filters.actions.delete_success'));
      // Reload the page to refresh the filters list
      window.location.reload();
    } else if (fetcher.data?.error) {
      shopify.toast.show(t('filters.actions.delete_error'), { isError: true });
    }
  }, [fetcher.data, shopify, t]);

  const handleDelete = (filterId) => {
    if (window.confirm(t('filters.actions.confirm_delete'))) {
      fetcher.submit(
        { action: "delete_filter", filterId },
        { method: "POST" }
      );
    }
  };


  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatInstallments = (installmentsString) => {
    if (!installmentsString) return '';
    return installmentsString.replace(/_/g, ', ');
  };

  return (
    <s-page heading={t('filters.page_title')}>
      <s-button
        slot="primary-action"
        onClick={() => navigate('/app/filters_new')}
      >
        {t('filters.new_filter')}
      </s-button>

      <s-section>
        {filters && filters.length > 0 ? (
          <s-table>
            <s-table-head>
              <s-table-row>
                <s-table-header>{t('filters.table.product_id')}</s-table-header>
                <s-table-header>{t('filters.table.interest_rate')}</s-table-header>
                <s-table-header>{t('filters.table.installments')}</s-table-header>
                <s-table-header>{t('filters.table.min_price')}</s-table-header>
                <s-table-header>{t('filters.table.start_date')}</s-table-header>
                <s-table-header>{t('filters.table.end_date')}</s-table-header>
                <s-table-header>{t('filters.table.actions')}</s-table-header>
              </s-table-row>
            </s-table-head>
            <s-table-body>
              {filters.map((filter) => (
                <s-table-row key={filter.id}>
                  <s-table-cell>
                    <s-text fontWeight="semibold">{filter.jetProductId}</s-text>
                    <s-text size="small" color="subdued">
                      {t('filters.table.product_id_description')}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone="info">{filter.jetProductPercent}%</s-badge>
                    <s-text size="small" color="subdued">
                      {t('filters.table.interest_rate_description')}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    {formatInstallments(filter.jetProductMeseci)}
                    <s-text size="small" color="subdued">
                      {t('filters.table.installments_description')}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    €{filter.jetProductPrice}
                    <s-text size="small" color="subdued">
                      {t('filters.table.min_price_description')}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    {formatDate(filter.jetProductStart)}
                    <s-text size="small" color="subdued">
                      {t('filters.table.start_date_description')}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    {formatDate(filter.jetProductEnd)}
                    <s-text size="small" color="subdued">
                      {t('filters.table.end_date_description')}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-button-group>
                      <s-button
                        size="small"
                        onClick={() => navigate(`/app/filters/${filter.id}`)}
                      >
                        {t('filters.actions.edit')}
                      </s-button>
                      <s-button
                        size="small"
                        tone="critical"
                        onClick={() => handleDelete(filter.id)}
                      >
                        {t('filters.actions.delete')}
                      </s-button>
                    </s-button-group>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-empty-state
            heading={t('filters.no_filters')}
            action={{
              content: t('filters.new_filter'),
              onAction: () => navigate('/app/filters_new')
            }}
          >
            <p>{t('filters.loading')}</p>
          </s-empty-state>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
