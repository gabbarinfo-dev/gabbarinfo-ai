// lib/gmb/review-autopilot.js
/**
 * GMB Review Auto-Reply Engine
 *
 * Rules:
 * - Admin (ndantare@gmail.com) → always runs, all locations
 * - Paid subscriber with GMB_AUTOPILOT feature → runs for their selected GMB location(s)
 * - Trial / Free / No plan → SKIPPED entirely
 * - Location limit per plan: suite_1 → 1 location, suite_2+ → up to maxGmbLocations
 */

import { supabaseServer } from "../supabaseServer.js";
import {
  getGmbAccessToken,
  listGmbAccounts,
  listGmbLocations,
  listGmbReviews,
  replyToGmbReview,
} from "../gmbHelper.js";
import { getBusinessSubscriptionState } from "../billing/quota-service.js";


const ADMIN_EMAIL = "ndantare@gmail.com";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "").toLowerCase();
const GMB_BASE    = "https://mybusiness.googleapis.com/v4";

// Plans that include GMB_AUTOPILOT feature
const AUTOPILOT_PLAN_IDS = [
  "suite_1", "suite_2", "suite_3",
  "agency", "agency_plus",
  "gmb", "gmb_pro",
];

// ─── Generate professional reply via Gemini ────────────────────────────────
async function generateGmbReply({ businessName, reviewerName, rating, comment }) {
  const firstName = (reviewerName || "").trim().split(" ")[0] || "";
  const ratingNum = typeof rating === "string"
    ? { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[rating] || 5
    : rating;

  const tone = ratingNum >= 4 ? "warm and appreciative" : "empathetic and solution-oriented";
  const prompt = `You are the professional owner of "${businessName}" replying to a Google Business review.
Reviewer: ${reviewerName || "a valued customer"}
Star Rating: ${ratingNum}/5
Review: "${comment || "(Left a star rating without written feedback)"}"

Write a ${tone} reply in 2-3 complete sentences.
Rules:
- Address them by first name "${firstName}" if available
- Acknowledge their specific feedback
- No emojis, no "Dear", not generic
- End with a warm invite to return or a professional sign-off
- Output ONLY the reply text — complete sentences, ending with punctuation

Reply:`;

  const key   = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "models/gemini-2.5-flash";

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.65, maxOutputTokens: 400 },
          }),
        }
      );
      const json = await resp.json();
      const text         = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      const finishReason = json.candidates?.[0]?.finishReason;

      if (text && finishReason === "STOP") return text;
    } catch (_) {}

    // Back-off before retry
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }

  // Fallback — safe generic reply
  return `Thank you${firstName ? ", " + firstName : ""}! We truly appreciate your ${ratingNum >= 4 ? "kind words and support" : "feedback"}. We look forward to serving you again soon.`;
}

