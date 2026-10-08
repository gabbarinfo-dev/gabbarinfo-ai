// pages/api/tiktok/generate-creative.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CURATED_JEWELLERY_LIBRARY = [
  {
    category: "kundan_bridal",
    keywords: ["kundan", "bridal", "wedding", "necklace", "choker", "royal", "dulhan"],
    images: [
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1080&q=80",
      "https://images.unsplash.com/photo-1611591475819-79b8b730ab61?w=1080&q=80",
    ],
  },
  {
    category: "american_diamond",
    keywords: ["american diamond", "ad", "diamond", "glam", "silver", "rhodium", "crystal"],
    images: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1080&q=80",
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1080&q=80",
    ],
  },
  {
    category: "festive_jhumkas",
    keywords: ["jhumka", "earring", "chandbali", "festive", "party", "mehendi", "sangeet"],
    images: [
      "https://images.unsplash.com/photo-1630019852942-f89202989a59?w=1080&q=80",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=1080&q=80",
    ],
  },
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const {
    topic = "Kundan Bridal Necklace Set",
    businessName = "Bella & Diva Jewellery",
    niche = "Imitation jewellery, Kundan jewellery, Bridal, Partywear, Casual, American Diamond and Festive jewellery seller based in London (www.bellandiva.com)",
  } = req.body || {};

  try {
    let modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    if (modelName.includes("models/")) modelName = modelName.replace("models/", "");

    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `
You are an expert luxury social media strategist for "${businessName}", a high-end South Asian jewellery boutique specializing in:
${niche}.

A user wants to create a viral TikTok post for: "${topic}".

Generate a JSON object with:
1. "title": Short punchy hook under 75 characters (TikTok title limit is strict).
2. "caption": A high-converting, captivating TikTok caption (under 250 words) with luxury emojis, highlighting the craftsmanship, wedding/festive styling tip, worldwide shipping from London, clear call to action to DM or visit www.bellandiva.com, and 4-6 trending hashtags (e.g., #bellandiva #kundan #bridaljewellery #londonjewellery #asianwedding).
3. "category": Choose one of ["kundan_bridal", "american_diamond", "festive_jhumkas"] that best matches this item.

OUTPUT FORMAT: Strict raw JSON only, no markdown code blocks, no other text:
{
  "title": "...",
  "caption": "...",
  "category": "..."
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleanJson = text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleanJson);

    // Pick 2-3 matched high-res images for the TikTok photo carousel
    const matchedCategory = CURATED_JEWELLERY_LIBRARY.find(
      (c) => c.category === parsed.category
    ) || CURATED_JEWELLERY_LIBRARY[0];

    return res.status(200).json({
      ok: true,
      title: parsed.title,
      caption: parsed.caption,
      images: matchedCategory.images,
      coverImage: matchedCategory.images[0],
      secondaryImage: matchedCategory.images[1],
      topic,
    });
  } catch (err) {
    console.error("[TikTok AI Generate Creative Error]:", err);
    // Graceful fallback
    return res.status(200).json({
      ok: true,
      title: `Handcrafted ${topic} ✨ Bella & Diva`,
      caption: `Dazzle every moment with our handcrafted ${topic} ✨ Designed in London with immaculate South Asian heritage craftsmanship. Worldwide delivery available! DM or shop online at www.bellandiva.com #bellandiva #kundan #bridaljewellery #londonfashion`,
      images: [
        "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1080&q=80",
        "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1080&q=80",
      ],
      coverImage: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1080&q=80",
      secondaryImage: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1080&q=80",
      topic,
    });
  }
}
