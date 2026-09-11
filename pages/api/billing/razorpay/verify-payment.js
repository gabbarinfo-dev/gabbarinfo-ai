// pages/api/billing/razorpay/verify-payment.js
/**
 * Razorpay Payment Verification & Instant Subscription Activation API
 * 
 * Verifies Razorpay HMAC SHA-256 signature.
 * Automatically activates 30-day subscription, resets quotas, and enables features.
 */

import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { getPlanConfig } from "../../../../lib/billing/plans";
import { resolveActiveBusiness } from "../../../../lib/auth/business-context";
import { supabaseServer } from "../../../../lib/supabaseServer";
import {
  updateTenantSubscription,
  setTenantMaxBusinesses,
  setTenantFeatures,
  getFeaturesForPlan,
} from "../../../../lib/services/tenant-service";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userEmail = session.user.email.toLowerCase().trim();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return res.status(400).json({
        error: "Missing required payment verification parameters (order_id, payment_id, signature, planId).",
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ error: "RAZORPAY_KEY_SECRET is not configured on server." });
    }

    // 1. Verify HMAC SHA-256 Signature
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("[Razorpay Verify] Signature mismatch:", {
        expected: expectedSignature,
        received: razorpay_signature,
      });
      return res.status(400).json({ error: "Payment verification failed: Signature mismatch." });
    }

    // 2. Authoritative Plan Lookup
    const plan = getPlanConfig(planId);
    if (!plan || plan.id !== planId.toLowerCase().trim()) {
      return res.status(400).json({ error: `Invalid plan specified: ${planId}` });
    }

    const now = new Date();
    const durationDays = 30;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // 3. Activate Subscription in Tenant Registry / Memory
    const subscription = await updateTenantSubscription(userEmail, {
      durationDays,
      status: "active",
      plan: plan.id,
      startDate: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    await setTenantMaxBusinesses(userEmail, plan.limits?.maxBusinesses || 1);

    // 4. Activate Entitled Services
    const defaultFeatures = getFeaturesForPlan(plan.id);
    const updatedFeatures = await setTenantFeatures(userEmail, defaultFeatures);

    // 5. Update Supabase Database
    let businessId = null;
    try {
      const bizContext = await resolveActiveBusiness(session);
      businessId = bizContext.businessId;
    } catch (_) {
      businessId = `biz_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
    }

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
    } catch (dbErr) {
      console.warn("[Razorpay Verify] Supabase subscription upsert note:", dbErr.message);
    }

    // 6. Record Completed Order
    try {
      await supabaseServer.from("subscription_orders").insert({
        user_email: userEmail,
        plan_id: plan.id,
        amount_inr: plan.priceINR,
        billing_cycle: "monthly",
        payment_reference: razorpay_payment_id,
        status: "completed",
        notes: `Razorpay Order ${razorpay_order_id} verified successfully`,
        created_at: now.toISOString(),
      });
    } catch (_) {}

    return res.status(200).json({
      ok: true,
      success: true,
      message: `🎉 Payment verified! ${plan.name} has been activated for 30 days.`,
      plan: {
        id: plan.id,
        name: plan.name,
        priceINR: plan.priceINR,
      },
      subscription,
      features: updatedFeatures,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[API/Razorpay/Verify-Payment] Error:", err);
    return res.status(500).json({
      error: err.message || "Failed to verify payment and activate subscription.",
    });
  }
}
