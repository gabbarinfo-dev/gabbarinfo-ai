// pages/api/gmb/disconnect.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const userEmail = session.user.email.toLowerCase().trim();
    const isOwner = userEmail === "ndantare@gmail.com" || session.user.role === "owner";
    const targetEmail = (isOwner && req.body?.targetEmail) ? req.body.targetEmail.toLowerCase().trim() : userEmail;

    // 1. Remove active selected GMB location from agent_memory
    await supabaseServer
      .from("agent_memory")
      .delete()
      .eq("email", targetEmail)
      .eq("memory_type", "selected_gmb_location");

    // 2. Remove any asset claims for GMB for this user so trial/quota is released
    try {
      await supabaseServer
        .from("asset_claims")
        .delete()
        .eq("user_email", targetEmail)
        .eq("asset_type", "gmb_location");
    } catch (_) {}

    return res.status(200).json({
      ok: true,
      message: `Google Business Profile disconnected successfully for ${targetEmail}.`,
    });
  } catch (err) {
    console.error("[GMB Disconnect Error]:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
