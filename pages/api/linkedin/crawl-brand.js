// pages/api/linkedin/crawl-brand.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { extractAndStoreLinkedInBrandIntel } from "../../../lib/linkedin/linkedin-brand-intelligence";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { websiteUrl, brandName } = req.body || {};

  try {
    const intel = await extractAndStoreLinkedInBrandIntel({
      email,
      websiteUrl: websiteUrl?.trim(),
      brandName: brandName?.trim() || "Business",
    });

    return res.status(200).json({
      ok: true,
      message: `Successfully crawled and analyzed services for ${intel.brandName}! Formulated 30 non-repeating topics.`,
      intelligence: intel,
    });
  } catch (err) {
    console.error("[LinkedIn Crawl Brand Catch]:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to analyze website and formulate topics.",
    });
  }
}
