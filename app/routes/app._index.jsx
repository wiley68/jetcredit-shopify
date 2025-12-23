import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getModuleStatus, toggleModuleStatus } from "../models/Settings.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // Load module status from database
  const moduleStatus = await getModuleStatus();

  return {
    moduleStatus
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case "toggle_module":
      const status = formData.get("status") === "true";

      // Update module status in database
      await toggleModuleStatus(status);

      return { success: true, moduleStatus: status };

    default:
      return { success: false, error: "Unknown action" };
  }
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const { moduleStatus: initialModuleStatus } = useLoaderData();
  const [moduleStatus, setModuleStatus] = useState(initialModuleStatus);

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Settings updated successfully");
      // Update local state when database is updated
      if (fetcher.data.moduleStatus !== undefined) {
        setModuleStatus(fetcher.data.moduleStatus);
      }
    }
  }, [fetcher.data?.success, fetcher.data?.moduleStatus, shopify]);

  const toggleModuleStatus = () => {
    const newStatus = !moduleStatus;
    setModuleStatus(newStatus);
    fetcher.submit(
      { action: "toggle_module", status: newStatus },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="JetCredit Overview">
      <s-button
        slot="primary-action"
        onClick={toggleModuleStatus}
        {...(fetcher.state === "submitting" ? { loading: true } : {})}
      >
        {moduleStatus ? "Изключи модула" : "Включи модула"}
      </s-button>

      <s-section heading="JetCredit - Финансиране с Пощенска банка">
        <s-paragraph>
          <s-badge tone={moduleStatus ? "success" : "critical"}>
            {moduleStatus ? "Активен модул" : "Неактивен модул"}
          </s-badge>
        </s-paragraph>
        <s-paragraph>
          JetCredit е специализиран модул за интеграция с Пощенска банка,
          който позволява на вашите клиенти да пазаруват на кредит директно
          през вашия Shopify магазин.
        </s-paragraph>
        <s-paragraph>
          Модулът автоматично изчислява месечните вноски, прилага индивидуални
          лихвени проценти и осигурява безпроблемно прехвърляне на поръчките
          към системата на банката.
        </s-paragraph>
      </s-section>

      <s-section heading="Основни характеристики">
        <s-paragraph>
          ✓ Автоматично изчисляване на месечни вноски<br />
          ✓ Индивидуални лихвени проценти по продукти<br />
          ✓ Интеграция с банкова система за одобрение<br />
          ✓ Безопасно предаване на данни<br />
          ✓ Поддръжка на различни срокове за погасяване (6-30 месеца)<br />
          ✓ Автоматична актуализация на наличности
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Бързи действия">
        <s-button
          onClick={toggleModuleStatus}
          {...(fetcher.state === "submitting" ? { loading: true } : {})}
          style={{ width: "100%", marginBottom: "8px" }}
        >
          {moduleStatus ? "Изключи модула" : "Включи модула"}
        </s-button>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
