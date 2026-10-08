// pages/api/linkedin/brand-intel.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseServer
        .from("agent_memory")
        .select("content, updated_at")
        .eq("email", email.toLowerCase())
        .eq("memory_type", "linkedin_brand_intel")
        .maybeSingle();

      if (error) {
        return res.status(500).json({ ok: false, error: error.message });
      }

      if (!data?.content) {
        return res.status(200).json({ ok: true, hasIntel: false });
      }

      const intelligence = JSON.parse(data.content);
      return res.status(200).json({
        ok: true,
        hasIntel: true,
        intelligence,
        updatedAt: data.updated_at,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === "PUT") {
    // Allows updating/reordering/marking topics as published or adding custom topics
    try {
      const { topicsQueue, services } = req.body || {};

      const { data: existingRow } = await supabaseServer
        .from("agent_memory")
        .select("content")
        .eq("email", email.toLowerCase())
        .eq("memory_type", "linkedin_brand_intel")
        .maybeSingle();

      if (!existingRow?.content) {
        return res.status(400).json({ ok: false, error: "No brand intelligence found to update." });
      }

      let parsed = JSON.parse(existingRow.content);
      if (Array.isArray(topicsQueue)) parsed.topicsQueue = topicsQueue;
      if (Array.isArray(services)) parsed.services = services;

      await supabaseServer.from("agent_memory").upsert(
        {
          email: email.toLowerCase(),
          memory_type: "linkedin_brand_intel",
          content: JSON.stringify(parsed),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      return res.status(200).json({ ok: true, intelligence: parsed });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
