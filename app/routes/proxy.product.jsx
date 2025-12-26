import { authenticate } from "../shopify.server";
import { getSettings } from "../models/Settings.server";
import { getActiveFilters } from "../models/Filters.server";

function intParam(url, key, fallback = 0) {
  const v = url.searchParams.get(key);
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export const loader = async ({ request }) => {
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);

  const productId = url.searchParams.get("productId") || "";
  const variantId = url.searchParams.get("variantId") || "";
  const currency = url.searchParams.get("currency") || "";

  const priceCents = intParam(url, "priceCents", 0);
  const qty = Math.max(1, intParam(url, "qty", 1));

  const totalCents = priceCents * qty;
  const total = totalCents / 100;

  const settings = await getSettings();

  // jetMinprice is in store base currency units, so compare in cents
  const minCents = Math.round((settings.jetMinprice ?? 0) * 100);

  const visible = Boolean(settings.jetStatusIn) && totalCents >= minCents;

  if (!visible) {
    return Response.json({
      visible: false,
      reason: "disabled_or_below_min_price",
      context: { productId, variantId, currency, priceCents, qty, totalCents, total },
    });
  }

  const filters = await getActiveFilters({
    jetProductId: productId ? `gid://shopify/Product/${productId}` : undefined,
    price: total, // DB is stored as float units
  });

  return Response.json({
    visible: true,
    settings: {
      jetEmail: settings.jetEmail,
      jetId: settings.jetId,
      jetPurcent: settings.jetPurcent,
      jetVnoskiDefault: settings.jetVnoskiDefault,
      jetCardIn: settings.jetCardIn,
      jetPurcentCard: settings.jetPurcentCard,
      jetMinprice: settings.jetMinprice,
      jetEur: settings.jetEur,
    },
    context: { productId, variantId, currency, priceCents, qty, totalCents, total },
    filters,
  });
};
