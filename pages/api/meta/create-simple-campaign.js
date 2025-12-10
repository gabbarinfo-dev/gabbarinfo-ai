// pages/api/meta/create-simple-campaign.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, message: "Only POST is allowed on this endpoint." });
  }

  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      return res.status(400).json({
        ok: false,
        message: "Missing or invalid JSON body.",
      });
    }

    const {
      adAccountId,          // e.g. "act_1587806431828953"
      pageId,               // e.g. "100857708465879"
      instagramActorId,     // e.g. "17841446447612686" (optional but nice)
      objective,            // e.g. "OUTCOME_TRAFFIC", "OUTCOME_SALES"
      dailyBudget,          // number, e.g. 500 (as in 500.00 of your currency)
      currency,             // e.g. "INR"
      targeting,            // object (age, locations, etc)
      creative,             // object (imageHash, primaryText, headline, etc)
    } = body;

    const errors = [];

    if (!adAccountId || typeof adAccountId !== "string") {
      errors.push("adAccountId (string, e.g. 'act_1587806431828953') is required.");
    }

    if (!pageId || typeof pageId !== "string") {
      errors.push("pageId (string, your Facebook Page ID) is required.");
    }

    if (!objective || typeof objective !== "string") {
      errors.push("objective (string, e.g. 'OUTCOME_TRAFFIC') is required.");
    }

    if (typeof dailyBudget !== "number" || Number.isNaN(dailyBudget)) {
      errors.push("dailyBudget (number, e.g. 500) is required.");
    }

    if (!currency || typeof currency !== "string") {
      errors.push("currency (string, e.g. 'INR') is required.");
    }

    if (!targeting || typeof targeting !== "object") {
      errors.push("targeting (object) is required.");
    }

    if (!creative || typeof creative !== "object") {
      errors.push("creative (object) is required.");
    } else {
      const {
        imageHash,
        primaryText,
        headline,
        description,
        callToAction,
        landingPage,
      } = creative;

      if (!imageHash || typeof imageHash !== "string") {
        errors.push(
          "creative.imageHash (string, from your ad account images) is required."
        );
      }
      if (!primaryText || typeof primaryText !== "string") {
        errors.push("creative.primaryText (string) is required.");
      }
      if (!headline || typeof headline !== "string") {
        errors.push("creative.headline (string) is required.");
      }
      if (!landingPage || typeof landingPage !== "string") {
        errors.push("creative.landingPage (string URL) is required.");
      }
      if (callToAction && typeof callToAction !== "string") {
        errors.push("creative.callToAction, if provided, must be a string.");
      }
      if (description && typeof description !== "string") {
        errors.push("creative.description, if provided, must be a string.");
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "Validation failed for Meta simple campaign stub.",
        errors,
      });
    }

    // 🚧 IMPORTANT:
    // This is a STUB ONLY. No real call to Meta is made here.
    // Later, once your app is fully approved, we will:
    //  - create campaign
    //  - create adset
    //  - create ad creative
    //  - create ad
    // using this same payload shape.

    return res.status(200).json({
      ok: true,
      message:
        "Meta simple campaign STUB: payload received. Once Marketing API access is approved, this will create a real campaign.",
      received: body,
    });
  } catch (err) {
    console.error("Error in /api/meta/create-simple-campaign:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while handling Meta campaign stub.",
      error: err.message || String(err),
    });
  }
}
