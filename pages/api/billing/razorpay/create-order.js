// pages/api/billing/razorpay/create-order.js
/**
 * Razorpay Order Creation API
 * 
 * Securely creates a Razorpay order based on the authoritative plan configuration.
 * Never trusts client amounts.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { getPlanConfig } from "../../../../lib/billing/plans";
import { resolveActiveBusiness } from "../../../../lib/auth/business-context";
import Razorpay from "razorpay";

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
    const { planId } = req.body || {};

    if (!planId) {
      return res.status(400).json({ error: "planId is required" });
    }

    // Authoritative plan lookup
    const plan = getPlanConfig(planId);
    if (!plan || plan.id !== planId.toLowerCase().trim() || plan.priceINR <= 0) {
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

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({
        error: "Razorpay payment gateway keys are not configured on the server.",
      });
    }

    const rzp = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Razorpay amounts are in the smallest currency sub-unit (paise for INR, 1 INR = 100 paise)
    const amountInPaise = Math.round(plan.priceINR * 100);

    // Order receipt ID (max 40 chars)
    const receipt = `rcpt_${Date.now().toString(36)}_${plan.id.slice(0, 10)}`;

    const orderOptions = {
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        user_email: userEmail,
        plan_id: plan.id,
        plan_name: plan.name,
        business_id: businessId || "",
      },
    };

    const order = await rzp.orders.create(orderOptions);

    return res.status(200).json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      plan: {
        id: plan.id,
        name: plan.name,
        priceINR: plan.priceINR,
      },
      customer: {
        name: session.user.name || "Customer",
        email: userEmail,
      },
    });
  } catch (err) {
    console.error("[API/Razorpay/Create-Order] Error:", err);
    return res.status(500).json({
      error: err.message || "Failed to create Razorpay order.",
    });
  }
}
