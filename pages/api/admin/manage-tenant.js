// pages/api/admin/manage-tenant.js
/**
 * Super Admin Master Tenant & Entitlement Management API
 *
 * Exclusively accessible by Platform Owner (ndantare@gmail.com / role === 'owner').
 * Enables real-time credit allocation, service switch toggling, business limits,
 * and emergency tenant/account suspension.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";
import { adminAdjustCredits } from "../../../lib/billing/credit-meter";
import { ALL_FEATURES } from "../../../lib/auth/entitlements";

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
    // 1. LIST ALL TENANTS & STATUS
    // -------------------------------------------------------------
    if (action === "list_tenants" || req.method === "GET") {
      // Fetch allowed users
      const { data: users, error: userErr } = await supabaseServer
        .from("allowed_users")
        .select("email, role")
        .order("email");

      // Fetch credits table
      const { data: creditsRows } = await supabaseServer
        .from("credits")
        .select("email, credits_left");

      const creditMap = {};
      (creditsRows || []).forEach((c) => {
        if (c.email) creditMap[c.email.toLowerCase()] = c.credits_left;
      });

      // Fetch user account limits & suspensions
      let accountLimitsMap = {};
      try {
        const { data: limits } = await supabaseServer
          .from("user_account_limits")
          .select("user_email, max_businesses, is_suspended, notes");
        (limits || []).forEach((l) => {
          if (l.user_email) accountLimitsMap[l.user_email.toLowerCase()] = l;
        });
      } catch (_) {}

      // Fetch businesses & memberships if available
      let businessesByEmail = {};
      try {
        const { data: members } = await supabaseServer
          .from("business_members")
          .select("user_email, role, business_id, businesses(id, name, status, industry)");

        const { data: subs } = await supabaseServer
          .from("subscriptions")
          .select("business_id, status, features, tier");

        const subMap = {};
        (subs || []).forEach((s) => {
          subMap[s.business_id] = s;
        });

        (members || []).forEach((m) => {
          const em = m.user_email?.toLowerCase();
          if (!em) return;
          if (!businessesByEmail[em]) businessesByEmail[em] = [];

          const sub = subMap[m.business_id];
          businessesByEmail[em].push({
            id: m.business_id,
            name: m.businesses?.name || "Business Workspace",
            status: m.businesses?.status || "active",
            role: m.role,
            features: Array.isArray(sub?.features) ? sub.features : ALL_FEATURES,
            subStatus: sub?.status || "active",
          });
        });
      } catch (_) {}

      const tenants = (users || []).map((u) => {
        const emailNorm = u.email.toLowerCase();
        const limits = accountLimitsMap[emailNorm] || { max_businesses: 1, is_suspended: false };
        const bizList = businessesByEmail[emailNorm] || [
          {
            id: `biz_default_${emailNorm.replace(/[^a-zA-Z0-9]/g, "_")}`,
            name: `${emailNorm.split("@")[0]}'s Workspace`,
            status: "active",
            role: u.role,
            features: ALL_FEATURES,
            subStatus: "active",
          },
        ];

        return {
          email: u.email,
          role: u.role,
          credits: creditMap[emailNorm] ?? 1000,
          isSuspended: limits.is_suspended || false,
          maxBusinesses: limits.max_businesses || 1,
          businesses: bizList,
        };
      });

      return res.status(200).json({ success: true, tenants });
    }

    // -------------------------------------------------------------
    // 2. UPDATE CREDITS (Topup, set balance, grant unlimited)
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
    // 3. TOGGLE SERVICE (SEO, Social, Meta Ads, Google Ads, etc.)
    // -------------------------------------------------------------
    if (action === "toggle_service") {
      const { businessId, serviceKey, enabled } = req.body;
      if (!businessId || !serviceKey) {
        return res.status(400).json({ error: "businessId and serviceKey are required" });
      }

      // Read current features
      const { data: currentSub } = await supabaseServer
        .from("subscriptions")
        .select("features")
        .eq("business_id", businessId)
        .maybeSingle();

      let currentFeatures = Array.isArray(currentSub?.features)
        ? [...currentSub.features]
        : [...ALL_FEATURES];

      if (enabled) {
        if (!currentFeatures.includes(serviceKey)) currentFeatures.push(serviceKey);
      } else {
        currentFeatures = currentFeatures.filter((f) => f !== serviceKey);
      }

      await supabaseServer.from("subscriptions").upsert(
        {
          business_id: businessId,
          features: currentFeatures,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

      return res.status(200).json({ success: true, features: currentFeatures });
    }

    // -------------------------------------------------------------
    // 4. SET BUSINESS LIMIT (Max allowed businesses for agencies)
    // -------------------------------------------------------------
    if (action === "set_business_limit") {
      const { userEmail: targetEmail, maxBusinesses } = req.body;
      if (!targetEmail) {
        return res.status(400).json({ error: "targetEmail is required" });
      }

      const parsedLimit = Math.max(1, Number(maxBusinesses) || 1);

      await supabaseServer.from("user_account_limits").upsert(
        {
          user_email: targetEmail.toLowerCase().trim(),
          max_businesses: parsedLimit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_email" }
      );

      return res.status(200).json({ success: true, maxBusinesses: parsedLimit });
    }

    // -------------------------------------------------------------
    // 5. EMERGENCY KILL SWITCH / SUSPENSION
    // -------------------------------------------------------------
    if (action === "set_suspension") {
      const { userEmail: targetEmail, businessId, isSuspended } = req.body;

      if (targetEmail) {
        await supabaseServer.from("user_account_limits").upsert(
          {
            user_email: targetEmail.toLowerCase().trim(),
            is_suspended: Boolean(isSuspended),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_email" }
        );
      }

      if (businessId) {
        await supabaseServer
          .from("businesses")
          .update({
            status: isSuspended ? "suspended" : "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", businessId);

        await supabaseServer
          .from("subscriptions")
          .update({
            status: isSuspended ? "suspended" : "active",
            updated_at: new Date().toISOString(),
          })
          .eq("business_id", businessId);
      }

      return res.status(200).json({ success: true, isSuspended: Boolean(isSuspended) });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("[ManageTenantAPI] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
