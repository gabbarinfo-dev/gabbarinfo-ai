import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.query?.userEmail;

  if (!userEmail) {
    return res.json({ connected: false });
  }

  const [metaRes, brandMemRes] = await Promise.all([
    supabaseServer
      .from("meta_connections")
      .select("*")
      .eq("email", userEmail)
      .maybeSingle(),
    supabaseServer
      .from("agent_memory")
      .select("memory_type, content, updated_at")
      .eq("email", userEmail)
      .like("memory_type", "meta_conn_%"),
  ]);

  const allMetaConnections = {};
  (brandMemRes.data || []).forEach((m) => {
    try {
      const parsed = JSON.parse(m.content);
      const bKey = m.memory_type.replace("meta_conn_", "");
      allMetaConnections[bKey] = parsed;
    } catch (_) {}
  });

  const connectedBrands = Object.keys(allMetaConnections);

  const targetSiteUrl = (req.query?.siteUrl || "").toLowerCase().trim();
  const targetBiz = (req.query?.businessName || "").toLowerCase().trim();
  const targetShop = (req.query?.shop || "").toLowerCase().trim();

  let matchedBrand = null;
  const isTargeted = Boolean(targetSiteUrl || targetBiz || targetShop);

  if (isTargeted) {
    const cleanSite = targetSiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const cleanShop = targetShop.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const normBiz = targetBiz.replace(/[^a-z0-9]/g, "");

    for (const key of Object.keys(allMetaConnections)) {
      const b = allMetaConnections[key];
      const bUrl = (b.websiteUrl || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      const bName = (b.businessName || b.pageName || key || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      // 1. URL match
      if (cleanSite && bUrl && (cleanSite === bUrl || cleanSite.includes(bUrl) || bUrl.includes(cleanSite))) {
        matchedBrand = b;
        break;
      }
      if (cleanShop && bUrl && (cleanShop === bUrl || cleanShop.includes(bUrl) || bUrl.includes(cleanShop))) {
        matchedBrand = b;
        break;
      }
      // 2. Name match (min 3 chars)
      if (normBiz && normBiz.length >= 3 && bName && bName.length >= 3) {
        if (normBiz === bName || normBiz.includes(bName) || bName.includes(normBiz)) {
          matchedBrand = b;
          break;
        }
      }
    }
  }

  return res.json({
    connected: !!metaRes.data || connectedBrands.length > 0,
    meta: metaRes.data || Object.values(allMetaConnections)[0] || null,
    brandMeta: isTargeted ? matchedBrand : (metaRes.data || Object.values(allMetaConnections)[0] || null),
    allMetaConnections,
    connectedBrands,
  });
}
