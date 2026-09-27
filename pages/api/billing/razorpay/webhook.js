// pages/api/billing/razorpay/webhook.js
/**
 * Razorpay Webhook Handler
 * 
 * Provides 100% autonomous fallback activation for subscriptions.
 * If user closes browser or network drops before frontend verification,
 * this webhook catches 'payment.captured' or 'order.paid' and activates
 * the user's subscription and entitlements instantly.
 */

import crypto from "crypto";
import { getPlanConfig } from "../../../../lib/billing/plans";
import { supabaseServer } from "../../../../lib/supabaseServer";
import {
  updateTenantSubscription,
  setTenantMaxBusinesses,
  setTenantFeatures,
  getFeaturesForPlan,
} from "../../../../lib/services/tenant-service";

export const config = {
  api: {
    bodyParser: false, // Need raw body for HMAC signature verification
  },
};

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rawBodyBuffer = await getRawBody(req);
    const rawBody = rawBodyBuffer.toString("utf8");
    const signature = req.headers["x-razorpay-signature"];

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!webhookSecret) {
      console.warn("[Razorpay Webhook] Missing RAZORPAY_WEBHOOK_SECRET or RAZORPAY_KEY_SECRET");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("[Razorpay Webhook] Signature mismatch");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    console.log(`[Razorpay Webhook] Received verified event: ${event}`);

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload.payload?.payment?.entity || {};
      const orderEntity = payload.payload?.order?.entity || {};
      const notes = { ...(orderEntity.notes || {}), ...(paymentEntity.notes || {}) };

      const userEmail = (notes.user_email || paymentEntity.email || "").toLowerCase().trim();
      const planId = (notes.plan_id || "").toLowerCase().trim();
      const businessId = notes.business_id || `biz_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const paymentId = paymentEntity.id || payload.payload?.payment?.entity?.id || `rzp_${Date.now()}`;
      const orderId = orderEntity.id || paymentEntity.order_id || "";

      if (userEmail && planId) {
        const plan = getPlanConfig(planId);
        if (plan) {
          const now = new Date();
          const durationDays = 30;
          const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

          // 1. Update Tenant Subscription
          await updateTenantSubscription(userEmail, {
            durationDays,
            status: "active",
            plan: plan.id,
            startDate: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
          });

          await setTenantMaxBusinesses(userEmail, plan.limits?.maxBusinesses || 1);

          // 2. Set Entitled Features
          const defaultFeatures = getFeaturesForPlan(plan.id);
          await setTenantFeatures(userEmail, defaultFeatures);

          // 3. Update Supabase Subscriptions table
          try {
            await supabaseServer.from("subscriptions").upsert({
              business_id: businessId,
              plan_id: plan.id,
              status: "active",
              cycle_start: now.toISOString(),
              cycle_end: expiresAt.toISOString(),
              current_period_end: expiresAt.toISOString(),
              updated_at: now.toISOString(),
            }, { onConflict: "business_id" });
          } catch (_) {}

          // 4. Record Completed Order
          try {
            await supabaseServer.from("subscription_orders").insert({
              user_email: userEmail,
              plan_id: plan.id,
              amount_inr: plan.priceINR,
              billing_cycle: "monthly",
              payment_reference: paymentId,
              status: "completed",
              notes: `Razorpay Webhook: ${event} for Order ${orderId}`,
              created_at: now.toISOString(),
            });
          } catch (_) {}

          console.log(`[Razorpay Webhook] Successfully auto-activated ${plan.name} for ${userEmail}`);
        }
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("[Razorpay Webhook] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
