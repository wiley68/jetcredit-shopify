import { useEffect, useState } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { createFilter } from "../models/Filters.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // Get shop locale from session
  const shopLocale = session?.locale || 'en';

  return {
    shopLocale
  };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();

  const filterData = {
    jetProductId: formData.get("jetProductId") || "*",
    jetProductPercent: parseFloat(formData.get("jetProductPercent")) || 0,
    jetProductMeseci: formData.get("jetProductMeseci") || "",
    jetProductPrice: parseFloat(formData.get("jetProductPrice")) || 0,
    jetProductStart: new Date(formData.get("jetProductStart")),
    jetProductEnd: new Date(formData.get("jetProductEnd")),
  };

  // Validate product ID
  if (filterData.jetProductId.trim()) {
    const productId = filterData.jetProductId.trim();
    if (productId !== "*" && !productId.startsWith("gid://shopify/Product/")) {
      return { success: false, error: "Product ID must be '*' for all products or a valid Shopify Product ID (gid://shopify/Product/...)" };
    }
  }

  // Validate installments format and values (optional field)
  if (filterData.jetProductMeseci.trim()) {
    const validInstallments = [3, 6, 9, 12, 15, 18, 24, 30, 36];
    const installments = filterData.jetProductMeseci.split('_').map(Number);

    if (installments.some(inst => !validInstallments.includes(inst))) {
      return { success: false, error: "Invalid installment values. Valid options: 3, 6, 9, 12, 15, 18, 24, 30, 36" };
    }

    // Check for duplicates
    if (installments.length !== new Set(installments).size) {
      return { success: false, error: "Duplicate installment values are not allowed" };
    }
  }

  if (filterData.jetProductStart >= filterData.jetProductEnd) {
    return { success: false, error: "End date must be after start date" };
  }

  try {
    const newFilter = await createFilter(filterData);
    return { success: true, filter: newFilter };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default function NewFilter() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const { t, i18n } = useTranslation();
  const { shopLocale } = useLoaderData();

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
      <s-button
        slot="secondary-actions"
        onClick={() => navigate('/app/filters')}
      >
        {t('common.cancel')}
      </s-button>

      {errors.general && (
        <s-banner status="critical">
          {errors.general}
        </s-banner>
      )}

      <s-section heading={t('filters.form.product_id.label')}>
        <s-stack direction="block" gap="base">
          <s-text-field
            value={formData.jetProductId}
            onInput={(event) => handleFieldChange('jetProductId', event.target.value)}
            placeholder={t('filters.form.product_id.placeholder')}
            helpText={t('filters.table.product_id_description')}
          />
          {errors.jetProductId && (
            <s-banner status="critical" style={{ marginTop: "8px" }}>
              {errors.jetProductId}
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section heading={t('filters.form.interest_rate.label')}>
        <s-select
          value={formData.jetProductPercent}
          onInput={(event) => handleFieldChange('jetProductPercent', event.target.value)}
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

      <s-section heading={t('filters.form.installments.label')}>
        <s-text-field
          value={formData.jetProductMeseci}
          onInput={(event) => handleFieldChange('jetProductMeseci', event.target.value)}
          placeholder="6_12_24"
          helpText={t('filters.table.installments_description')}
        />
        {errors.jetProductMeseci && (
          <s-banner status="critical" style={{ marginTop: "8px" }}>
            {errors.jetProductMeseci}
          </s-banner>
        )}
      </s-section>

      <s-section heading={t('filters.form.min_price.label')}>
        <s-text-field
          type="number"
          value={formData.jetProductPrice}
          onInput={(event) => handleFieldChange('jetProductPrice', event.target.value)}
          placeholder={t('filters.form.min_price.placeholder')}
          helpText={t('filters.table.min_price_description')}
        />
      </s-section>

      <s-section heading={t('filters.table.start_date')}>
        <s-stack direction="block" gap="base">
          <s-date-field
            value={formData.jetProductStart}
            onInput={(event) => handleFieldChange('jetProductStart', event.target.value)}
            required
          />
          <s-date-field
            value={formData.jetProductEnd}
            onInput={(event) => handleFieldChange('jetProductEnd', event.target.value)}
            required
          />
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
