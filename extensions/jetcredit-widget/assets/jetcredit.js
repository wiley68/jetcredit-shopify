(function () {
  function q(root, sel) { return root.querySelector(sel); }

  function findVariantId() {
    // най-универсално: темите почти винаги държат текущ variant в input[name="id"]
    const el = document.querySelector('form[action*="/cart/add"] [name="id"]')
      || document.querySelector('[name="id"][value]');
    if (!el) return null;
    return el.value ? String(el.value) : null;
  }

  function findQty() {
    const el = document.querySelector('form[action*="/cart/add"] [name="quantity"]')
      || document.querySelector('[name="quantity"]');
    const n = el ? parseInt(el.value || "1", 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function getVariantPriceFromJSON(variantId) {
    const script = document.querySelector('[data-jetcredit-variants]');
    if (!script) return null;
    let variants;
    try { variants = JSON.parse(script.textContent); } catch { return null; }
    const v = variants.find(x => String(x.id) === String(variantId));
    // Shopify variant.price е в cents
    return v ? (v.price / 100) : null;
  }

  function fmtMoney(amount, currency) {
    const lang = document.documentElement.lang || "bg";
    try {
      return new Intl.NumberFormat(lang, { style: "currency", currency }).format(amount);
    } catch {
      // fallback
      return amount.toFixed(2) + " " + currency;
    }
  }

  async function calc(root) {
    const productGid = root.dataset.productGid;
    const shop = root.dataset.shopDomain;
    const currency = (root.dataset.currency || "").toUpperCase();

    const variantId = findVariantId();
    const qty = findQty();
    const price = variantId ? getVariantPriceFromJSON(variantId) : null;

    if (!productGid || !shop || !currency || price == null) return;

    const url = new URL("/apps/jetcredit/calc", window.location.origin);
    url.searchParams.set("shop", shop);
    url.searchParams.set("productGid", productGid);
    url.searchParams.set("price", String(price));
    url.searchParams.set("qty", String(qty));
    url.searchParams.set("currency", currency);

    // Shopify ще добави signature и т.н. когато е реален App Proxy.
    // В dev понякога ще ти се наложи да тестваш с реален shop domain.
    const res = await fetch(url.toString(), { method: "GET", headers: { "Accept": "application/json" } });
    if (!res.ok) return;
    const data = await res.json();

    const inline = q(root, '[data-jetcredit-inline]');
    const monthsEl = q(root, '[data-jetcredit-months]');
    const monthlyEl = q(root, '[data-jetcredit-monthly]');
    const monthly2El = q(root, '[data-jetcredit-monthly-second]');

    if (!data.showButton) {
      root.style.display = "none";
      return;
    }

    root.style.display = "";
    if (inline) inline.style.display = "";

    if (monthsEl) monthsEl.textContent = data.defaultMonths;
    if (monthlyEl) monthlyEl.textContent = fmtMoney(data.monthly, data.currencyMain === "EUR" ? "EUR" : "BGN");

    if (monthly2El) {
      if (data.monthlySecond != null && data.currencySecond) {
        monthly2El.style.display = "";
        monthly2El.textContent = " (" + fmtMoney(data.monthlySecond, data.currencySecond) + ")";
      } else {
        monthly2El.style.display = "none";
      }
    }
  }

  function init(root) {
    // първо смятане
    calc(root);

    // слушаме промени: quantity + variant
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!t) return;
      if (t.name === "quantity" || t.name === "id" || t.closest('[name="id"]')) {
        calc(root);
      }
    });

    document.addEventListener("input", (e) => {
      const t = e.target;
      if (t && t.name === "quantity") calc(root);
    });

    // някои теми сменят variant id без "change" (скрит input). Наблюдаваме.
    const v = document.querySelector('form[action*="/cart/add"] [name="id"]');
    if (v) {
      const mo = new MutationObserver(() => calc(root));
      mo.observe(v, { attributes: true, attributeFilter: ["value"] });
    }

    // click hook (за модал по-късно)
    const openBtn = q(root, "[data-jetcredit-open]");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        // TODO: отвори модал (ще го направим в следваща стъпка)
        // за момента само refresh calc
        calc(root);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-jetcredit-root]").forEach(init);
  });
})();
