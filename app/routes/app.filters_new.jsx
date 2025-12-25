import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { createFilter } from "../models/Filters.server";

function parseDateOnlyToUtcStart(dateStr) {
  // dateStr expected "YYYY-MM-DD"
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function parseDateOnlyToUtcEndInclusive(dateStr) {
  // inclusive end-of-day
  return new Date(`${dateStr}T23:59:59.999Z`);
}

function normalizeInstallments(meseciStr) {
  // "24_6_12" -> "6_12_24"
  const parts = meseciStr
    .split("_")
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);

  const uniqueSorted = Array.from(new Set(parts)).sort((a, b) => a - b);
  return uniqueSorted.join("_");
}

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return {};
};

export const action = async ({ request }) => {
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

    // IMPORTANT: pass Date objects directly (no ISO strings)
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

  // Validate percent & price basic sanity
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
    const newFilter = await createFilter(filterData);
    return { success: true, filter: newFilter };
  } catch (error) {
    return { success: false, error: error.message || "Failed to create filter" };
  }
};

export default function NewFilter() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const { t } = useTranslation();


  const [formData, setFormData] = useState({
    jetProductId: "",
    jetProductPercent: "0.00",
    jetProductMeseci: "",
    jetProductPrice: "0",
    jetProductStart: new Date().toISOString().split('T')[0],
    jetProductEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.filter) {
      shopify.toast.show('Filter created successfully');
      navigate('/app/filters');
    } else if (fetcher.data?.error) {
      setErrors({ general: fetcher.data.error });
    }
  }, [fetcher.data, shopify, navigate]);

  const handleSubmit = () => {
    // Validate product ID
    if (formData.jetProductId.trim()) {
      const productId = formData.jetProductId.trim();
      if (productId !== "*" && !productId.startsWith("gid://shopify/Product/")) {
        setErrors({ jetProductId: 'Product ID must be "*" for all products or a valid Shopify Product ID (gid://shopify/Product/...)' });
        return;
      }
    }

    // Validate installments format and values (optional field)
    if (formData.jetProductMeseci.trim()) {
      const validInstallments = [3, 6, 9, 12, 15, 18, 24, 30, 36];
      const installments = formData.jetProductMeseci.split('_').map(Number);

      if (installments.some(inst => !validInstallments.includes(inst))) {
        setErrors({ jetProductMeseci: 'Invalid installment values. Valid options: 3, 6, 9, 12, 15, 18, 24, 30, 36' });
        return;
      }

      // Check for duplicates
      if (installments.length !== new Set(installments).size) {
        setErrors({ jetProductMeseci: 'Duplicate installment values are not allowed' });
        return;
      }
    }

    if (!formData.jetProductStart || !formData.jetProductEnd) {
      setErrors({ general: 'Please select both start and end dates' });
      return;
    }

    const startDate = new Date(formData.jetProductStart);
    const endDate = new Date(formData.jetProductEnd);

    if (startDate >= endDate) {
      setErrors({ general: 'End date must be after start date' });
      return;
    }

    setErrors({});
    fetcher.submit({ ...formData, action: "create_filter" }, { method: "POST" });
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <s-page heading={t('filters.form.title_new')}>
      <s-button
        slot="primary-action"
        onClick={handleSubmit}
        {...(fetcher.state === "submitting" ? { loading: true } : {})}
      >
        {fetcher.state === "submitting" ? t('filters.form.saving') : t('filters.form.save_button')}
      </s-button>
      <s-link
        slot="secondary-actions"
        href="/app/filters"
        accessibilityLabel={t('common.cancel')}
      >
        {t('common.cancel')}
      </s-link>

      {errors.general && (
        <s-banner status="critical">
          {errors.general}
        </s-banner>
      )}

      <s-section>
        <s-stack direction="block" gap="base">
          <s-text-field
            value={formData.jetProductId}
            label={t('filters.form.product_id.label')}
            details={t('filters.form.product_id.description')}
            onChange={(event) => handleFieldChange('jetProductId', event.currentTarget.value)}
            placeholder={t('filters.form.product_id.placeholder')}
          />
          {errors.jetProductId && (
            <s-banner status="critical" style={{ marginTop: "8px" }}>
              {errors.jetProductId}
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section>
        <s-select
          value={formData.jetProductPercent}
          label={t('filters.form.interest_rate.label')}
          details={t('filters.form.interest_rate.description')}
          onChange={(event) => handleFieldChange('jetProductPercent', event.currentTarget.value)}
        >
          <s-option value="-1.00">{t('settings.options.interest_rates.-1.00')}</s-option>
          <s-option value="0.00">{t('settings.options.interest_rates.0.00')}</s-option>
          <s-option value="0.80">{t('settings.options.interest_rates.0.80')}</s-option>
          <s-option value="0.99">{t('settings.options.interest_rates.0.99')}</s-option>
          <s-option value="1.00">{t('settings.options.interest_rates.1.00')}</s-option>
          <s-option value="1.10">{t('settings.options.interest_rates.1.10')}</s-option>
          <s-option value="1.20">{t('settings.options.interest_rates.1.20')}</s-option>
          <s-option value="1.40">{t('settings.options.interest_rates.1.40')}</s-option>
        </s-select>
      </s-section>

      <s-section>
        <s-text-field
          value={formData.jetProductMeseci}
          label={t('filters.form.installments.label')}
          details={t('filters.form.installments.description')}
          onChange={(event) => handleFieldChange('jetProductMeseci', event.currentTarget.value)}
          placeholder="6_12_24"
        />
      </s-section>

      <s-section>
        <s-text-field
          type="number"
          value={formData.jetProductPrice}
          label={t('filters.form.min_price.label')}
          details={t('filters.form.min_price.description')}
          onChange={(event) => handleFieldChange('jetProductPrice', event.currentTarget.value)}
          placeholder={t('filters.form.min_price.placeholder')}
        />
      </s-section>

      <s-section>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <s-date-field
            value={formData.jetProductStart}
            label={t('filters.form.start_date.label')}
            details={t('filters.form.start_date.description')}
            onChange={(event) =>
              handleFieldChange('jetProductStart', event.currentTarget.value)
            }
            required
          />
          <s-date-field
            value={formData.jetProductEnd}
            label={t('filters.form.end_date.label')}
            details={t('filters.form.end_date.description')}
            onChange={(event) =>
              handleFieldChange('jetProductEnd', event.currentTarget.value)
            }
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
