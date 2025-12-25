import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData, useNavigate, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getFilters, deleteFilter } from "../models/Filters.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const filters = await getFilters();
  const shopLocale = session?.locale || "en";

  return { filters, shopLocale };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const actionName = formData.get("action");
  const filterId = formData.get("filterId");

  switch (actionName) {
    case "delete_filter":
      try {
        await deleteFilter(filterId);
        return { success: true, deletedId: String(filterId) };
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
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const { t } = useTranslation();
  const { filters } = useLoaderData();

  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const isDeleting = useMemo(
    () => fetcher.state === "submitting" && fetcher.formData?.get("action") === "delete_filter",
    [fetcher.state, fetcher.formData]
  );

  // For stable revalidate call inside effects without dependency churn
  const revalidateRef = useRef(() => { });
  useEffect(() => {
    revalidateRef.current = () => revalidator.revalidate();
  }, [revalidator]);

  // Handle each successful delete exactly once
  const lastHandledDeletedIdRef = useRef(null);

  const confirmDelete = () => {
    if (!pendingDeleteId || isDeleting) return;

    fetcher.submit(
      { action: "delete_filter", filterId: String(pendingDeleteId) },
      { method: "POST" }
    );
  };

  useEffect(() => {
    const data = fetcher.data;

    if (fetcher.state !== "idle") return;
    if (!data) return;

    if (data.success && data.deletedId) {
      if (lastHandledDeletedIdRef.current === data.deletedId) return;
      lastHandledDeletedIdRef.current = data.deletedId;

      shopify.toast.show(t("filters.actions.delete_success"));
      setPendingDeleteId(null);
      revalidateRef.current();
      return;
    }

    if (data.error) {
      shopify.toast.show(t("filters.actions.delete_error"), { isError: true });
    }
  }, [fetcher.data, fetcher.state, shopify, t]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatInstallments = (installmentsString) => {
    if (!installmentsString) return "";
    return installmentsString.replace(/_/g, ", ");
  };

  // Show which filter is being deleted (id + jetProductId)
  const pendingFilter = useMemo(() => {
    if (!pendingDeleteId) return null;
    return (filters || []).find((f) => String(f.id) === String(pendingDeleteId)) || null;
  }, [filters, pendingDeleteId]);

  return (
    <s-page heading={t("filters.page_title")}>
      <s-button slot="primary-action" onClick={() => navigate("/app/filters_new")}>
        {t("filters.new_filter")}
      </s-button>

      {/* Delete confirmation modal */}
      <s-modal id="deleteModal" heading={t("filters.actions.confirm_delete_title")}>
        <s-paragraph>
          {t("filters.actions.confirm_delete_message")}
        </s-paragraph>

        {/* Extra context: which filter */}
        {pendingDeleteId && (
          <s-paragraph>
            <s-text type="strong">
              {`#${pendingDeleteId}`}
            </s-text>
            {pendingFilter?.jetProductId ? (
              <s-text>{` • ${pendingFilter.jetProductId}`}</s-text>
            ) : null}
          </s-paragraph>
        )}

        <s-button
          slot="secondary-actions"
          commandFor="deleteModal"
          command="--hide"
          disabled={isDeleting}
          onClick={() => setPendingDeleteId(null)}
        >
          {t("common.cancel")}
        </s-button>

        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor="deleteModal"
          command="--hide"
          onClick={confirmDelete}
          {...(isDeleting ? { loading: true } : {})}
        >
          {t("filters.actions.delete")}
        </s-button>
      </s-modal>

      {filters && filters.length > 0 ? (
        <s-section padding="none">
          <s-table>
            <s-table-header-row>
              <s-table-header>
                <s-text type="strong" interestFor="product-id-tooltip">
                  {t("filters.table.product_id")}
                </s-text>
                <s-tooltip id="product-id-tooltip">{t("filters.table.product_id_description")}</s-tooltip>
              </s-table-header>

              <s-table-header>
                <s-text type="strong" interestFor="interest-rate-tooltip">
                  {t("filters.table.interest_rate")}
                </s-text>
                <s-tooltip id="interest-rate-tooltip">{t("filters.table.interest_rate_description")}</s-tooltip>
              </s-table-header>

              <s-table-header>
                <s-text type="strong" interestFor="installments-tooltip">
                  {t("filters.table.installments")}
                </s-text>
                <s-tooltip id="installments-tooltip">{t("filters.table.installments_description")}</s-tooltip>
              </s-table-header>

              <s-table-header>
                <s-text type="strong" interestFor="min-price-tooltip">
                  {t("filters.table.min_price")}
                </s-text>
                <s-tooltip id="min-price-tooltip">{t("filters.table.min_price_description")}</s-tooltip>
              </s-table-header>

              <s-table-header>
                <s-text type="strong" interestFor="start-date-tooltip">
                  {t("filters.table.start_date")}
                </s-text>
                <s-tooltip id="start-date-tooltip">{t("filters.table.start_date_description")}</s-tooltip>
              </s-table-header>

              <s-table-header>
                <s-text type="strong" interestFor="end-date-tooltip">
                  {t("filters.table.end_date")}
                </s-text>
                <s-tooltip id="end-date-tooltip">{t("filters.table.end_date_description")}</s-tooltip>
              </s-table-header>

              <s-table-header>{t("filters.table.actions")}</s-table-header>
            </s-table-header-row>

            <s-table-body>
              {filters.map((filter) => (
                <s-table-row key={filter.id}>
                  <s-table-cell>
                    <s-text>{filter.jetProductId}</s-text>
                  </s-table-cell>

                  <s-table-cell>
                    <s-badge tone="info">
                      {filter.jetProductPercent === -1.0
                        ? t("settings.options.interest_rates.-1.00")
                        : `${filter.jetProductPercent.toFixed(2)}%`}
                    </s-badge>
                  </s-table-cell>

                  <s-table-cell>{formatInstallments(filter.jetProductMeseci)}</s-table-cell>
                  <s-table-cell>{filter.jetProductPrice.toFixed(2)}</s-table-cell>
                  <s-table-cell>{formatDate(filter.jetProductStart)}</s-table-cell>
                  <s-table-cell>{formatDate(filter.jetProductEnd)}</s-table-cell>

                  <s-table-cell>
                    <s-stack direction="inline" gap="small-300">
                      <s-button
                        variant="secondary"
                        icon="edit"
                        onClick={() => navigate(`/app/filters_edit/${filter.id}`)}
                      >
                        {t("filters.actions.edit")}
                      </s-button>

                      <s-button
                        variant="secondary"
                        icon="delete"
                        tone="critical"
                        commandFor="deleteModal"
                        command="--show"
                        disabled={isDeleting}   // ✅ prevent double submits
                        onClick={() => setPendingDeleteId(filter.id)}
                      >
                        {t("filters.actions.delete")}
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      ) : (
        <s-empty-state
          heading={t("filters.no_filters")}
          action={{
            content: t("filters.new_filter"),
            onAction: () => navigate("/app/filters_new"),
          }}
        >
          <p>{t("filters.loading")}</p>
        </s-empty-state>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
