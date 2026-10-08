// pages/api/linkedin/autopilot-config.js
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
        .eq("email", email)
        .eq("memory_type", "linkedin_autopilot_config")
        .maybeSingle();

      if (error) {
        return res.status(500).json({ ok: false, error: error.message });
      }

      let config = {
        enabled: false,
        targetUrn: "",
        frequency: "daily", // daily | 3_per_week | weekly
        topics: "B2B Growth, AI Automation, Tech Innovation, Scaling SaaS",
        tone: "thought_leadership",
        generateImage: true,
      };

      if (data?.content) {
        try {
          config = { ...config, ...JSON.parse(data.content) };
        } catch (_) {}
      }

      return res.status(200).json({ ok: true, config, updatedAt: data?.updated_at });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === "POST") {
    try {
      const { enabled, targetUrn, frequency, topics, tone, generateImage } = req.body || {};

      const payload = {
        enabled: Boolean(enabled),
        targetUrn: targetUrn || "",
        frequency: frequency || "daily",
        topics: topics || "B2B Growth, AI Automation, Tech Innovation",
        tone: tone || "thought_leadership",
        generateImage: generateImage !== false,
        lastConfiguredAt: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabaseServer.from("agent_memory").upsert(
        {
          email,
          memory_type: "linkedin_autopilot_config",
          content: JSON.stringify(payload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      if (upsertErr) {
        return res.status(500).json({ ok: false, error: upsertErr.message });
      }

      return res.status(200).json({ ok: true, message: "LinkedIn Auto-Pilot configuration saved successfully!" });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
