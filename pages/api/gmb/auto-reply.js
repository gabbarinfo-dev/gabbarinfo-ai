// pages/api/gmb/auto-reply.js
/**
 * GMB Review Auto-Reply Cron Endpoint
 *
 * Called by:
 * - Vercel Cron (vercel.json schedule)
 * - Railway scheduler
 * - Manual admin trigger via POST with admin secret
 *
 * Access control:
 * - Must provide Authorization: Bearer <INTERNAL_AGENT_SECRET>
 * - OR be the authenticated owner session
 *
 * Subscription gating is enforced INSIDE runGmbReviewAutopilot():
 * - Admin → always runs
 * - Paid plan with GMB_AUTOPILOT → runs
 * - Trial/Free → skipped per user
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { runGmbReviewAutopilot } from "../../../lib/gmb/review-autopilot";

const INTERNAL_SECRET = process.env.INTERNAL_AGENT_SECRET;
const OWNER_EMAIL     = (process.env.OWNER_EMAIL || "ndantare@gmail.com").toLowerCase();

export default async function handler(req, res) {
  // ── Auth: internal secret (cron) OR owner session (manual trigger) ────────
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.replace("Bearer ", "").trim();
  const isInternalCron = bearerToken === INTERNAL_SECRET;

  if (!isInternalCron) {
    const session = await getServerSession(req, res, authOptions);
    const email   = (session?.user?.email || "").toLowerCase();
    if (email !== OWNER_EMAIL) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }
  }

  // ── Only allow GET (cron) or POST (manual) ────────────────────────────────
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  console.log(`[GMB AutoReply] 🤖 Starting review auto-reply run at ${new Date().toISOString()}`);

  try {
    const result = await runGmbReviewAutopilot();

    console.log(`[GMB AutoReply] ✅ Finished. Replies posted: ${result.processed}`);

    return res.status(200).json({
      ok:        true,
      message:   `Auto-reply run complete. ${result.processed} review(s) replied.`,
      started:   result.started,
      finished:  result.finished,
      processed: result.processed,
      errors:    result.errors,
      // Full log only shown in non-production or if explicitly requested
      log: process.env.NODE_ENV !== "production" || req.query.debug === "1"
        ? result.log
        : undefined,
    });
  } catch (err) {
    console.error("[GMB AutoReply] ❌ Fatal error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
