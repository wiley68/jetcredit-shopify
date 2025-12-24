import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSettings, updateAllSettings } from "../models/Settings.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // Load current settings
  const settings = await getSettings();

  return {
    settings
  };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();

  const settingsData = {
    jetStatusIn: formData.get("jetStatusIn") === "true",
    jetEmail: formData.get("jetEmail"),
    jetId: formData.get("jetId"),
    jetPurcent: formData.get("jetPurcent"),
    jetVnoskiDefault: formData.get("jetVnoskiDefault"),
    jetCardIn: formData.get("jetCardIn") === "true",
    jetPurcentCard: formData.get("jetPurcentCard"),
    jetMinprice: formData.get("jetMinprice"),
    jetEur: formData.get("jetEur"),
  };

  try {
    const updatedSettings = await updateAllSettings(settingsData);
    return { success: true, settings: updatedSettings };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default function Settings() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const { t } = useTranslation();
  const { settings: initialSettings } = useLoaderData();


  const [formData, setFormData] = useState({
    jetStatusIn: initialSettings.jetStatusIn ?? true,
    jetEmail: initialSettings.jetEmail || '',
    jetId: initialSettings.jetId || '',
    jetPurcent: initialSettings.jetPurcent !== undefined ? parseFloat(initialSettings.jetPurcent).toFixed(2) : '1.40',
    jetVnoskiDefault: initialSettings.jetVnoskiDefault?.toString() || '12',
    jetCardIn: initialSettings.jetCardIn ?? true,
    jetPurcentCard: initialSettings.jetPurcentCard !== undefined ? parseFloat(initialSettings.jetPurcentCard).toFixed(2) : '1.00',
    jetCount: initialSettings.jetCount || '0',
    jetMinprice: initialSettings.jetMinprice?.toString() || '150',
    jetEur: initialSettings.jetEur?.toString() || '0',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(t('settings.updated_successfully'));
      setErrors({});
    } else if (fetcher.data?.error) {
      setErrors({ general: fetcher.data.error });
    }
  }, [fetcher.data, shopify, t]);

  const handleSubmit = () => {
    // Validate email
    if (!formData.jetEmail || !formData.jetEmail.trim()) {
      setErrors({ jetEmail: t('settings.email.required') });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.jetEmail)) {
      setErrors({ jetEmail: t('settings.email.invalid') });
      return;
    }

    // Validate jetMinprice - must be positive integer
    if (formData.jetMinprice !== undefined && formData.jetMinprice !== '') {
      const minPrice = parseInt(formData.jetMinprice);
      if (isNaN(minPrice) || minPrice <= 0) {
        setErrors({ jetMinprice: t('settings.min_price.invalid') });
        return;
      }
    }

    setErrors({});
    fetcher.submit(formData, { method: "POST" });
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };


  return (
    <s-page heading={t('settings.page_title')}>
      {errors.general && (
        <s-banner status="critical">
          {errors.general}
        </s-banner>
      )}

      <s-section heading={t('settings.page_title')}>
        <s-stack direction="block" gap="base">
          <div>
            <s-switch
              name="jetStatusIn"
              label={t('settings.module_status.label')}
              details={t('settings.module_status.description')}
              checked={formData.jetStatusIn}
              onInput={(e) => handleFieldChange('jetStatusIn', e.target.checked)}
            />
          </div>

          <div>
            <s-text-field
              type="email"
              label={t('settings.email.label')}
              details={t('settings.email.description')}
              value={formData.jetEmail}
              onInput={(event) => handleFieldChange('jetEmail', event.target.value)}
              placeholder={t('settings.email.placeholder')}
              required
            />
            {errors.jetEmail && (
              <s-banner status="critical" style={{ marginTop: "8px" }}>
                {errors.jetEmail}
              </s-banner>
            )}
          </div>

          <div>
            <s-text-field
              value={formData.jetId}
              label={t('settings.shop_id.label')}
              details={t('settings.shop_id.description')}
              onInput={(event) => handleFieldChange('jetId', event.target.value)}
              placeholder={t('settings.shop_id.placeholder')}
            />
          </div>

          <div>
            <s-select
              label={t('settings.interest_rate.label')}
              details={t('settings.interest_rate.description')}
              value={formData.jetPurcent}
              onInput={(event) => handleFieldChange('jetPurcent', event.target.value)}
            >
              <s-option value="0.00">{t('settings.options.interest_rates.0.00')}</s-option>
              <s-option value="0.80">{t('settings.options.interest_rates.0.80')}</s-option>
              <s-option value="0.99">{t('settings.options.interest_rates.0.99')}</s-option>
              <s-option value="1.00">{t('settings.options.interest_rates.1.00')}</s-option>
              <s-option value="1.10">{t('settings.options.interest_rates.1.10')}</s-option>
              <s-option value="1.20">{t('settings.options.interest_rates.1.20')}</s-option>
              <s-option value="1.40">{t('settings.options.interest_rates.1.40')}</s-option>
            </s-select>
          </div>

          <div>
            <s-select
              label={t('settings.default_installments.label')}
              details={t('settings.default_installments.description')}
              value={formData.jetVnoskiDefault}
              onInput={(event) => handleFieldChange('jetVnoskiDefault', event.target.value)}
            >
              <s-option value="3">{t('settings.options.installments.3')}</s-option>
              <s-option value="6">{t('settings.options.installments.6')}</s-option>
              <s-option value="9">{t('settings.options.installments.9')}</s-option>
              <s-option value="12">{t('settings.options.installments.12')}</s-option>
              <s-option value="15">{t('settings.options.installments.15')}</s-option>
              <s-option value="18">{t('settings.options.installments.18')}</s-option>
              <s-option value="24">{t('settings.options.installments.24')}</s-option>
              <s-option value="30">{t('settings.options.installments.30')}</s-option>
              <s-option value="36">{t('settings.options.installments.36')}</s-option>
            </s-select>
          </div>

          <div>
            <s-switch
              name="jetCardIn"
              label={t('settings.card_button.label')}
              details={t('settings.card_button.description')}
              checked={formData.jetCardIn}
              onInput={(e) => handleFieldChange('jetCardIn', e.target.checked)}
            />
          </div>

          <div>
            <s-select
              value={formData.jetPurcentCard}
              label={t('settings.card_interest_rate.label')}
              details={t('settings.card_interest_rate.description')}
              onInput={(event) => handleFieldChange('jetPurcentCard', event.target.value)}
            >
              <s-option value="0.00">{t('settings.options.interest_rates.0.00')}</s-option>
              <s-option value="0.80">{t('settings.options.interest_rates.0.80')}</s-option>
              <s-option value="0.90">{t('settings.options.interest_rates.0.90')}</s-option>
              <s-option value="0.99">{t('settings.options.interest_rates.0.99')}</s-option>
              <s-option value="1.00">{t('settings.options.interest_rates.1.00')}</s-option>
              <s-option value="1.10">{t('settings.options.interest_rates.1.10')}</s-option>
              <s-option value="1.20">{t('settings.options.interest_rates.1.20')}</s-option>
              <s-option value="1.40">{t('settings.options.interest_rates.1.40')}</s-option>
            </s-select>
          </div>

          <div>
            <s-text-field
              label={t('settings.order_count.label')}
              details={t('settings.order_count.description')}
              value={formData.jetCount}
              disabled
            />
          </div>

          <div>
            <s-text-field
              type="number"
              label={t('settings.min_price.label')}
              details={t('settings.min_price.description')}
              value={formData.jetMinprice}
              onInput={(event) => handleFieldChange('jetMinprice', event.target.value)}
              placeholder={t('settings.min_price.placeholder')}
            />
            {errors.jetMinprice && (
              <s-banner status="critical" style={{ marginTop: "8px" }}>
                {errors.jetMinprice}
              </s-banner>
            )}
          </div>

          <div>
            <s-select
              label={t('settings.currency_display.label')}
              details={t('settings.currency_display.description')}
              value={formData.jetEur}
              onInput={(event) => handleFieldChange('jetEur', event.target.value)}
            >
              <s-option value="0">{t('settings.options.currency.leva_only')}</s-option>
              <s-option value="1">{t('settings.options.currency.leva_euro_dual')}</s-option>
              <s-option value="2">{t('settings.options.currency.euro_leva_dual')}</s-option>
              <s-option value="3">{t('settings.options.currency.euro_only')}</s-option>
            </s-select>
          </div>
        </s-stack>
      </s-section>

      <s-button
        slot="primary-action"
        onClick={handleSubmit}
        {...(fetcher.state === "submitting" ? { loading: true } : {})}
      >
        {fetcher.state === "submitting" ? t('settings.saving') : t('settings.save_button')}
      </s-button>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
