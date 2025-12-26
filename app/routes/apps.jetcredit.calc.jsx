/* global process */

import crypto from "crypto";
import { Buffer } from "buffer";

import { getSettings } from "../models/Settings.server";
import { getActiveFilters } from "../models/Filters.server";

const FX_BGN_PER_EUR = 1.95583;

const MAX_ITER = 128;
const PRECISION = 1e-8;

/**
 * Excel-like RATE (secant method), ported from your PHP logic.
 * Returns monthly rate (decimal), e.g. 0.02 for 2% monthly.
 */
function rate(nper, pmt, pv, fv = 0.0, type = 0, guess = 0.1) {
  let r = guess;

  // Helpers
  const calcY = (rt) => {
    if (Math.abs(rt) < PRECISION) {
      return pv * (1 + nper * rt) + pmt * (1 + rt * type) * nper + fv;
    }
    const f = Math.exp(nper * Math.log(1 + rt));
    return pv * f + pmt * (1 / rt + type) * (f - 1) + fv;
  };

  let y0 = pv + pmt * nper + fv;
  let y1 = calcY(r);

  let x0 = 0.0;
  let x1 = r;

  let i = 0;
  while (Math.abs(y0 - y1) > PRECISION && i < MAX_ITER) {
    r = (y1 * x0 - y0 * x1) / (y1 - y0);

    x0 = x1;
    x1 = r;

    y0 = y1;
    y1 = calcY(r);

    i += 1;
  }

  return r;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function fmt2(n) {
  // връщаме string с 2 знака както в WP модула
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

/**
 * App Proxy signature verification (Shopify).
 */
function verifyAppProxySignature(url, sharedSecret) {
  const u = new URL(url);
  const params = new URLSearchParams(u.search);

  const signature = params.get("signature");
  if (!signature) return false;

  params.delete("signature");

  const sorted = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const message = sorted.map(([k, v]) => `${k}=${v}`).join("");

  const digest = crypto.createHmac("sha256", sharedSecret).update(message).digest("hex");

  // timing-safe compare
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Decide which filters apply:
 * - must be active (getActiveFilters already does date-range)
 * - must match productId or "*"
 * - if filter.jetProductMeseci is set, must include the requested months
 * - if there are ANY filters in DB, we require at least 1 match; otherwise fallback to settings-only
 */
function pickApplicableFilter(filters, productId, months) {
  if (!filters?.length) return null;

  const monthsStr = String(months);

  // Prefer exact product over "*"
  const exact = [];
  const wildcard = [];

  for (const f of filters) {
    const meseci = (f.jetProductMeseci || "").trim();
    if (meseci) {
      const allowed = meseci.split("_").map((x) => x.trim()).filter(Boolean);
      if (!allowed.includes(monthsStr)) continue;
    }

    if (f.jetProductId === productId) exact.push(f);
    else if (f.jetProductId === "*") wildcard.push(f);
  }

  // Your getActiveFilters sorts by productId asc then createdAt desc.
  // We'll just take newest in each bucket (first item is usually newest).
  return exact[0] || wildcard[0] || null;
}

/**
 * Currency conversion logic based on settings.jetEur and store currency.
 * We normalize "primary" calculation currency to either BGN or EUR depending on jetEur.
 */
function normalizePriceToPrimary(priceInStoreCurrency, storeCurrency, jetEur) {
  const cur = (storeCurrency || "").toUpperCase();

  // Decide primary currency
  // 0 -> keep store currency (no forced conversion)
  // 1 -> primary BGN (secondary EUR)
  // 2 -> primary EUR (secondary BGN)
  // 3 -> primary EUR only
  let primaryCurrency = cur || "BGN";

  if (jetEur === 1) primaryCurrency = "BGN";
  if (jetEur === 2 || jetEur === 3) primaryCurrency = "EUR";

  let primary = priceInStoreCurrency;

  if (primaryCurrency === "BGN" && cur === "EUR") primary = priceInStoreCurrency * FX_BGN_PER_EUR;
  if (primaryCurrency === "EUR" && cur === "BGN") primary = priceInStoreCurrency / FX_BGN_PER_EUR;

  return { primary, primaryCurrency };
}

function computeSecondCurrency(amountPrimary, jetEur) {
  // Returns { secondAmount, secondCurrency, showSecond }
  // JetEur mapping like your WP module.
  switch (jetEur) {
    case 1: // primary BGN, second EUR
      return { showSecond: true, secondCurrency: "EUR", secondAmount: amountPrimary / FX_BGN_PER_EUR };
    case 2: // primary EUR, second BGN
      return { showSecond: true, secondCurrency: "BGN", secondAmount: amountPrimary * FX_BGN_PER_EUR };
    default:
      return { showSecond: false, secondCurrency: "", secondAmount: 0 };
  }
}

async function handleCalc(request) {
  const url = new URL(request.url);

  // --- SECURITY: App Proxy signature in production ---
  const secret = process.env.SHOPIFY_API_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  // Dev bypass (optional). Keep it OFF by default.
  const allowDevBypass = process.env.ALLOW_PROXY_DEV_BYPASS === "1";
  const devBypass = url.searchParams.get("dev") === "1";

  if (!secret) {
    return new Response(JSON.stringify({ ok: false, error: "Missing SHOPIFY_API_SECRET" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hasValidSig = verifyAppProxySignature(request.url, secret);

  if (isProd && !hasValidSig) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid proxy signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isProd && !hasValidSig && !(allowDevBypass && devBypass)) {
    // In dev, App Proxy signatures are often missing if you call the app host directly.
    return new Response(JSON.stringify({
      ok: false,
      error:
        "Missing/invalid App Proxy signature. In dev, call via the shop domain App Proxy, or set ALLOW_PROXY_DEV_BYPASS=1 and add ?dev=1.",
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- INPUTS ---
  // Expected from storefront extension:
  // productId: gid://shopify/Product/...
  // price: number (in store currency, as displayed)
  // quantity: integer
  // downPayment: number
  // months: integer
  // card: "0" | "1"
  // currency: "BGN" | "EUR" ...
  const productId = (url.searchParams.get("productId") || "*").trim();
  const storeCurrency = (url.searchParams.get("currency") || "BGN").toUpperCase();

  const price = Number(url.searchParams.get("price") || 0);
  const quantity = Number.parseInt(url.searchParams.get("quantity") || "1", 10);
  const downPayment = Number(url.searchParams.get("downPayment") || 0);
  const months = Number.parseInt(url.searchParams.get("months") || "12", 10);
  const isCard = url.searchParams.get("card") === "1";

  if (!Number.isFinite(price) || price <= 0) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid price" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid quantity" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!Number.isFinite(downPayment) || downPayment < 0) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid downPayment" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!Number.isFinite(months) || months < 1 || months > 60) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid months" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- SETTINGS ---
  const settings = await getSettings();

  const jetEur = Number(settings.jetEur || 0);

  // Normalize base price to "primary" currency depending on jetEur + store currency
  const { primary: pricePrimary, primaryCurrency } = normalizePriceToPrimary(price, storeCurrency, jetEur);

  const priceAllPrimary = pricePrimary * quantity;

  // downPayment is entered/displayed in the *same primary currency* in your UI logic.
  // If you later decide downPayment entered in store currency, convert it similarly.
  const totalCreditPrimary = priceAllPrimary - downPayment;

  // base gating
  const moduleEnabled = Boolean(settings.jetStatusIn);
  const meetsMinPrice = totalCreditPrimary >= Number(settings.jetMinprice || 0);

  // --- FILTERS (promos/availability) ---
  // We pass criteria.price in PRIMARY currency (because your Filters.jetProductPrice is your own rule base).
  // If you want Filters to be stored always in BGN, we can force conversion to BGN here later.
  const activeFilters = await getActiveFilters({
    jetProductId: productId !== "*" ? productId : undefined,
    price: totalCreditPrimary,
  });

  const chosenFilter = pickApplicableFilter(activeFilters, productId, months);

  // If DB has filters at all, require a match (optional behavior).
  // If you prefer “no filters means allow”, keep this logic.
  const hasAnyFiltersInDb = Array.isArray(activeFilters) && activeFilters.length > 0;
  const passesFilterRules = hasAnyFiltersInDb ? Boolean(chosenFilter) : true;

  // Percent logic:
  // - default from settings
  // - override by filter.jetProductPercent if chosenFilter exists
  const percentBase = Number(
    chosenFilter?.jetProductPercent !== undefined && chosenFilter?.jetProductPercent !== null
      ? chosenFilter.jetProductPercent
      : settings.jetPurcent
  );

  const percentCard = Number(settings.jetPurcentCard);

  const percent = isCard ? percentCard : percentBase;

  // Final show/hide
  const jetShowButton = moduleEnabled && meetsMinPrice && passesFilterRules;

  // --- CALCS ---
  // Keep same formula as your WP module
  const monthly = (totalCreditPrimary / months) * (1 + (months * percent) / 100);
  const monthlyRounded = round2(monthly);

  // RATE expects pv negative (like in your PHP)
  const monthlyRate = rate(months, monthlyRounded, -1 * totalCreditPrimary) * 12;
  const glp = monthlyRate * 100;
  const gpr = (Math.pow(1 + monthlyRate / 12, 12) - 1) * 100;

  const totalPaid = monthlyRounded * months;

  // Secondary currency values (if needed)
  const secondPriceAll = computeSecondCurrency(priceAllPrimary, jetEur);
  const secondCredit = computeSecondCurrency(totalCreditPrimary, jetEur);
  const secondMonthly = computeSecondCurrency(monthlyRounded, jetEur);
  const secondTotalPaid = computeSecondCurrency(totalPaid, jetEur);

  return new Response(JSON.stringify({
    ok: true,

    // gating
    jetShowButton,

    // context
    productId,
    storeCurrency,
    primaryCurrency,
    jetEur,
    isCard,

    // inputs echo
    quantity,
    months,
    downPayment: fmt2(downPayment),

    // amounts primary
    priceAll: fmt2(priceAllPrimary),
    totalCredit: fmt2(totalCreditPrimary),
    monthly: fmt2(monthlyRounded),
    totalPaid: fmt2(totalPaid),

    // amounts secondary (optional)
    showSecond: secondPriceAll.showSecond,
    secondCurrency: secondPriceAll.secondCurrency,
    priceAllSecond: fmt2(secondPriceAll.secondAmount),
    totalCreditSecond: fmt2(secondCredit.secondAmount),
    monthlySecond: fmt2(secondMonthly.secondAmount),
    totalPaidSecond: fmt2(secondTotalPaid.secondAmount),

    // rates
    percent: fmt2(percent),
    gpr: fmt2(gpr),
    glp: fmt2(glp),

    // debug/promo info (safe)
    matchedFilterId: chosenFilter?.id ?? null,
    matchedFilterProductId: chosenFilter?.jetProductId ?? null,
  }), {
    headers: { "Content-Type": "application/json" },
  });
}

export const loader = async ({ request }) => {
  return handleCalc(request);
};

// Optional: allow POST too (some people prefer POST from storefront JS)
export const action = async ({ request }) => {
  // If you want POST, you can parse body and re-create a URL with params.
  // For now, keep it simple: accept POST form-data and translate to query.
  const form = await request.formData();
  const u = new URL(request.url);

  for (const [k, v] of form.entries()) {
    u.searchParams.set(k, String(v));
  }

  // Keep signature verification based on ORIGINAL request.url (Shopify sends signature in query).
  // So we call handleCalc with a fake request pointing to the merged URL but same origin.
  const fakeRequest = new Request(u.toString(), { method: "GET", headers: request.headers });
  return handleCalc(fakeRequest);
};
