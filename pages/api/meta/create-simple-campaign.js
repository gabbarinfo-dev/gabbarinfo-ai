// pages/api/meta/create-simple-campaign.js
// SUPER SIMPLE STUB – no validation, no Meta API calls.
// It just logs whatever it receives and returns ok: true.
// Later, when Meta approves your app + business, we will
// replace this with the real Marketing API code.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, message: "Only POST is allowed on this endpoint." });
  }

  try {
    const body = req.body || {};

    // Just log so you can see what the agent is sending
    console.log("🟣 Meta simple-campaign stub received:", body);

    // No validation at all – always succeed in stub mode
    return res.status(200).json({
      ok: true,
      message:
        "Stub only: Meta campaign payload received. Once Meta approves your app & business, this endpoint will actually create the campaign via Marketing API.",
      received: body,
    });
  } catch (err) {
    console.error("Error in /api/meta/create-simple-campaign stub:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in Meta stub.",
      error: err.message || String(err),
    });
  }
}
