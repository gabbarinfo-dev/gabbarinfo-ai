export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  const {
    platform,
    objective,
    assets_confirmed,
    budget_per_day,
    total_days,
    location,
    user_confirmation,
  } = req.body || {};

  const missing = [];

  if (!platform) missing.push("platform");
  if (!objective) missing.push("objective");
  if (!assets_confirmed) missing.push("assets_confirmed");
  if (!budget_per_day) missing.push("budget_per_day");
  if (!total_days) missing.push("total_days");
  if (!location) missing.push("location");
  if (!user_confirmation) missing.push("user_confirmation");

  if (missing.length > 0) {
    return res.status(400).json({
      ok: false,
      gate: "blocked",
      missing,
      message:
        "Campaign execution blocked. Required confirmations missing.",
    });
  }

  return res.status(200).json({
    ok: true,
    gate: "passed",
    message: "Safety gate passed. Execution allowed.",
  });
}
