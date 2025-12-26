(() => {
  function moneyToNumber(cents) {
    return (Number(cents) || 0) / 100;
  }

  async function cartUpdateAttributes(attributes) {
    const res = await fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ attributes }),
    });
    if (!res.ok) throw new Error("Cart update failed");
    return res.json();
  }

  function findProductForm(root) {
    // Theme-agnostic: find closest product form
    // If block is not inside product form, we still try document-wide.
    return root.closest('form[action^="/cart/add"]') || document.querySelector('form[action^="/cart/add"]');
  }

  function getCurrentVariantId(form) {
    const idInput = form?.querySelector('input[name="id"]');
    return idInput?.value ? String(idInput.value) : null;
  }

  function getCurrentQuantity(form) {
    const qtyInput = form?.querySelector('input[name="quantity"]');
    const q = qtyInput?.value ? parseInt(qtyInput.value, 10) : 1;
    return Number.isFinite(q) && q > 0 ? q : 1;
  }

  function readProductJson(root) {
    const el = root.querySelector(".jetcredit-product-json");
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  }

  function pickVariant(product, variantId) {
    if (!product?.variants?.length) return null;
    if (!variantId) return product.variants[0];
    return product.variants.find(v => String(v.id) === String(variantId)) || product.variants[0];
  }

  // TODO: replace with your real formulas
  function calcMonthly(totalPrice, months, downPayment) {
    const credit = Math.max(0, totalPrice - (Number(downPayment) || 0));
    if (!months || months <= 0) return 0;
    return credit / months;
  }

  function fmt(n) {
    return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
  }

  function init(root) {
    const product = readProductJson(root);
    const form = findProductForm(root);

    const currency = root.dataset.currency || "";
    const minPrice = Number(root.dataset.minPrice || 0);
    const defaultMonths = parseInt(root.dataset.defaultMonths || "12", 10) || 12;

    const elMonths = root.querySelector(".jetcredit-months");
    const elMonthly = root.querySelector(".jetcredit-monthly");
    const elSign = root.querySelector(".jetcredit-currency-sign");

    const modal = root.querySelector(".jetcredit-modal");
    const btnOpen = root.querySelector(".jetcredit-open");
    const btnCancel = root.querySelector(".jetcredit-cancel");
    const btnRecalc = root.querySelector(".jetcredit-recalc");
    const btnSave = root.querySelector(".jetcredit-save");

    const inputDown = root.querySelector(".jetcredit-downpayment");
    const selectMonths = root.querySelector(".jetcredit-months-select");

    const elTotal = root.querySelector(".jetcredit-total");
    const elCredit = root.querySelector(".jetcredit-credit-total");
    const elMonthlyPopup = root.querySelector(".jetcredit-monthly-popup");
    const elApr = root.querySelector(".jetcredit-apr");
    const elInterest = root.querySelector(".jetcredit-interest");

    const cbTos = root.querySelector(".jetcredit-tos");
    const cbGdpr = root.querySelector(".jetcredit-gdpr");

    // preset default months in select
    if (selectMonths) selectMonths.value = String(defaultMonths);

    function currentTotals() {
      const variantId = getCurrentVariantId(form);
      const qty = getCurrentQuantity(form);
      const v = pickVariant(product, variantId);
      const price = moneyToNumber(v?.price); // price in cents
      const total = price * qty;
      return { variantId, qty, total };
    }

    function updateUI() {
      const { total } = currentTotals();
      const months = parseInt(selectMonths?.value || String(defaultMonths), 10) || defaultMonths;
      const down = Number(inputDown?.value || 0);

      // gating by min price
      const enabled = total >= minPrice;

      const monthly = calcMonthly(total, months, down);

      if (elMonths) elMonths.textContent = String(months);
      if (elMonthly) elMonthly.textContent = fmt(monthly);
      if (elSign) elSign.textContent = currency === "BGN" ? "лв." : currency;

      if (elTotal) elTotal.textContent = fmt(total);
      if (elCredit) elCredit.textContent = fmt(Math.max(0, total - down));
      if (elMonthlyPopup) elMonthlyPopup.textContent = fmt(monthly);

      // placeholders (ще ги вържем към реалните формули)
      if (elApr) elApr.textContent = "–";
      if (elInterest) elInterest.textContent = "–";

      // enable save only if tos+gdpr checked and enabled by min price
      const ok = enabled && !!cbTos?.checked && !!cbGdpr?.checked;
      if (btnSave) {
        btnSave.disabled = !ok;
        btnSave.style.opacity = ok ? "1" : "0.5";
      }
    }

    function showModal() {
      if (!modal) return;
      modal.style.display = "block";
      modal.setAttribute("aria-hidden", "false");
      updateUI();
    }

    function hideModal() {
      if (!modal) return;
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }

    async function saveSelection() {
      const { total } = currentTotals();
      const months = parseInt(selectMonths?.value || String(defaultMonths), 10) || defaultMonths;
      const down = Number(inputDown?.value || 0);
      const monthly = calcMonthly(total, months, down);

      // cart attributes (whole-cart)
      const attrs = {
        pb_enabled: "1",
        pb_months: String(months),
        pb_down_payment: fmt(down),
        pb_total: fmt(total),
        pb_monthly: fmt(monthly),
        pb_currency: currency || "",
        pb_version: "1",
      };

      btnSave?.setAttribute("disabled", "true");
      btnSave && (btnSave.style.opacity = "0.5");

      await cartUpdateAttributes(attrs);
      hideModal();
      // UX: maybe toast or small message near button
    }

    // Events
    btnOpen?.addEventListener("click", showModal);
    btnCancel?.addEventListener("click", hideModal);
    btnRecalc?.addEventListener("click", updateUI);
    btnSave?.addEventListener("click", saveSelection);

    selectMonths?.addEventListener("change", updateUI);
    inputDown?.addEventListener("input", updateUI);
    cbTos?.addEventListener("change", updateUI);
    cbGdpr?.addEventListener("change", updateUI);

    // Watch variant/qty changes
    // Theme-agnostic approach: listen to changes in the form
    form?.addEventListener("change", () => updateUI());
    form?.addEventListener("input", () => updateUI());

    // Initial draw
    updateUI();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".jetcredit-root").forEach(init);
  });
})();
