// pages/api/agent/final-confirmation.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const {
    platform,
    selected_business,
    campaign_summary,
    budget_per_day,
    total_days,
    user_confirmation,
  } = req.body;

  // HARD BLOCK — nothing proceeds without YES
  if (user_confirmation !== "YES") {
    return res.status(200).json({
      ok: false,
      locked: true,
      message:
        "Execution blocked. User did not provide final YES confirmation.",
    });
  }

  // Required validation
  if (
    !platform ||
    !selected_business ||
    !campaign_summary ||
    !budget_per_day ||
    !total_days
  ) {
    return res.status(400).json({
      ok: false,
      message: "Missing required confirmation details.",
    });
  }

  // ✅ FINAL GREEN SIGNAL
  return res.status(200).json({
    ok: true,
    executionApproved: true,
    approvedBy: session.user.email,
    approvedAt: new Date().toISOString(),
    summary: {
      platform,
      selected_business,
      budget_per_day,
      total_days,
      campaign_summary,
    },
  });
}
