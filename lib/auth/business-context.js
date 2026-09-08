// lib/auth/business-context.js
/**
 * Universal Multi-Tenancy & Business Context Resolver for GabbarInfo AI
 *
 * Ensures all operations, wallets, and connections are strictly scoped to an isolated business_id.
 * Universal SaaS Guarantee: No hardcoded brand names for tenants. Each user gets their own
 * isolated business workspace. Super Admin (ndantare@gmail.com / owner) has platform-wide authority.
 */

import { supabaseServer } from "../supabaseServer.js";

function getDefaultBusinessName(session, userEmail) {
  if (userEmail === "ndantare@gmail.com") {
    return "Primary Business Workspace";
  }
  const cleanName = session?.user?.name?.trim();
  if (cleanName) {
    return `${cleanName}'s Business`;
  }
  const prefix = userEmail.split("@")[0];
  const capitalized = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  return `${capitalized}'s Business Workspace`;
}

/**
 * Resolves or auto-provisions the active business for a session.
 * @param {object} session - NextAuth session
 * @param {string|null} requestedBusinessId - Optional explicit business_id requested
 * @returns {Promise<{ businessId: string, businessName: string, role: string, tier: string, isSuperAdmin: boolean }>}
 */
export async function resolveActiveBusiness(session, requestedBusinessId = null) {
  if (!session?.user?.email) {
    throw new Error("Authentication required to resolve business context.");
  }

  const userEmail = session.user.email.toLowerCase().trim();
  const isSuperAdmin =
    userEmail === "ndantare@gmail.com" ||
    userEmail === process.env.OWNER_EMAIL?.toLowerCase() ||
    session.user.role === "owner";

  // Check if user account is suspended
  try {
    const { data: limitRow } = await supabaseServer
      .from("user_account_limits")
      .select("is_suspended")
      .eq("user_email", userEmail)
      .maybeSingle();

    if (limitRow?.is_suspended && !isSuperAdmin) {
      throw new Error("Your account has been suspended by the platform administrator.");
    }
  } catch (err) {
    if (err.message.includes("suspended")) throw err;
  }

  // 1. If Super Admin requested a specific business_id, allow direct context switch
  if (isSuperAdmin && requestedBusinessId) {
    try {
      const { data: biz } = await supabaseServer
        .from("businesses")
        .select("id, name, status, industry")
        .eq("id", requestedBusinessId)
        .maybeSingle();

      if (biz) {
        return {
          businessId: biz.id,
          businessName: biz.name,
          role: "owner",
          tier: "active",
          isSuperAdmin: true,
        };
      }
    } catch (_) {}
  }

  // 2. Lookup in native Postgres 'businesses' and 'business_members' tables
  try {
    const { data: members, error: memErr } = await supabaseServer
      .from("business_members")
      .select("business_id, role, businesses(id, name, status, industry)")
      .ilike("user_email", userEmail);

    if (!memErr && Array.isArray(members) && members.length > 0) {
      // Filter out suspended businesses unless Super Admin
      const activeMembers = isSuperAdmin
        ? members
        : members.filter((m) => m.businesses?.status !== "suspended");

      if (activeMembers.length === 0 && members.length > 0) {
        throw new Error("Your business workspace has been suspended. Please contact support.");
      }

      if (requestedBusinessId) {
        const found = members.find((m) => m.business_id === requestedBusinessId);
        if (!found && !isSuperAdmin) {
          throw new Error("Unauthorized: You do not have access to the requested business.");
        }
        if (found) {
          return {
            businessId: found.business_id,
            businessName: found.businesses?.name || getDefaultBusinessName(session, userEmail),
            role: found.role || "member",
            tier: "active",
            isSuperAdmin,
          };
        }
      }

      // Default to primary / first business
      const primary = activeMembers[0] || members[0];
      return {
        businessId: primary.business_id,
        businessName: primary.businesses?.name || getDefaultBusinessName(session, userEmail),
        role: primary.role || "owner",
        tier: "active",
        isSuperAdmin,
      };
    }
  } catch (err) {
    if (err.message.includes("suspended") || err.message.includes("Unauthorized")) {
      throw err;
    }
  }

  // 3. Hybrid Fallback / Auto-Provisioning for clean Universal SaaS onboarding:
  const memoryKey = "tenant_primary_business";
  try {
    const { data: memData } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", userEmail)
      .eq("memory_type", memoryKey)
      .maybeSingle();

    if (memData?.content) {
      const parsed = JSON.parse(memData.content);
      if (parsed.businessId) {
        return { ...parsed, isSuperAdmin };
      }
    }

    // Auto-provision initial personalized business workspace
    let detectedName = getDefaultBusinessName(session, userEmail);
    const { data: metaRow } = await supabaseServer
      .from("meta_connections")
      .select("business_name")
      .ilike("email", userEmail)
      .limit(1)
      .maybeSingle();

    if (metaRow?.business_name && metaRow.business_name.trim()) {
      detectedName = metaRow.business_name.trim();
    }

    const newBusinessId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newContext = {
      businessId: newBusinessId,
      businessName: detectedName,
      role: "owner",
      tier: "active",
      created_at: new Date().toISOString(),
      isSuperAdmin,
    };

    // Save in agent_memory for zero-breakage persistence
    await supabaseServer.from("agent_memory").upsert(
      {
        email: userEmail,
        memory_type: memoryKey,
        content: JSON.stringify(newContext),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    console.log(`[BusinessContext] Universal workspace provisioned for ${userEmail}: ${newBusinessId} (${detectedName})`);
    return newContext;
  } catch (provErr) {
    return {
      businessId: `biz_default_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
      businessName: getDefaultBusinessName(session, userEmail),
      role: "owner",
      tier: "active",
      isSuperAdmin,
    };
  }
}
