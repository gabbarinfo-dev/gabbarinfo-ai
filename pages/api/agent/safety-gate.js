export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  const {
    platform,
    objective,
    conversion_location,
    performance_goal,
    context = {}
  } = req.body || {};

  const missing = [];

  if (!platform) missing.push("platform");
  if (!objective) missing.push("objective");

  // 🧠 OBJECTIVE-DEPENDENT LOGIC (Traffic -> Website -> Link Clicks)
  if (
    platform === "meta" &&
    objective === "traffic" &&
    conversion_location === "WEBSITE" &&
    performance_goal === "LINK_CLICKS"
  ) {
    if (!context.business_website && !context.website_url) missing.push("website_url");
    if (!context.services_description && !context.business_about) missing.push("services_description");
    if (!context.locations) missing.push("locations");
    if (!context.budget?.amount) missing.push("budget.amount");
    if (!context.budget?.type) missing.push("budget.type");
    if (!context.duration_days) missing.push("duration_days");
  } else {
    // Default safety gate for other flows (Legacy / Placeholder)
    const {
      assets_confirmed,
      budget_per_day,
      total_days,
      location,
      user_confirmation,
    } = req.body || {};

    if (!assets_confirmed) missing.push("assets_confirmed");
    if (!budget_per_day) missing.push("budget_per_day");
    if (!total_days) missing.push("total_days");
    if (!location) missing.push("location");
    if (!user_confirmation) missing.push("user_confirmation");
  }

  if (missing.length > 0) {
    return res.status(200).json({
      ok: false,
      gate: "blocked",
      missing,
      message: "Campaign execution blocked. Required details missing for this flow.",
    });
  }

  return res.status(200).json({
    ok: true,
    gate: "passed",
    message: "Safety gate passed. Execution allowed.",
  });
}
