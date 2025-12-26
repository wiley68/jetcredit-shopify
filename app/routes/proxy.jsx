// app/routes/proxy.jsx
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  // validates app proxy signature + shop
  await authenticate.public.appProxy(request);

  // return anything - JSON is easiest for now
  return Response.json({ ok: true, from: "jetcredit proxy" });
};
