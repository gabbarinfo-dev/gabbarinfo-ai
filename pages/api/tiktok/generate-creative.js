// pages/api/tiktok/generate-creative.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import {
  dispatchTikTokJobToRailway,
  suggestTopicsFromRailway,
} from "../../../lib/railway/dispatch-tiktok-creative";

// 10 Diverse High-Converting Topic Concepts for South Asian Jewellery
const DEFAULT_10_TOPICS = [
  {
    id: "kundan_bridal_choker",
    title: "👑 Royal Kundan Bridal Choker Set",
    desc: "Handcrafted uncut polki & emerald choker engineered for regal bride entrances.",
    tag: "Bridal Edit",
  },
  {
    id: "american_diamond_necklace",
    title: "💎 High-Sheen AD Cocktail Necklace",
    desc: "Rhodium-finished dazzling diamond set tailored for black-tie evening galas.",
    tag: "Partywear Glam",
  },
  {
    id: "artisanal_chandbalis",
    title: "🌸 Artisanal Chandbalis & Jhumkas",
    desc: "Lightweight statement earrings intricately crafted for festive & sangeet looks.",
    tag: "Festive Collection",
  },
  {
    id: "regal_polki_kadas",
    title: "✨ Regal Polki Kada Bangles",
    desc: "Heritage Jaipur artistry blended with contemporary London luxury styling.",
    tag: "Heritage Luxury",
  },
  {
    id: "statement_hasli_necklace",
    title: "🦚 Handcrafted Meenakari Hasli",
    desc: "Rigid torque choker with reverse-enamel peacock artistry & pearl clusters.",
    tag: "Royal Hasli",
  },
  {
    id: "diamond_mangalsutra",
    title: "💍 Modern Diamond Mangalsutra",
    desc: "Minimalist dual-chain 18k design crafted for contemporary working brides.",
    tag: "Everyday Chic",
  },
  {
    id: "temple_jewellery_harams",
    title: "🛕 Antique Temple Gold Haram",
    desc: "Deep nakshi carving featuring Goddess Lakshmi motifs and ruby cabochons.",
    tag: "Traditional Temple",
  },
  {
    id: "cocktail_passa_maangtikka",
    title: "🌙 Bridal Maang Tikka & Passa Set",
    desc: "Nawabi side-hair ornament & forehead pendant for majestic bridal profiles.",
    tag: "Bridal Accents",
  },
  {
    id: "chunky_statement_ring",
    title: "✨ Oversized Mirror Polki Finger Ring",
    desc: "Adjustable royal cocktail ring with floral cluster perimeter and glowing foil back.",
    tag: "Cocktail Edit",
  },
  {
    id: "delicate_choker_layering",
    title: "🎀 Layered Velvet Choker & Rani Haar",
    desc: "Multi-strand layering guide combining short collar chokers with long royal pearls.",
    tag: "Styling Hack",
  },
];

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || "ndantare@gmail.com";

  const { action } = req.query || req.body || {};

  const businessName = req.body?.businessName || "Bella & Diva Jewellery";
  const niche =
    req.body?.niche ||
    "Imitation jewellery, Kundan jewellery, Bridal, Partywear, Casual, American Diamond and Festive jewellery seller based in London";

  // ACTION 1: SUGGEST / REFRESH 10 FRESH TOPICS
  if (action === "suggest-topics" || action === "refresh-topics" || req.method === "GET") {
    try {
      const railwayTopics = await suggestTopicsFromRailway(businessName, niche);
      if (Array.isArray(railwayTopics) && railwayTopics.length >= 6) {
        return res.status(200).json({ ok: true, topics: railwayTopics });
      }
    } catch (e) {
      console.warn("[TikTok Topics Suggestion Warning]:", e.message);
    }

    return res.status(200).json({
      ok: true,
      topics: DEFAULT_10_TOPICS,
    });
  }

  // ACTION 2: DISPATCH TO RAILWAY WORKER (NO 504 TIMEOUTS)
  const {
    topic = "Bespoke Collection Showcase",
    format = "CAROUSEL", // "SINGLE_IMAGE" | "CAROUSEL" | "REEL"
    slideCount = 2, // 1 for SINGLE_IMAGE, or 2, 3, 5 for CAROUSEL
    logoUrl = null,
    autoAddMusic = true,
    audioPreset = "chill_luxe_vibes",
  } = req.body || {};

  try {
    console.log(`[TikTok Proxy] Forwarding creative generation to Railway Worker for "${businessName}"...`);
    const dispatchResult = await dispatchTikTokJobToRailway({
      businessName,
      niche,
      topic,
      format,
      slideCount,
      logoUrl,
      autoAddMusic,
      audioPreset,
    });

    if (!dispatchResult.ok) {
      throw new Error(dispatchResult.error || "Railway worker rejected dispatch.");
    }

    // Return jobId immediately in <300ms so Vercel never times out
    return res.status(200).json({
      ok: true,
      jobId: dispatchResult.jobId,
      status: "processing",
      format,
      slideCount,
      topic,
    });
  } catch (err) {
    console.error("[TikTok Proxy Error]:", err.message);
    return res.status(500).json({
      ok: false,
      error: `Railway Worker Dispatch Error: ${err.message}`,
    });
  }
}
