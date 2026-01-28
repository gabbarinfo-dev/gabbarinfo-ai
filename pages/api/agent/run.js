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
  const res = await fetch(`${BASE_URL}/api/agent/safety-gate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function generateQuestions(payload) {
  const res = await fetch(`${BASE_URL}/api/agent/questions`, {
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
      const intakeRes = await fetch(`${BASE_URL}/api/agent/intake-business`, {
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
        objective: objective || "traffic",
        conversion_location: "WEBSITE", // Fixed for this flow
        performance_goal: "LINK_CLICKS", // Fixed for this flow
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
            qRes.questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
          stage: "awaiting_answers",
          intent: { platform, objective, conversion_location: "WEBSITE", performance_goal: "LINK_CLICKS" },
          missing: gateRes.missing,
        });
      }

      // 4️⃣ Ready for Creative Generation
      return res.json({
        reply: "I have all the required details. Shall I generate the ad creative options for you?",
        stage: "ready_for_creative",
        intent: { platform, objective, conversion_location: "WEBSITE", performance_goal: "LINK_CLICKS" },
        intake,
      });
    }

    /* ======================================================
       🔹 STAGE: CREATIVE GENERATION (User said YES to "Shall I generate creative?")
       ====================================================== */

    if (
      body.stage === "ready_for_creative" &&
      body.confirm === true
    ) {
      const creativeRes = await fetch(`${BASE_URL}/api/agent/generate-creative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intake: body.intake,
          objective: body.intent.objective,
        }),
      });

      const creativeData = await creativeRes.json();
      if (!creativeData.ok) {
        return res.json({ reply: "I couldn't generate creatives. Please try again." });
      }

      const { headlines, primary_texts, cta, image_prompt, targeting_suggestions } = creativeData.creative;

      return res.json({
        reply:
          "Here’s what I’ve prepared for your ad:\n\n" +
          "**Headlines:**\n- " + headlines.join("\n- ") +
          "\n\n**Primary Texts:**\n- " + primary_texts.join("\n- ") +
          "\n\n**CTA:** " + cta +
          "\n\n**Image Concept:** " + image_prompt +
          "\n\n**Targeting Suggestions:**\n- Interests: " + targeting_suggestions.interests.join(", ") +
          "\n- Demographics: " + targeting_suggestions.demographics.join(", ") +
          "\n\n**Reply YES to generate the image and upload it to Meta.**",
        stage: "creative_ready",
        creative: creativeData.creative,
        intent: body.intent,
        intake: body.intake,
      });
    }

    /* ======================================================
       🔹 STAGE: IMAGE GENERATION & UPLOAD (User said YES to Creative)
       ====================================================== */

    if (
      body.stage === "creative_ready" &&
      body.confirm === true
    ) {
      // A. Generate Image
      const imgGenRes = await fetch(`${BASE_URL}/api/images/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: body.creative.image_prompt }),
      });

      const imgGenData = await imgGenRes.json();
      if (!imgGenData.ok) {
        return res.json({ reply: "Image generation failed. Should I try again?" });
      }

      // B. Upload to Meta
      const uploadRes = await fetch(`${BASE_URL}/api/meta/upload-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-email": body.intake.email || "" // Assuming email is in intake or session
        },
        body: JSON.stringify({ imageBase64: imgGenData.imageBase64 }),
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.ok) {
        return res.json({ reply: "Failed to upload image to Meta. " + (uploadData.message || "") });
      }

      return res.json({
        reply: "Image generated and uploaded successfully! I'm now ready to create the campaign.\n\n" +
          "**Final Confirmation:** Do you want me to publish this campaign in **PAUSED** mode to your Meta Ad Account?",
        stage: "final_publish_confirmation",
        image_hash: uploadData.imageHash,
        creative: body.creative,
        intent: body.intent,
        intake: body.intake,
      });
    }

    /* ======================================================
       🔹 STAGE: EXECUTION (User said YES to Final Publish)
       ====================================================== */

    if (
      body.stage === "final_publish_confirmation" &&
      body.confirm === true
    ) {
      // SECTION 9 — FAILURE CONDITIONS
      if (!body.intake?.website_url && !body.intake?.business_website) {
        return res.json({ reply: "Stop. Execution failed: website_url is missing." });
      }
      if (!body.intake?.budget?.amount) {
        return res.json({ reply: "Stop. Execution failed: budget is invalid or missing." });
      }
      if (!body.intake?.duration_days) {
        return res.json({ reply: "Stop. Execution failed: duration is missing." });
      }
      if (!body.intake?.locations) {
        return res.json({ reply: "Stop. Execution failed: locations are missing." });
      }

      const payload = {
        campaign_name: `${body.intent.objective.toUpperCase()} - ${body.intake.business_name || "Campaign"} - ${new Date().toLocaleDateString()}`,
        objective: body.intent.objective,
        budget: body.intake.budget,
        duration_days: body.intake.duration_days,
        locations: body.intake.locations,
        ad_sets: [
          {
            name: "Ad Set 1",
            ad_creative: {
              image_hash: body.image_hash,
              primary_text: body.creative.primary_texts[0],
              headline: body.creative.headlines[0],
              call_to_action: body.creative.cta,
              destination_url: body.intake.website_url || body.intake.business_website
            }
          }
        ]
      };

      const executeRes = await fetch(`${BASE_URL}/api/meta/execute-campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-email": body.intake.email || ""
        },
        body: JSON.stringify({ platform: "meta", payload }),
      });

      const executeData = await executeRes.json();
      if (!executeData.ok) {
        // Section 9: STOP on Meta permission error
        return res.json({ reply: "Meta permission or API error: " + (executeData.message || "Execution failed.") });
      }

      return res.json({
        ok: true,
        reply: `Success! Your campaign has been created and put in **PAUSED** mode.\n\n` +
          `**Campaign ID:** ${executeData.id}\n` +
          `**Ad Set ID:** ${executeData.details?.ad_sets?.[0] || 'N/A'}\n` +
          `**Ad ID:** ${executeData.details?.ads?.[0] || 'N/A'}\n` +
          `**Status:** ${executeData.status}\n\n` +
          `You can now review it in your Meta Ads Manager.`,
        stage: "completed",
        campaign_id: executeData.id
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
        `${BASE_URL}/api/google-ads/create-simple-campaign`,
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
        `${BASE_URL}/api/meta/create-simple-campaign`,
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


