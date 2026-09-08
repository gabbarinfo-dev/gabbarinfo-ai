// pages/api/admin/manage-tenant.js
/**
 * Super Admin Master Tenant & Entitlement Management API
 *
 * Exclusively accessible by Platform Owner (ndantare@gmail.com / role === 'owner').
 * Enables real-time credit allocation, persistent service switch toggling, business limits,
 * 30-day subscription validity management, and emergency suspension.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";
import { adminAdjustCredits } from "../../../lib/billing/credit-meter";
import { SUBSCRIPTION_PLANS } from "../../../lib/billing/plans";
import {
  getTenantRegistry,
  getOrCreateTenantConfig,
  setTenantFeature,
  setTenantSuspension,
  setTenantMaxBusinesses,
  updateTenantSubscription,
  ALL_SERVICES,
  ALL_SERVICE_KEYS,
} from "../../../lib/services/tenant-service";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const userEmail = session?.user?.email?.toLowerCase().trim();
    const isSuperAdmin =
      userEmail === "ndantare@gmail.com" ||
      userEmail === process.env.OWNER_EMAIL?.toLowerCase() ||
      session?.user?.role === "owner";

    if (!session || !isSuperAdmin) {
      return res.status(403).json({ error: "Forbidden: Super Admin authority required." });
    }

    const { action } = req.method === "POST" ? req.body : req.query;

    // -------------------------------------------------------------
    // 1. LIST ALL TENANTS & PERSISTENT STATUS
    // -------------------------------------------------------------
    if (action === "list_tenants" || req.method === "GET") {
      // 1. Fetch allowed users from Supabase
      const { data: users, error: userErr } = await supabaseServer
        .from("allowed_users")
        .select("email, role")
        .order("email");

      // 2. Fetch credits
      const { data: creditsRows } = await supabaseServer
        .from("credits")
        .select("email, credits_left");

      const creditMap = {};
      (creditsRows || []).forEach((c) => {
        if (c.email) creditMap[c.email.toLowerCase()] = c.credits_left;
      });

      // 3. Fetch persistent registry from Supabase
      const registry = await getTenantRegistry();

      const tenants = (users || []).map((u) => {
        const emailNorm = u.email.toLowerCase().trim();
        const config = getOrCreateTenantConfig(registry, emailNorm);

        const isSelfAdmin = emailNorm === "ndantare@gmail.com";
        const features = Array.isArray(config.features) ? config.features : [...ALL_SERVICE_KEYS];

        return {
          email: u.email,
          role: isSelfAdmin ? "owner" : (u.role || "client"),
          credits: creditMap[emailNorm] ?? 1000,
          isSuspended: Boolean(config.isSuspended),
          maxBusinesses: config.maxBusinesses || 1,
          subscription: config.subscription || {
            status: "active",
            plan: "pro_30d",
            startDate: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            durationDays: 30,
          },
          businesses: [
            {
              id: `biz_${emailNorm.replace(/[^a-zA-Z0-9]/g, "_")}`,
              name: `${emailNorm.split("@")[0]}'s Workspace`,
              status: config.isSuspended ? "suspended" : "active",
              role: u.role,
              features: features,
              subStatus: config.subscription?.status || "active",
            },
          ],
        };
      });

      return res.status(200).json({ success: true, tenants });
    }

    // -------------------------------------------------------------
    // 2. UPDATE CREDITS
    // -------------------------------------------------------------
    if (action === "update_credits") {
      const { userEmail: targetEmail, businessId, mode, amount } = req.body;
      if (!targetEmail) {
        return res.status(400).json({ error: "targetEmail is required" });
      }

      const result = await adminAdjustCredits({
        userEmail: targetEmail,
        businessId,
        mode: mode || "add",
        amount: Number(amount) || 0,
      });

      return res.status(200).json({ success: true, newBalance: result.newBalance });
    }

    // -------------------------------------------------------------
    // 3. TOGGLE SERVICE (DURABLE & ATOMIC)
    // -------------------------------------------------------------
    if (action === "toggle_service") {
      const { userEmail: targetEmail, serviceKey, enabled } = req.body;
      if (!targetEmail || !serviceKey) {
        return res.status(400).json({ error: "userEmail and serviceKey are required" });
      }

      const updatedFeatures = await setTenantFeature(targetEmail, serviceKey, enabled);

      return res.status(200).json({
        success: true,
        userEmail: targetEmail,
        serviceKey,
        features: updatedFeatures,
      });
    }

    // -------------------------------------------------------------
    // 4. SET BUSINESS LIMIT
    // -------------------------------------------------------------
    if (action === "set_business_limit") {
      const { userEmail: targetEmail, maxBusinesses } = req.body;
      if (!targetEmail) {
        return res.status(400).json({ error: "userEmail is required" });
      }

      const newLimit = await setTenantMaxBusinesses(targetEmail, maxBusinesses);
      return res.status(200).json({ success: true, maxBusinesses: newLimit });
    }

    // -------------------------------------------------------------
    // 5. SET SUSPENSION / EMERGENCY FREEZE
    // -------------------------------------------------------------
    if (action === "set_suspension") {
      const { userEmail: targetEmail, isSuspended } = req.body;
      if (!targetEmail) {
        return res.status(400).json({ error: "userEmail is required" });
      }

      const newSuspension = await setTenantSuspension(targetEmail, isSuspended);
      return res.status(200).json({ success: true, isSuspended: newSuspension });
    }

    // -------------------------------------------------------------
    // 6. EXTEND OR ACTIVATE 30-DAY SUBSCRIPTION (PAYMENT HOOK)
    // -------------------------------------------------------------
    if (action === "activate_subscription") {
      const { userEmail: targetEmail, durationDays = 30, plan = "pro_30d" } = req.body;
      if (!targetEmail) {
        return res.status(400).json({ error: "userEmail is required" });
      }

      const subscription = await updateTenantSubscription(targetEmail, {
        durationDays: Number(durationDays) || 30,
        status: "active",
        plan,
      });

      return res.status(200).json({ success: true, subscription });
    }

    // -------------------------------------------------------------
    // 7. ASSIGN PRODUCTION SUBSCRIPTION PLAN (TRY, STARTER, GROWTH, BUSINESS, AGENCY)
    // -------------------------------------------------------------
    if (action === "assign_plan") {
      const { userEmail: targetEmail, planId = "starter", durationDays = 30 } = req.body;
      if (!targetEmail) {
        return res.status(400).json({ error: "userEmail is required" });
      }

      const planKey = (planId || "starter").toUpperCase();
      const plan = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.STARTER;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000);

      const subscription = await updateTenantSubscription(targetEmail, {
        durationDays: Number(durationDays) || 30,
        status: "active",
        plan: plan.id,
        startDate: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

      await setTenantMaxBusinesses(targetEmail, plan.maxBusinesses);

      try {
        const normEmail = targetEmail.toLowerCase().trim();
        const bizId = `biz_${normEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
        await supabaseServer.from("subscriptions").upsert({
          business_id: bizId,
          plan_id: plan.id,
          status: "active",
          cycle_start: now.toISOString(),
          cycle_end: expiresAt.toISOString(),
          current_period_end: expiresAt.toISOString(),
          updated_at: now.toISOString(),
        }, { onConflict: "business_id" });
      } catch (dbErr) {
        console.warn("Supabase subscriptions sync note:", dbErr.message);
      }

      return res.status(200).json({
        success: true,
        message: `Plan ${plan.name} (${plan.priceMonthly}) successfully assigned to ${targetEmail}`,
        plan: plan.id,
        subscription,
      });
    }

    // -------------------------------------------------------------
    // 8. LIST PENDING SUBSCRIPTION ORDERS
    // -------------------------------------------------------------
    if (action === "list_orders") {
      const { data: orders, error: orderErr } = await supabaseServer
        .from("subscription_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (orderErr) {
        return res.status(500).json({ error: "Failed to fetch orders: " + orderErr.message });
      }

      return res.status(200).json({ success: true, orders: orders || [] });
    }

    // -------------------------------------------------------------
    // 9. VERIFY / APPROVE SUBSCRIPTION ORDER
    // -------------------------------------------------------------
    if (action === "verify_order") {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "orderId is required" });
      }

      const { data: order, error: fetchErr } = await supabaseServer
        .from("subscription_orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (fetchErr || !order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const planKey = (order.plan_id || "starter").toUpperCase();
      const plan = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.STARTER;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 1. Mark order verified
      await supabaseServer
        .from("subscription_orders")
        .update({
          status: "verified",
          verified_at: now.toISOString(),
          verified_by: userEmail,
        })
        .eq("id", orderId);

      // 2. Activate subscription
      await supabaseServer.from("subscriptions").upsert({
        business_id: order.business_id,
        plan_id: plan.id,
        status: "active",
        cycle_start: now.toISOString(),
        cycle_end: expiresAt.toISOString(),
        current_period_end: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: "business_id" });

      // 3. Update tenant config
      await updateTenantSubscription(order.user_email, {
        durationDays: 30,
        status: "active",
        plan: plan.id,
        startDate: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
      await setTenantMaxBusinesses(order.user_email, plan.maxBusinesses);

      return res.status(200).json({
        success: true,
        message: `Order ${orderId} verified and Plan ${plan.name} activated for ${order.user_email}.`,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("Super Admin manage-tenant API error:", err);
    return res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
}
