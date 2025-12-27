(() => {
  const FX = 1.95583;
  const PRECISION = 1e-8;
  const MAX_ITER = 128;

  const ALL_MONTHS = [3, 6, 9, 10, 12, 15, 18, 24, 30, 36];

  function money2(n) {
    return (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);
  }

  function getCurrency() {
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
    return (totalCredit / months) * (1 + (months * percent) / 100);
  }

  function calcGprGlp(totalCredit, months, monthly) {
    const r = rate(months, monthly, -1 * totalCredit);
    const glp = r * 12 * 100;
    const gpr = (Math.pow(1 + r, 12) - 1) * 100;
    return { gpr, glp };
  }

  function primarySecondaryByJetEur(jetEur, storeCurrency) {
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

  function curLabelBG(cur) {
    return cur === "EUR" ? "евро" : "лв.";
  }

  // thresholds in primary currency
  function threshold(amountBGN, primaryCur) {
    return primaryCur === "EUR" ? (amountBGN / FX) : amountBGN;
  }

  function isMonthAllowed(month, totalPrimary, primaryCur) {
    const t400 = threshold(400, primaryCur);
    const t600 = threshold(600, primaryCur);

    if ([15, 18, 24].includes(month)) return totalPrimary >= t400;
    if ([30, 36].includes(month)) return totalPrimary >= t600;
    return true;
  }

  function firstAllowedMonth(totalPrimary, primaryCur) {
    for (const m of ALL_MONTHS) {
      if (isMonthAllowed(m, totalPrimary, primaryCur)) return m;
    }
    return 12;
  }

  function filterHasMonth(filter, month) {
    const s = String(filter?.jetProductMeseci || "").trim();
    if (!s) return false;
    return s.split("_")
      .map(x => parseInt(x, 10))
      .some(n => Number.isFinite(n) && n === month);
  }

  function percentForMonth(filters, settingsPercent, month) {
    let p = Number(settingsPercent) || 0;
    (filters || []).forEach(f => {
      const fp = Number(f?.jetProductPercent);
      if (!Number.isFinite(fp) || fp === 0) return;
      if (filterHasMonth(f, month)) p = fp;
    });
    return p;
  }

  function buildModalOnce() {
    if (document.getElementById("jetcreditModalOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "jetcreditModalOverlay";
    overlay.className = "jetcredit-modalOverlay";
    overlay.innerHTML = `
      <div id="jet-product-popup-container" class="jetcredit-modal" role="dialog" aria-modal="true">
        <div class="jetcredit-modalHeader">
          <div class="jetcredit-modalTitle">ПБ Лични Финанси</div>
          <button type="button" class="jetcredit-closeBtn" aria-label="Close">✕</button>
        </div>

        <div class="jetcredit-modalBody">
          <div class="jetcredit-grid">
            <div class="jetcredit-rowLabel">Първоначална вноска (<span id="jc_currency"></span>)</div>
            <input class="jetcredit-input" id="jc_parva" type="number" min="0" value="0">

            <div class="jetcredit-rowLabel">Цена на стоките <span name="jc_currencyTwo"></span></div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_price" type="text" readonly>

            <div class="jetcredit-rowLabel">Брой вноски</div>
            <select class="jetcredit-select" id="jc_months"></select>

            <div class="jetcredit-rowLabel">Общ размер на кредита <span name="jc_currencyTwo"></span></div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_credit" type="text" readonly>

            <div class="jetcredit-rowLabel">Месечна вноска <span name="jc_currencyTwo"></span></div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_monthly" type="text" readonly>

            <div class="jetcredit-rowLabel">Фикс ГПР (%)</div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_gpr" type="text" readonly>

            <div class="jetcredit-rowLabel">ГЛП (%)</div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_glp" type="text" readonly>

            <div class="jetcredit-rowLabel">Обща стойност на плащанията <span name="jc_currencyTwo"></span></div>
            <input class="jetcredit-input jetcredit-readonly" id="jc_totalPay" type="text" readonly>
          </div>
        </div>

        <div class="jetcredit-modalFooter">
          <div class="jetcredit-footer">
            <button type="button" class="jetcredit-btn secondary" id="jc_cancel">Откажи</button>
            <button type="button" class="jetcredit-btn" id="jc_recalc">Преизчисли</button>
          </div>
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
    document.getElementById("jetcreditModalOverlay").classList.add("is-open");
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

        const totalStore = Number(data.context?.total ?? 0);
        const totalPrimary = convert(totalStore, currency || primary, primary || currency);

        const defaultMonths = Number(data.settings?.jetVnoskiDefault ?? 12);
        const months = isMonthAllowed(defaultMonths, totalPrimary, primary || currency)
          ? defaultMonths
          : firstAllowedMonth(totalPrimary, primary || currency);

        const settingsPercent = Number(data.settings?.jetPurcent ?? 0);
        const percent = percentForMonth(data.filters, settingsPercent, months);

        const monthlyStore = calcMonthly(totalStore, months, percent);
        const monthlyPrimary = convert(monthlyStore, currency || primary, primary || currency);

        monthsEl.textContent = months;
        monthlyEl.textContent = money2(monthlyPrimary);
        currEl.textContent = (primary || currency) === "EUR" ? "евро" : "лв.";

        if (secondary) {
          miniTextSecond.style.display = "";
          const monthlySec = convert(monthlyPrimary, primary || currency, secondary);
          miniMonthlySecond.textContent = money2(monthlySec);
          miniCurrencySecond.textContent = secondary === "EUR" ? "евро" : "лв.";
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

      const currentCurrency = overlay.querySelector("#jc_currency");
      const currentCurrencyTwo = overlay.querySelectorAll("[name='jc_currencyTwo']");

      const priceEl = overlay.querySelector("#jc_price");
      const creditEl = overlay.querySelector("#jc_credit");
      const monthsSel = overlay.querySelector("#jc_months");
      const parvaEl = overlay.querySelector("#jc_parva");
      const monthlyOut = overlay.querySelector("#jc_monthly");
      const totalPayOut = overlay.querySelector("#jc_totalPay");
      const gprOut = overlay.querySelector("#jc_gpr");
      const glpOut = overlay.querySelector("#jc_glp");

      const currency = getCurrency();
      const jetEur = lastData.settings?.jetEur ?? 0;
      const { primary, secondary } = primarySecondaryByJetEur(jetEur, currency);
      const pCur = primary || currency;

      const totalStore = Number(lastData.context?.total ?? 0);
      const totalPrimary = convert(totalStore, currency || pCur, pCur);

      function labelSuffix(pCurX, sCurX) {
        const p = curLabelBG(pCurX);
        if (!sCurX) return `(${p})`;
        const s = curLabelBG(sCurX);
        return `(${p}/${s})`;
      }

      // ✅ NEW: input values WITHOUT currency symbols
      function fmtDualNumbers(primaryAmount, primaryCurX, secondaryCurX) {
        if (!secondaryCurX) return money2(primaryAmount);
        const secondaryAmount = convert(primaryAmount, primaryCurX, secondaryCurX);
        return `${money2(primaryAmount)} / ${money2(secondaryAmount)}`;
      }

      function fillMonthsSelect(selectedMonth) {
        monthsSel.innerHTML = "";
        ALL_MONTHS.forEach(m => {
          const opt = document.createElement("option");
          opt.value = String(m);
          opt.textContent = `${m} месеца`;

          const ok = isMonthAllowed(m, totalPrimary, pCur);
          opt.disabled = !ok;

          if (m === selectedMonth) opt.selected = true;
          monthsSel.appendChild(opt);
        });
      }

      const defaultMonths = Number(lastData.settings?.jetVnoskiDefault ?? 12);
      const initialMonths = isMonthAllowed(defaultMonths, totalPrimary, pCur)
        ? defaultMonths
        : firstAllowedMonth(totalPrimary, pCur);

      fillMonthsSelect(initialMonths);

      function ensureAllowedSelected() {
        const current = parseInt(monthsSel.value, 10);
        if (!Number.isFinite(current)) return firstAllowedMonth(totalPrimary, pCur);

        if (isMonthAllowed(current, totalPrimary, pCur)) return current;

        const fallback = firstAllowedMonth(totalPrimary, pCur);
        monthsSel.value = String(fallback);
        return fallback;
      }

      function recalc() {
        const months = ensureAllowedSelected();

        const parvaRaw = Math.max(0, Number(parvaEl.value || 0));
        if (parvaRaw >= totalStore) parvaEl.value = "0";

        const down = Math.max(0, Math.min(totalStore - 0.01, Number(parvaEl.value || 0)));
        const creditStore = totalStore - down;

        const settingsPercent = Number(lastData.settings?.jetPurcent ?? 0);
        const percent = percentForMonth(lastData.filters, settingsPercent, months);

        const monthlyStore = calcMonthly(creditStore, months, percent);
        const totalPayStore = monthlyStore * months;
        const { gpr, glp } = calcGprGlp(creditStore, months, monthlyStore);

        const totalPrimaryX = convert(totalStore, currency || pCur, pCur);
        const creditPrimary = convert(creditStore, currency || pCur, pCur);
        const monthlyPrimary = convert(monthlyStore, currency || pCur, pCur);
        const totalPayPrimary = convert(totalPayStore, currency || pCur, pCur);

        currentCurrency.textContent = curLabelBG(pCur);
        currentCurrencyTwo.forEach(el => {
          el.textContent = labelSuffix(pCur, secondary);
        });

        // ✅ Inputs: ONLY numbers (and "/" if secondary exists)
        priceEl.value = fmtDualNumbers(totalPrimaryX, pCur, secondary);
        creditEl.value = fmtDualNumbers(creditPrimary, pCur, secondary);
        monthlyOut.value = fmtDualNumbers(monthlyPrimary, pCur, secondary);
        totalPayOut.value = fmtDualNumbers(totalPayPrimary, pCur, secondary);

        gprOut.value = money2(gpr);
        glpOut.value = money2(glp);
      }

      overlay.querySelector("#jc_recalc").onclick = recalc;
      monthsSel.onchange = recalc;
      parvaEl.oninput = () => {
        window.clearTimeout(parvaEl._t);
        parvaEl._t = window.setTimeout(recalc, 150);
      };

      recalc();
      openModal();
    }

    logoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      renderModal();
    });

    document.addEventListener("change", (e) => {
      const t = e.target;
      if (t && (t.name === "quantity" || t.name === "id")) refresh();
    });

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
