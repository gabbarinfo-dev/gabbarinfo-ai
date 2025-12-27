// pages/api/agent/run.js

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

/* ---------------- HELPERS (SAFE ADDITIONS) ---------------- */

async function detectIntent(query) {
  const res = await fetch(`${BASE_URL}/api/agent/intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

async function safetyGate(payload) {
  const res = await fetch(${BASE_URL}/api/agent/safety-gate, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function generateQuestions(payload) {
  const res = await fetch(${BASE_URL}/api/agent/questions, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

/* ---------------- MAIN HANDLER ---------------- */

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

    /* ======================================================
       🔹 MODE 1: AGENT CHAT FLOW (NEW, SAFE)
       Triggered when message exists
       ====================================================== */

    if (body.message && typeof body.message === "string") {
      const userMessage = body.message;

      // 1️⃣ Detect intent
      const intentRes = await detectIntent(userMessage);

      if (!intentRes.ok) {
        return res.json({
          reply: "I couldn’t understand that. Please rephrase your request.",
        });
      }

      const { platform, objective } = intentRes.intent;

      // 1.5️⃣ Load business intake (VERY IMPORTANT)
const intakeRes = await fetch(${BASE_URL}/api/agent/intake-business, {
  method: "GET",
  headers: {
    Cookie: req.headers.cookie || "",
  },
});

const intakeJson = await intakeRes.json();
const intake = intakeJson?.intake || {};


      // 2️⃣ Safety gate (initial, strict)
     const gateRes = await safetyGate({
  platform,
  objective,
  assets_confirmed: true,
  context: intake,
});


      if (!gateRes.ok && gateRes.missing) {
        // 3️⃣ Ask Gemini questions
       const qRes = await generateQuestions({
  platform,
  objective,
  missing: gateRes.missing,
  context: intake,
});


        return res.json({
          reply:
            "Before I proceed, I need a few details:\n\n" +
            qRes.questions.map((q, i) => ${i + 1}. ${q}).join("\n"),
          stage: "awaiting_answers",
          intent: { platform, objective },
        });
      }

      // Execution intentionally blocked for now
      return res.json({
        reply:
          "I have all the required details. Please confirm to proceed further.",
        stage: "ready_for_confirmation",
        intent: { platform, objective },
      });
    }
/* ======================================================
   🔹 CONFIRMATION HANDLER (YES)
   ====================================================== */

if (
  body.confirm === true &&
  body.intent?.platform === "meta" &&
  body.intent?.objective
) {
  // 🔹 Step 1: Generate creative automatically
  const creativeRes = await fetch(
    ${BASE_URL}/api/agent/generate-creative,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intake: body.intake, // collected business data
        objective: body.intent.objective,
      }),
    }
  );

  const creativeData = await creativeRes.json();

  if (!creativeData.ok) {
    return res.json({
      reply: "I couldn’t generate ad creatives. Please try again.",
    });
  }

  return res.json({
    reply:
      "Here’s what I’ve prepared for your ad:\n\n" +
      "Headlines:\n- " +
      creativeData.creative.headlines.join("\n- ") +
      "\n\nPrimary Texts:\n- " +
      creativeData.creative.primary_texts.join("\n- ") +
      "\n\nCTA: " +
      creativeData.creative.cta +
      "\n\nReply YES to generate the image and create the paused campaign.",
    stage: "creative_ready",
    creative: creativeData.creative,
    intent: body.intent,
  });
}

    /* ======================================================
       🔹 MODE 2: EXISTING EXECUTION FLOW (UNCHANGED)
       platform + action + payload
       ====================================================== */

    const { platform, action, payload } = body;

    if (!platform || typeof platform !== "string") {
      return res.status(400).json({
        ok: false,
        message: "platform (string) is required: 'google' or 'meta'.",
      });
    }

    if (!action || typeof action !== "string") {
      return res.status(400).json({
        ok: false,
        message: "action (string) is required.",
      });
    }

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({
        ok: false,
        message: "payload (object) is required.",
      });
    }

    /* ---------- GOOGLE ADS (UNCHANGED) ---------- */

    if (platform === "google" && action === "create_simple_campaign") {
      const resp = await fetch(
        ${BASE_URL}/api/google-ads/create-simple-campaign,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        return res.status(resp.status).json({
          ok: false,
          forwardedTo: "google-ads/create-simple-campaign",
          message: "Google Ads stub returned an error.",
          error: data,
        });
      }

      return res.status(200).json({
        ok: true,
        forwardedTo: "google-ads/create-simple-campaign",
        response: data,
      });
    }

    /* ---------- META ADS (UNCHANGED) ---------- */

    if (platform === "meta" && action === "create_simple_campaign") {
      const resp = await fetch(
        ${BASE_URL}/api/meta/create-simple-campaign,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        return res.status(resp.status).json({
          ok: false,
          forwardedTo: "meta/create-simple-campaign",
          message: "Meta stub returned an error.",
          error: data,
        });
      }

      return res.status(200).json({
        ok: true,
        forwardedTo: "meta/create-simple-campaign",
        response: data,
      });
    }

    return res.status(400).json({
      ok: false,
      message:
        "Unknown platform/action combo. Expected 'google' or 'meta' with valid action.",
    });
  } catch (err) {
    console.error("Agent /api/agent/run error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in /api/agent/run.",
      error: err.message || String(err),
    });
  }
}
