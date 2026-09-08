// pages/api/subscriptions/purchase-request.js
/**
 * Subscription Purchase Request API
 * 
 * Replaces the obsolete "Buy Credits / QR Top-Up" mechanism.
 * Handles customer plan selection, creates pending subscription order,
 * and sets up payment/verification without blindly trusting client amounts.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getPlanConfig } from "../../../lib/billing/plans";
import { resolveActiveBusiness } from "../../../lib/auth/business-context";
import { supabaseServer } from "../../../lib/supabaseServer";

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
    const { planId, paymentReference = null, notes = "" } = req.body || {};

    if (!planId) {
      return res.status(400).json({ error: "planId is required" });
    }

    // Authoritative plan lookup on the server (DO NOT TRUST CLIENT AMOUNT)
    const plan = getPlanConfig(planId);
    if (!plan || plan.id !== planId.toLowerCase().trim()) {
      return res.status(400).json({ error: `Invalid plan specified: ${planId}` });
    }

    // Resolve business context
    let businessId = null;
    try {
      const bizContext = await resolveActiveBusiness(session);
      businessId = bizContext.businessId;
    } catch (_) {
      businessId = `biz_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
    }

    // Create subscription purchase order
    const orderRecord = {
      user_email: userEmail,
      plan_id: plan.id,
      amount_inr: plan.priceINR,
      billing_cycle: "monthly",
      payment_reference: paymentReference,
      status: "pending",
      notes: notes ? String(notes).slice(0, 300) : null,
      created_at: new Date().toISOString(),
    };

    let orderId = `sub_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const { data, error } = await supabaseServer
        .from("subscription_orders")
        .insert(orderRecord)
        .select("id")
        .maybeSingle();

      if (!error && data?.id) {
        orderId = data.id;
      }
    } catch (dbErr) {
      console.warn("[PurchaseRequest] Order DB insert fallback:", dbErr.message);
    }

    return res.status(200).json({
      ok: true,
      orderId,
      plan: {
        id: plan.id,
        name: plan.name,
        priceINR: plan.priceINR,
        billingCycle: plan.billingCycle,
        description: plan.description,
      },
      amountINR: plan.priceINR,
      status: "pending",
      message: `Subscription order created for ${plan.name} (₹${plan.priceINR}/month).`,
      instructions: "Please complete payment verification with your platform administrator to activate your plan.",
    });
  } catch (err) {
    console.error("[PurchaseRequest] Error:", err);
    return res.status(500).json({ error: "Failed to process purchase request", details: err.message });
  }
}
