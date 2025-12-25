import { useEffect, useState } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getFilterById, updateFilter } from "../models/Filters.server";

/** Helpers */
function parseDateOnlyToUtcStart(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function parseDateOnlyToUtcEndInclusive(dateStr) {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

function normalizeInstallments(meseciStr) {
  const parts = meseciStr
    .split("_")
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);

  const uniqueSorted = Array.from(new Set(parts)).sort((a, b) => a - b);
  return uniqueSorted.join("_");
}

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);

  const filter = await getFilterById(params.id);
  if (!filter) {
    throw new Response("Filter not found", { status: 404 });
  }

  return { filter };
};

export const action = async ({ request, params }) => {
  await authenticate.admin(request);
  const formData = await request.formData();

  const jetProductIdRaw = (formData.get("jetProductId") || "*").toString().trim();
  const jetProductMeseciRaw = (formData.get("jetProductMeseci") || "").toString().trim();

  const startDateStr = (formData.get("jetProductStart") || "").toString().trim();
  const endDateStr = (formData.get("jetProductEnd") || "").toString().trim();

  const filterData = {
    jetProductId: jetProductIdRaw || "*",
    jetProductPercent: Number.parseFloat(formData.get("jetProductPercent")) || 0,
    jetProductMeseci: jetProductMeseciRaw ? normalizeInstallments(jetProductMeseciRaw) : "",
    jetProductPrice: Number.parseFloat(formData.get("jetProductPrice")) || 0,

    // IMPORTANT: pass Date objects directly
    jetProductStart: startDateStr ? parseDateOnlyToUtcStart(startDateStr) : new Date(),
    jetProductEnd: endDateStr ? parseDateOnlyToUtcEndInclusive(endDateStr) : new Date(),
  };

  // Validate product ID
  if (filterData.jetProductId !== "*" && !filterData.jetProductId.startsWith("gid://shopify/Product/")) {
    return {
      success: false,
      error: "Product ID must be '*' for all products or a valid Shopify Product ID (gid://shopify/Product/...)",
    };
  }

  // Validate percent & price sanity
  if (!Number.isFinite(filterData.jetProductPercent) || filterData.jetProductPercent < -1 || filterData.jetProductPercent > 10) {
    return { success: false, error: "Invalid interest rate value." };
  }

  if (!Number.isFinite(filterData.jetProductPrice) || filterData.jetProductPrice < 0) {
    return { success: false, error: "Minimum price must be a non-negative number." };
  }

  // Validate installments format and values (optional field)
  if (filterData.jetProductMeseci) {
    const validInstallments = new Set([3, 6, 9, 12, 15, 18, 24, 30, 36]);
    const installments = filterData.jetProductMeseci.split("_").map(Number);

    if (installments.some((inst) => !validInstallments.has(inst))) {
      return {
        success: false,
        error: "Invalid installment values. Valid options: 3, 6, 9, 12, 15, 18, 24, 30, 36",
      };
    }
  }

  // Date order check (real date compare)
  if (filterData.jetProductStart.getTime() >= filterData.jetProductEnd.getTime()) {
    return { success: false, error: "End date must be after start date" };
  }

  try {
    const updatedFilter = await updateFilter(params.id, filterData);
    return { success: true, filter: updatedFilter };
  } catch (error) {
    return { success: false, error: error.message || "Failed to update filter" };
  }
};

