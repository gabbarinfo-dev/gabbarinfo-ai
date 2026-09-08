// pages/api/meta/create-post.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { reserveQuota, commitQuota, releaseQuota } from "../../../lib/billing/quota-service";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Only POST is allowed on this endpoint.",
    });
  }

  const session = await getServerSession(req, res, authOptions);
  const clientEmail = session?.user?.email || req.headers["x-client-email"];

  if (!clientEmail) {
    return res.status(401).json({ ok: false, message: "Unauthorized: authentication required" });
  }

  // 🛡️ SERVER-SIDE ENTITLEMENT & QUOTA GATE: SOCIAL_POST
  const reservation = await reserveQuota({
    session,
    userEmail: clientEmail,
    actionType: "SOCIAL_POST",
  });

  if (!reservation.ok) {
    return res.status(403).json({
      ok: false,
      code: reservation.code,
      message: reservation.error,
    });
  }

  const PAGE_ID = process.env.FB_PAGE_ID;
  const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

  if (!PAGE_ID || !PAGE_ACCESS_TOKEN) {
    await releaseQuota({ reservationId: reservation.reservationId, reason: "Missing FB env vars" });
    return res.status(500).json({
      ok: false,
      message:
        "Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN env vars. Please set them in Vercel.",
    });
  }

  try {
    const { message, link } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        message: "Missing or invalid 'message' field in JSON body.",
      });
    }

    // Build Graph API URL
    const baseUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
      PAGE_ID
    )}/feed`;

    const params = new URLSearchParams();
    params.append("message", message);
    if (link && typeof link === "string") {
      params.append("link", link);
    }
    params.append("access_token", PAGE_ACCESS_TOKEN);

    const fbRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const fbJson = await fbRes.json().catch(() => ({}));

    if (!fbRes.ok) {
      if (reservation?.reservationId) {
        await releaseQuota({ reservationId: reservation.reservationId, reason: "Facebook Graph API returned an error" });
      }
      console.error("Facebook API error:", fbJson);
      return res.status(fbRes.status).json({
        ok: false,
        message: "Facebook Graph API returned an error.",
        fbStatus: fbRes.status,
        fbResponse: fbJson,
      });
    }

    if (reservation?.reservationId) {
      await commitQuota({ reservationId: reservation.reservationId });
    }

    // On success, Facebook returns something like: { id: "PAGEID_postID" }
    return res.status(200).json({
      ok: true,
      message: "Post created successfully on Facebook Page.",
      fbResponse: fbJson,
    });
  } catch (err) {
    if (reservation?.reservationId) {
      await releaseQuota({ reservationId: reservation.reservationId, reason: err.message });
    }
    console.error("Meta create-post error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while creating Facebook post.",
      error: err.message || String(err),
    });
  }
}
