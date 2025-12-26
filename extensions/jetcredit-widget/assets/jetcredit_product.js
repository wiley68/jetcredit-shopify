(() => {
  const FX = 1.95583;
  const PRECISION = 1e-8;
  const MAX_ITER = 128;

  function money2(n) {
    return (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);
  }

  function getCurrency() {
    // Shopify storefront often has this
    if (window.Shopify?.currency?.active) return window.Shopify.currency.active;
    const meta = document.querySelector('meta[property="og:price:currency"]');
    if (meta?.content) return meta.content;
    return "";
  }

  function getQty() {
    const q = document.querySelector('input[name="quantity"]');
    const v = q ? parseInt(q.value || "1", 10) : 1;
    return Number.isFinite(v) && v > 0 ? v : 1;
  }

  function getVariantIdFromForm() {
    const id = document.querySelector('form[action^="/cart/add"] [name="id"]');
    return id?.value || "";
  }

  function parseProductJson(widgetEl) {
    const script = widgetEl.querySelector(".jetcredit-product-json");
    if (!script?.textContent) return null;
    try {
      return JSON.parse(script.textContent);
    } catch {
      return null;
    }
  }

  function findVariant(product, variantId) {
    if (!product?.variants?.length) return null;
    if (!variantId) return product.variants[0];
    const vid = String(variantId);
    return product.variants.find(v => String(v.id) === vid) || product.variants[0];
  }

  // RATE implementation (Excel-like), monthly rate
  function rate(nper, pmt, pv, fv = 0.0, type = 0, guess = 0.1) {
    let r = guess;
    let y0, y1, y, f;

    function calcY(rateVal) {
      if (Math.abs(rateVal) < PRECISION) {
        return pv * (1 + nper * rateVal) + pmt * (1 + rateVal * type) * nper + fv;
      }
      f = Math.exp(nper * Math.log(1 + rateVal));
      return pv * f + pmt * (1 / rateVal + type) * (f - 1) + fv;
    }

    y0 = pv + pmt * nper + fv;
    y1 = calcY(r);

    let i = 0;
    let x0 = 0.0;
    let x1 = r;

    while (Math.abs(y0 - y1) > PRECISION && i < MAX_ITER) {
      r = (y1 * x0 - y0 * x1) / (y1 - y0);
      x0 = x1;
      x1 = r;

      y = calcY(r);
      y0 = y1;
      y1 = y;
      i++;
    }
    return r;
  }

  function calcMonthly(totalCredit, months, percent) {
    // vnoska = (total/months) * (1 + (months*percent)/100)
    return (totalCredit / months) * (1 + (months * percent) / 100);
  }

  function calcGprGlp(totalCredit, months, monthly) {
    // Using same math as PHP
    const r = rate(months, monthly, -1 * totalCredit); // monthly rate
    const glp = r * 12 * 100;
    const gpr = (Math.pow(1 + r, 12) - 1) * 100;
    return { gpr, glp };
  }

  function normalizeInstallments(filters, fallback) {
    // Collect installments from filters (jetProductMeseci: "3_6_12")
    const set = new Set();
    (filters || []).forEach(f => {
      const s = (f.jetProductMeseci || "").trim();
      if (!s) return;
      s.split("_").map(x => parseInt(x, 10)).forEach(n => {
        if (Number.isFinite(n) && n > 0) set.add(n);
      });
    });

    const arr = Array.from(set).sort((a, b) => a - b);
    if (!arr.length) return { list: [fallback], selected: fallback };
    const selected = arr.includes(fallback) ? fallback : arr[0];
    return { list: arr, selected };
  }

  function resolvePercent(filters, settingsPercent) {
    // If any filter has non-zero percent, prefer the most specific:
    // Here: take last filter (already ordered by your backend) with jetProductPercent != 0
    let p = settingsPercent;
    (filters || []).forEach(f => {
      if (typeof f.jetProductPercent === "number" && f.jetProductPercent !== 0) p = f.jetProductPercent;
    });
    return p;
  }

  function primarySecondaryByJetEur(jetEur, storeCurrency) {
    // This follows your meaning:
    // 0: BGN only
    // 1: BGN primary + EUR secondary
    // 2: EUR primary + BGN secondary
    // 3: EUR only
    // We don't *force* store currency, we just display per setting.
    const primary = (jetEur === 2 || jetEur === 3) ? "EUR" : "BGN";
    const secondary =
      (jetEur === 1) ? "EUR" :
        (jetEur === 2) ? "BGN" :
          "";
    return { primary, secondary, storeCurrency };
  }

  function convert(amount, from, to) {
    if (from === to) return amount;
    if (from === "BGN" && to === "EUR") return amount / FX;
    if (from === "EUR" && to === "BGN") return amount * FX;
    return amount;
  }

  function buildModalOnce() {
    if (document.getElementById("jetcreditModalOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "jetcreditModalOverlay";
    overlay.className = "jetcredit-modalOverlay";
    overlay.innerHTML = `
      <div class="jetcredit-modal" role="dialog" aria-modal="true">
        <div class="jetcredit-modalHeader">
          <div class="jetcredit-modalTitle">ПБ Лични Финанси</div>
          <button type="button" class="jetcredit-closeBtn" aria-label="Close">✕</button>
        </div>

        <div class="jetcredit-grid">
          <div>
            <div class="jetcredit-rowLabel">Първоначална вноска</div>
            <input class="jetcredit-input" id="jc_parva" type="number" min="0" value="0">
          </div>

          <div>
            <div class="jetcredit-rowLabel">Брой вноски</div>
            <select class="jetcredit-select" id="jc_months"></select>
          </div>

          <div>
            <div class="jetcredit-rowLabel">Цена на стоките</div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_price" type="text" readonly>
          </div>

          <div>
            <div class="jetcredit-rowLabel">Общ размер на кредита</div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_credit" type="text" readonly>
          </div>

          <div>
            <div class="jetcredit-rowLabel">Месечна вноска</div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_monthly" type="text" readonly>
          </div>

          <div>
            <div class="jetcredit-rowLabel">Обща стойност на плащанията</div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_totalPay" type="text" readonly>
          </div>

          <div>
            <div class="jetcredit-rowLabel">Фикс ГПР (%)</div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_gpr" type="text" readonly>
          </div>

          <div>
            <div class="jetcredit-rowLabel">ГЛП (%)</div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_glp" type="text" readonly>
          </div>

          <div id="jc_secondaryWrap" style="grid-column: 1 / -1; display:none;">
            <div class="jetcredit-rowLabel" style="margin-bottom:6px;">Сума във втора валута</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px 16px;">
              <input class="jetcredit-input jetcredit-readonly" id="jc_secondaryMonthly" type="text" readonly>
              <input class="jetcredit-input jetcredit-readonly" id="jc_secondaryTotal" type="text" readonly>
            </div>
          </div>
        </div>

        <div class="jetcredit-footer">
          <button type="button" class="jetcredit-btn secondary" id="jc_cancel">Откажи</button>
          <button type="button" class="jetcredit-btn" id="jc_recalc">Преизчисли</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.classList.remove("is-open");
    overlay.querySelector(".jetcredit-closeBtn").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector("#jc_cancel").addEventListener("click", close);
  }

  function openModal() {
    const overlay = document.getElementById("jetcreditModalOverlay");
    overlay.classList.add("is-open");
  }

  async function fetchProxy(basePath, params, abortSignal) {
    const url = new URL(basePath, window.location.origin);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    const res = await fetch(url.toString(), { credentials: "same-origin", signal: abortSignal });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Proxy HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    return res.json();
  }

  function proxyPath() {
    // Your app proxy is prefix=apps, subpath=jetcredit, and we created /proxy/product route
    return "/apps/jetcredit/product";
  }

  function initOne(widgetEl) {
    const product = parseProductJson(widgetEl);
    if (!product) return;

    const inline = widgetEl.querySelector(".jetcredit-inline");
    const errBox = widgetEl.querySelector(".jetcredit-error");
    const monthsEl = widgetEl.querySelector(".jetcredit-miniMonths");
    const monthlyEl = widgetEl.querySelector(".jetcredit-miniMonthly");
    const currEl = widgetEl.querySelector(".jetcredit-miniCurrency");
    const logoBtn = widgetEl.querySelector(".jetcredit-logoBtn");
    const miniTextSecond = widgetEl.querySelector(".jetcredit-miniTextSecond");
    const miniMonthlySecond = widgetEl.querySelector(".jetcredit-miniMonthlySecond");
    const miniCurrencySecond = widgetEl.querySelector(".jetcredit-miniCurrencySecond");

    buildModalOnce();

    let lastController = null;
    let lastData = null;

    async function refresh() {
      errBox.hidden = true;
      errBox.textContent = "";

      const currency = getCurrency();
      const qty = getQty();
      const variantId = getVariantIdFromForm();
      const variant = findVariant(product, variantId);

      if (!variant) return;

      // Shopify variant.price is usually cents
      const priceCents = Number.isFinite(Number(variant.price)) ? Number(variant.price) : 0;
      const params = {
        productId: String(product.id),
        variantId: String(variant.id),
        priceCents,
        qty,
        currency
      };

      if (lastController) lastController.abort();
      lastController = new AbortController();

      try {
        const data = await fetchProxy(proxyPath(), params, lastController.signal);
        lastData = data;

        if (!data?.visible) {
          inline.hidden = true;
          return;
        }

        const jetEur = data.settings?.jetEur ?? 0;
        const { primary, secondary } = primarySecondaryByJetEur(jetEur, currency);

        const total = Number(data.context?.total ?? 0);
        const settingsPercent = Number(data.settings?.jetPurcent ?? 0);
        const percent = resolvePercent(data.filters, settingsPercent);

        const defaultMonths = Number(data.settings?.jetVnoskiDefault ?? 12);

        const monthly = calcMonthly(total, defaultMonths, percent);

        monthsEl.textContent = defaultMonths;
        monthlyEl.textContent = money2(monthly);
        currEl.textContent = (primary || currency) === "EUR" ? "евро" : "лв.";

        if (secondary) {
          miniTextSecond.style.display = "";
          const monthlySec = convert(monthly, primary || currency, secondary);
          miniMonthlySecond.textContent = money2(monthlySec);
          miniCurrencySecond.textContent = (secondary) === "EUR" ? "евро" : "лв.";
        } else {
          miniTextSecond.style.display = "none";
        }

        inline.hidden = false;

      } catch (e) {
        inline.hidden = true;
        errBox.hidden = false;
        errBox.textContent = `jetcredit: proxy fetch failed (${e.message})`;
        console.error("jetcredit: proxy fetch failed", e);
      }
    }

    function renderModal() {
      if (!lastData?.visible) return;

      const overlay = document.getElementById("jetcreditModalOverlay");
      const priceEl = overlay.querySelector("#jc_price");
      const creditEl = overlay.querySelector("#jc_credit");
      const monthsSel = overlay.querySelector("#jc_months");
      const parvaEl = overlay.querySelector("#jc_parva");
      const monthlyOut = overlay.querySelector("#jc_monthly");
      const totalPayOut = overlay.querySelector("#jc_totalPay");
      const gprOut = overlay.querySelector("#jc_gpr");
      const glpOut = overlay.querySelector("#jc_glp");

      const secWrap = overlay.querySelector("#jc_secondaryWrap");
      const secMonthly = overlay.querySelector("#jc_secondaryMonthly");
      const secTotal = overlay.querySelector("#jc_secondaryTotal");

      const currency = getCurrency();
      const jetEur = lastData.settings?.jetEur ?? 0;
      const { primary, secondary } = primarySecondaryByJetEur(jetEur, currency);

      const total = Number(lastData.context?.total ?? 0);
      const fallbackMonths = Number(lastData.settings?.jetVnoskiDefault ?? 12);
      const { list, selected } = normalizeInstallments(lastData.filters, fallbackMonths);

      const settingsPercent = Number(lastData.settings?.jetPurcent ?? 0);
      const percent = resolvePercent(lastData.filters, settingsPercent);

      // Populate months select
      monthsSel.innerHTML = "";
      list.forEach(m => {
        const opt = document.createElement("option");
        opt.value = String(m);
        opt.textContent = `${m} месеца`;
        if (m === selected) opt.selected = true;
        monthsSel.appendChild(opt);
      });

      function fmt(amount, cur) {
        const sym = cur === "EUR" ? "€" : "лв.";
        return `${money2(amount)} ${sym}`;
      }

      function recalc() {
        const months = parseInt(monthsSel.value, 10) || selected;
        const parva = Math.max(0, Number(parvaEl.value || 0));
        if (parva >= total) {
          // keep simple guard; you can show nice banner later
          parvaEl.value = "0";
        }
        const down = Math.max(0, Math.min(total - 0.01, Number(parvaEl.value || 0)));
        const credit = total - down;
        const monthly = calcMonthly(credit, months, percent);
        const totalPay = monthly * months;
        const { gpr, glp } = calcGprGlp(credit, months, monthly);

        // Display in "primary" currency as per jetEur
        const totalPrimary = convert(total, currency || primary, primary || currency);
        const creditPrimary = convert(credit, currency || primary, primary || currency);
        const monthlyPrimary = convert(monthly, currency || primary, primary || currency);
        const totalPayPrimary = convert(totalPay, currency || primary, primary || currency);

        priceEl.value = fmt(totalPrimary, primary || currency);
        creditEl.value = fmt(creditPrimary, primary || currency);
        monthlyOut.value = fmt(monthlyPrimary, primary || currency);
        totalPayOut.value = fmt(totalPayPrimary, primary || currency);
        gprOut.value = money2(gpr);
        glpOut.value = money2(glp);

        if (secondary) {
          secWrap.style.display = "";
          const monthlySec = convert(monthlyPrimary, primary || currency, secondary);
          const totalPaySec = convert(totalPayPrimary, primary || currency, secondary);
          secMonthly.value = `Месечна: ${fmt(monthlySec, secondary)}`;
          secTotal.value = `Общо: ${fmt(totalPaySec, secondary)}`;
        } else {
          secWrap.style.display = "none";
        }
      }

      overlay.querySelector("#jc_recalc").onclick = recalc;
      monthsSel.onchange = recalc;
      parvaEl.oninput = () => {
        // debounce-lite
        window.clearTimeout(parvaEl._t);
        parvaEl._t = window.setTimeout(recalc, 150);
      };

      recalc();
      openModal();
    }

    // Open modal on logo click
    logoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      renderModal();
    });

    // Refresh on quantity / variant changes
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (t && (t.name === "quantity" || t.name === "id")) refresh();
    });

    // Also refresh on URL variant change (some themes)
    window.addEventListener("popstate", refresh);

    refresh();
  }

  function initAll() {
    document.querySelectorAll("[data-jetcredit]").forEach(initOne);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
