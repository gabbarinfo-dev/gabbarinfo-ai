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

  return res.json({
    connected: !!metaRes.data || connectedBrands.length > 0,
    meta: metaRes.data || Object.values(allMetaConnections)[0] || null,
    allMetaConnections,
    connectedBrands,
  });
}