export default function EditFilter() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const { t } = useTranslation();
  const { filter } = useLoaderData();

  // Convert stored dates to YYYY-MM-DD for date inputs (use UTC slice)
  const initialStartDate = filter.jetProductStart
    ? new Date(filter.jetProductStart).toISOString().slice(0, 10)
    : "";

  // IMPORTANT: if you store end as 23:59:59.999Z, slicing still yields the same date.
  const initialEndDate = filter.jetProductEnd
    ? new Date(filter.jetProductEnd).toISOString().slice(0, 10)
    : "";

  const [formData, setFormData] = useState({
    jetProductId: filter.jetProductId || "",
    jetProductPercent: (filter.jetProductPercent ?? 0).toString(),
    jetProductMeseci: filter.jetProductMeseci || "",
    jetProductPrice: (filter.jetProductPrice ?? 0).toString(),
    jetProductStart: initialStartDate,
    jetProductEnd: initialEndDate,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.filter) {
      shopify.toast.show("Filter updated successfully");
      navigate("/app/filters");
    } else if (fetcher.data?.error) {
      setErrors({ general: fetcher.data.error });
    }
  }, [fetcher.data, shopify, navigate]);

  const handleSubmit = () => {
    // Basic required checks
    if (!formData.jetProductStart || !formData.jetProductEnd) {
      setErrors({ general: "Please select both start and end dates" });
      return;
    }

    // Validate product ID (client-side)
    if (formData.jetProductId.trim()) {
      const productId = formData.jetProductId.trim();
      if (productId !== "*" && !productId.startsWith("gid://shopify/Product/")) {
        setErrors({
          jetProductId:
            'Product ID must be "*" for all products or a valid Shopify Product ID (gid://shopify/Product/...)',
        });
        return;
      }
    }

    // Normalize + validate installments (client-side)
    if (formData.jetProductMeseci.trim()) {
      const normalized = normalizeInstallments(formData.jetProductMeseci.trim());
      const validInstallments = new Set([3, 6, 9, 12, 15, 18, 24, 30, 36]);
      const installments = normalized ? normalized.split("_").map(Number) : [];

      if (installments.some((inst) => !validInstallments.has(inst))) {
        setErrors({
          jetProductMeseci: "Invalid installment values. Valid options: 3, 6, 9, 12, 15, 18, 24, 30, 36",
        });
        return;
      }

      // write back normalized form (so you submit canonical)
      formData.jetProductMeseci = normalized;
    }

    // Date compare (use date-only as UTC start/end for consistency with server)
    const startDate = parseDateOnlyToUtcStart(formData.jetProductStart);
    const endDate = parseDateOnlyToUtcEndInclusive(formData.jetProductEnd);

    if (startDate.getTime() >= endDate.getTime()) {
      setErrors({ general: "End date must be after start date" });
      return;
    }

    setErrors({});
    fetcher.submit({ ...formData }, { method: "POST" });
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field] || errors.general) {
      setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
    }
  };

  return (
    <s-page heading={t("filters.form.title_edit")}>
      <s-button
        slot="primary-action"
        onClick={handleSubmit}
        {...(fetcher.state === "submitting" ? { loading: true } : {})}
      >
        {fetcher.state === "submitting" ? t("filters.form.saving") : t("filters.form.save_button")}
      </s-button>

      <s-button slot="secondary-actions" onClick={() => navigate("/app/filters")}>
        {t("common.cancel")}
      </s-button>

      {errors.general && <s-banner status="critical">{errors.general}</s-banner>}

      <s-section heading={t("filters.form.product_id.label")}>
        <s-stack direction="block" gap="base">
          <s-text-field
            value={formData.jetProductId}
            onChange={(event) => handleFieldChange("jetProductId", event.currentTarget.value)}
            placeholder={t("filters.form.product_id.placeholder")}
            helpText={t("filters.table.product_id_description")}
          />
          {errors.jetProductId && (
            <s-banner status="critical" style={{ marginTop: "8px" }}>
              {errors.jetProductId}
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section heading={t("filters.form.interest_rate.label")}>
        <s-select
          value={formData.jetProductPercent}
          onChange={(event) => handleFieldChange("jetProductPercent", event.currentTarget.value)}
        >
          <s-option value="-1.00">{t("settings.options.interest_rates.-1.00")}</s-option>
          <s-option value="0.00">{t("settings.options.interest_rates.0.00")}</s-option>
          <s-option value="0.80">{t("settings.options.interest_rates.0.80")}</s-option>
          <s-option value="0.99">{t("settings.options.interest_rates.0.99")}</s-option>
          <s-option value="1.00">{t("settings.options.interest_rates.1.00")}</s-option>
          <s-option value="1.10">{t("settings.options.interest_rates.1.10")}</s-option>
          <s-option value="1.20">{t("settings.options.interest_rates.1.20")}</s-option>
          <s-option value="1.40">{t("settings.options.interest_rates.1.40")}</s-option>
        </s-select>
      </s-section>

      <s-section heading={t("filters.form.installments.label")}>
        <s-text-field
          value={formData.jetProductMeseci}
          onChange={(event) => handleFieldChange("jetProductMeseci", event.currentTarget.value)}
          placeholder="6_12_24"
          helpText={t("filters.table.installments_description")}
        />
        {errors.jetProductMeseci && (
          <s-banner status="critical" style={{ marginTop: "8px" }}>
            {errors.jetProductMeseci}
          </s-banner>
        )}
      </s-section>

      <s-section heading={t("filters.form.min_price.label")}>
        <s-text-field
          type="number"
          value={formData.jetProductPrice}
          onChange={(event) => handleFieldChange("jetProductPrice", event.currentTarget.value)}
          placeholder={t("filters.form.min_price.placeholder")}
          helpText={t("filters.table.min_price_description")}
        />
      </s-section>

      <s-section heading={t("filters.table.start_date")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <s-date-field
            value={formData.jetProductStart}
            label={t("filters.form.start_date.label")}
            details={t("filters.form.start_date.description")}
            onChange={(event) => handleFieldChange("jetProductStart", event.currentTarget.value)}
            required
          />
          <s-date-field
            value={formData.jetProductEnd}
            label={t("filters.form.end_date.label")}
            details={t("filters.form.end_date.description")}
            onChange={(event) => handleFieldChange("jetProductEnd", event.currentTarget.value)}
            required
          />
        </div>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