// ─── Process one user's GMB locations ─────────────────────────────────────
async function processUserReviews({ email, refreshToken, subState, log }) {
  const isAdmin     = email === ADMIN_EMAIL || email === OWNER_EMAIL;
  const plan        = subState?.plan || {};
  const maxLocations = isAdmin
    ? Infinity
    : (plan.limits?.maxGmbLocations || 1);

  // Exchange refresh token for a fresh access token
  const tokenResult = await getGmbAccessToken({ refreshToken });
  if (!tokenResult.ok) {
    log.push({ email, error: "Token exchange failed: " + tokenResult.error });
    return;
  }
  const { accessToken } = tokenResult;

  // Get their selected GMB location from agent_memory (the one they have active)
  const { data: memRow } = await supabaseServer
    .from("agent_memory")
    .select("content")
    .eq("email", email)
    .eq("memory_type", "selected_gmb_location")
    .maybeSingle();

  let selectedLocations = [];

  if (memRow?.content) {
    try {
      const loc = JSON.parse(memRow.content);
      if (loc?.name) selectedLocations.push(loc);
    } catch (_) {}
  }

  // If no saved selection, discover from API
  if (!selectedLocations.length) {
    const accountsRes = await listGmbAccounts({ accessToken });
    if (!accountsRes.ok || !accountsRes.accounts?.length) {
      log.push({ email, error: "No GMB accounts found" });
      return;
    }
    for (const acc of accountsRes.accounts) {
      const locsRes = await listGmbLocations({ accessToken, accountName: acc.name });
      if (locsRes.ok && locsRes.locations?.length) {
        selectedLocations.push(...locsRes.locations.map(l => ({ ...l, _accountName: acc.name })));
      }
    }
  }

  // Enforce location limit based on plan
  const locationsToProcess = selectedLocations.slice(0, maxLocations);
  log.push({ email, locationsFound: selectedLocations.length, locationsProcessing: locationsToProcess.length });

  for (const loc of locationsToProcess) {
    const locationName = loc.name; // e.g. "accounts/xxx/locations/yyy" OR "locations/yyy"
    const businessName = loc.title || loc.locationName || "the business";

    // Fetch unreplied reviews
    const revRes = await listGmbReviews({ accessToken, locationName, pageSize: 20 });
    if (!revRes.ok) {
      log.push({ email, location: businessName, error: revRes.error });
      continue;
    }

    const unreplied = (revRes.reviews || []).filter(r => !r.reviewReply?.comment);
    log.push({ email, location: businessName, unrepliedCount: unreplied.length });

    for (const review of unreplied) {
      const reviewerName = review.reviewer?.displayName || "";
      const comment      = review.comment || "";
      const rating       = review.starRating || "FIVE";

      // Generate reply
      const replyText = await generateGmbReply({ businessName, reviewerName, rating, comment });

      // Post reply
      const replyRes = await replyToGmbReview({
        accessToken,
        reviewName: review.name,
        replyText,
      });

      log.push({
        email,
        location: businessName,
        reviewer: reviewerName,
        rating,
        replied: replyRes.ok,
        reply: replyRes.ok ? replyText.slice(0, 80) + "..." : replyRes.error,
      });

      // Rate limit: 500ms between replies
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// ─── MAIN ENTRY — runs for all eligible users ─────────────────────────────
export async function runGmbReviewAutopilot() {
  const log     = [];
  const errors  = [];
  const started = new Date().toISOString();

  try {
    // 1. Get all users who have a google_connection (i.e. connected Google/GMB)
    const { data: connections, error: connErr } = await supabaseServer
      .from("google_connections")
      .select("email, refresh_token")
      .not("refresh_token", "is", null);

    if (connErr || !connections?.length) {
      return { ok: false, error: "No Google connections found", log };
    }

    log.push({ step: "start", totalConnections: connections.length, started });

    for (const conn of connections) {
      const email        = (conn.email || "").toLowerCase().trim();
      const refreshToken = conn.refresh_token;
      if (!refreshToken) continue;

      const isAdmin = email === ADMIN_EMAIL || email === OWNER_EMAIL;

      // 2. Check subscription — skip trial/free users
      if (!isAdmin) {
        const bizId   = `biz_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const subState = await getBusinessSubscriptionState(bizId, email);
        const planId   = (subState?.planId || "none").toLowerCase();
        const features = subState?.plan?.features || {};

        const isPaid       = subState?.status === "active" && AUTOPILOT_PLAN_IDS.includes(planId);
        const hasAutopilot = features.GMB_AUTOPILOT === true;

        if (!isPaid || !hasAutopilot) {
          log.push({ email, skipped: true, reason: `Plan: ${planId} | GMB_AUTOPILOT: ${hasAutopilot}` });
          continue;
        }

        await processUserReviews({ email, refreshToken, subState, log });
      } else {
        // Admin — unlimited
        await processUserReviews({
          email,
          refreshToken,
          subState: { plan: { limits: { maxGmbLocations: Infinity } } },
          log,
        });
      }
    }
  } catch (err) {
    errors.push(err.message);
  }

  return {
    ok:       true,
    started,
    finished: new Date().toISOString(),
    processed: log.filter(l => l.replied !== undefined).length,
    log,
    errors,
  };
}
