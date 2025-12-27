import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useAttributeValues } from '@shopify/ui-extensions/checkout/preact';

export default function extension() {
  render(<App />, document.body);
}

function App() {
  // Четем атрибутите записани от product extension-а
  const [
    jetEnabled,
    jetMonths,
    jetDown,
    jetTotalPrimary,
    jetCurrencyPrimary,
    jetPercent,
    jetCard,
  ] = useAttributeValues([
    "jetcredit_enabled",
    "jet_months",
    "jet_down",
    "jet_total_primary",
    "jet_currency_primary",
    "jet_percent",
    "jet_card",
  ]);

  // Дебъг логване на конзолата
  console.log("🔍 JetCredit Checkout Extension Debug:");
  console.log("jetcredit_enabled:", jetEnabled);
  console.log("jet_months:", jetMonths);
  console.log("jet_down:", jetDown);
  console.log("jet_total_primary:", jetTotalPrimary);
  console.log("jet_currency_primary:", jetCurrencyPrimary);
  console.log("jet_percent:", jetPercent);
  console.log("jet_card:", jetCard);

  // Ако има данни, показваме summary
  const hasData = jetEnabled === "1";

  return (
    <s-text>
      {hasData
        ? `JetCredit активен: ${jetMonths} месеца, ${jetDown} BGN аванс, ${jetPercent}% лихва`
        : "JetCredit checkout extension loaded ✅ (няма данни)"}
    </s-text>
  );
}
