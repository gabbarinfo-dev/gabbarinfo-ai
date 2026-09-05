// pages/chat.js
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import BuyCreditsModal from "./components/BuyCreditsModal";

const SYSTEM_PROMPT = `
You are **GabbarInfo AI**, a senior digital marketing strategist with expertise in all aspects of digital marketing.

## SCOPE OF WORK
You help with **all areas of digital marketing**, including:

- **Performance Marketing**
  - Google Ads, Meta (Facebook/Instagram) Ads, YouTube Ads, LinkedIn Ads
  - Landing pages, funnels, tracking, analytics, and campaign optimization

- **API Integrations (Guidance)**
  - High-level guidance on Google Ads API, Meta Ads API, LinkedIn Ads API
  - SEO crawlers, Google Search Console (GSC) integrations
  - How OAuth, tokens, and automated workflows should be designed

- **SEO**
  - On-page, off-page, and technical SEO
  - Keyword research, content optimization, site audits, page-speed, indexing, and GSC usage

- **Content & Blogs**
  - SEO-optimized blogs, landing page copy, ad copy
  - WordPress content structure, categories/tags, internal linking

- **Social Media Management**
  - Strategies for Instagram, Facebook, LinkedIn, YouTube
  - Content calendars, post ideas, hooks, captions, engagement tactics
  - How to structure posting automation using APIs

- **Automation**
  - High-level design of marketing workflows, cron jobs, reporting, and optimization loops

- **AI Image / Creative Guidance**
  - How to brief tools like DALL·E, Stable Diffusion, etc. for ad creatives, social media posts, thumbnails

- **Analytics & Reporting**
  - How to use GA4, Google Ads reports, Meta reports
  - What KPIs to track and how to interpret them
  - How to design custom dashboards and automated reports

---

## CURRENT ROLE VS BACKEND AUTONOMY (IMPORTANT)

- You are the **strategic brain + planner**, not the executor of real API calls.
- You do **not** literally log in to accounts or push buttons; that is done by the backend and platforms.
- You can:
  - Design campaign and creative structures.
  - Suggest what the backend should do.
  - Produce **structured JSON plans** that the backend can use to actually create and manage campaigns and creatives.
- You must **NOT** claim:
  - “I have already created this campaign inside Google Ads.”
  - “I have already posted this on Instagram / Facebook / LinkedIn.”
- Instead, you say things like:
  - “Here is the full plan / JSON your system can use to create this campaign via the API.”
  - “Once your backend runs this payload, the campaign/ad will be created.”

---

## STYLE

- Friendly, confident consultant – not a robot, not overly formal.
- Prioritise clarity, practicality, and actionable steps over theory.
- Use numbered steps and bullet points wherever helpful.
- Get to the point quickly; avoid long generic introductions.

---

## CONVERSATION RULES

- Always stay consistent with details already given in the conversation:
  - Business type, niche, city, target audience, budgets, goals, past campaigns, etc.
- By default, answer in **one complete reply**, like ChatGPT.
- When the user is vague (e.g. “I want more leads”), ask 2–4 sharp questions about:
  - Industry / business type
  - Location / target geography
  - Target audience
  - Budget
  - Main objective (leads, sales, calls, traffic, awareness)
  and then give a concrete strategy.
- Do **NOT** redirect away from digital marketing. If user drifts off-topic, answer briefly and gently connect back to marketing if possible.
- Do **NOT** refuse SEO or social-media questions. You are a **full digital marketing strategist**, not only performance.
- When the user asks about “creating campaigns”, “posting on social media”, or “doing SEO work”:
  - You **guide** them step-by-step, and
  - Where relevant, you can produce **structured JSON payloads** that a backend agent can execute.

---

## GOOGLE ADS CAMPAIGN JSON FORMAT (CRITICAL WHEN ASKED)

When the user explicitly asks for **backend JSON** for a Google Ads campaign  
(e.g. “give me the JSON for this campaign”, “output only the campaign JSON”, “backend JSON only”),
you must output a JSON object in **exactly** this structure:

\`\`\`json
{
  "customerId": "1234567890",
  "campaign": {
    "name": "GabbarInfo - Leads - CityName",
    "status": "PAUSED",
    "objective": "LEAD_GENERATION",
    "network": "SEARCH",
    "dailyBudgetMicros": 50000000,
    "startDate": "2025-12-10",
    "endDate": null,
    "finalUrl": "https://client-website.com"
  },
  "adGroups": [
    {
      "name": "Ad Group Name",
      "cpcBidMicros": 2000000,
      "keywords": [
        "keyword one",
        "keyword two"
      ],
      "ads": [
        {
          "headline1": "Headline 1",
          "headline2": "Headline 2",
          "headline3": "Headline 3",
          "description1": "Description line 1",
          "description2": "Description line 2",
          "path1": "path-one",
          "path2": "path-two"
        }
      ]
    }
  ]
}
\`\`\`

### GOOGLE ADS JSON RULES

- Always return **valid JSON** (no comments, no trailing commas).
- When the user says “JSON only”, you output **only the JSON** (no extra text, no explanation, no backticks).
- \`customerId\`:
  - If the user provides a specific Google Ads customer ID, use it.
  - If not, use a placeholder like \`"1234567890"\` and clearly mention in normal answers that this must be replaced.
- All money values are in **micros**:
  - Daily budget in rupees × 1,000,000  
    - e.g. ₹500/day → \`500000000\`.
  - CPC bid in rupees × 1,000,000  
    - e.g. ₹20 CPC → \`20000000\`.
- \`status\` should default to \`"PAUSED"\` so newly created campaigns are safe by default.
- \`network\` should be \`"SEARCH"\` unless the user clearly wants something else AND the backend supports it.
- \`keywords\` must be tightly aligned to:
  - The business type,
  - The location,
  - The user’s actual search intent (what they would type into Google).
- \`ads\` should be realistic Responsive Search Ads:
  - 3 strong, distinct headlines (no copy-paste repetition),
  - 2 useful descriptions,
  - \`path1\` and \`path2\` should match the service and/or location (e.g. “dentist” / “mumbai”).

---

## CREATIVE / META / SOCIAL AD JSON FORMAT (CRITICAL WHEN ASKED)

When the user explicitly asks for a **creative JSON** for ads or social posts  
(e.g. “give me the creative JSON”, “JSON only for the Meta ad creative”, “backend creative JSON only”),
you must output a JSON object in this structure:

\`\`\`json
{
  "channel": "meta_ads",
  "platform": "facebook",
  "format": "feed_image",
  "objective": "LEAD_GENERATION",
  "creative": {
    "imagePrompt": "a modern clinic exterior at dusk, vibrant lighting, professional photographer, high resolution",
    "headline": "Best Dental Clinic in Mumbai – Book Now",
    "primaryText": "Trusted by 5000+ patients. Painless treatments and easy online booking.",
    "callToAction": "Book Now",
    "landingPage": "https://client-website.com"
  },
  "metadata": {
    "targetCountry": "IN",
    "targetLanguages": ["en", "hi"],
    "adAccountId": "1234567890",
    "campaignName": "Dentist Clinic – Mumbai – Jan 2026"
  }
}
\`\`\`

### CREATIVE JSON RULES

- Again, **valid JSON only** when user says “JSON only” (no extra text, no backticks).
- \`channel\`:
  - \`"meta_ads"\` for Facebook/Instagram ads,
  - \`"social_post"\` for organic posts,
  - \`"google_display"\` for Google Display creatives (if used later).
- \`platform\` can be:
  - \`"facebook"\`,
  - \`"instagram"\`,
  - \`"linkedin"\`,
  - \`"youtube"\`,
  depending on the user’s request.
- \`format\` examples:
  - \`"feed_image"\`,
  - \`"story"\`,
  - \`"reel"\`,
  - \`"square_post"\`,
  - \`"horizontal_video"\`.
- \`objective\` should match the marketing goal:
  - \`"LEAD_GENERATION"\`, \`"SALES"\`, \`"TRAFFIC"\`, \`"AWARENESS"\`, etc.
- \`creative.imagePrompt\` is written as a clear prompt for an AI image generator:
  - describe subject, style, mood, quality (e.g. “high-contrast studio shot of jewellery on black background, cinematic lighting”).
- \`headline\` and \`primaryText\` must be:
  - Short, punchy, and relevant to the business and offer.
- \`callToAction\`:
  - e.g. “Book Now”, “Shop Now”, “Learn More”, “Get Offer”.
- \`landingPage\`:
  - The URL where the click should go.
- \`metadata.adAccountId\`:
  - If the user gives you a specific ad account ID, use it.
  - If not, you can put a placeholder like \`"1234567890"\`.
- \`metadata.targetCountry\` and \`targetLanguages\`:
  - Default to realistic values based on what the user told you (e.g. Indian clinics → \`"IN"\`, languages \`["en", "hi"]\`).

---

## TWO MODES FOR CREATIVE ANSWERS

1. **Normal creative planning (default)**  
   When user says:
   - “Give me ad ideas for Meta ads.”
   - “Write copies for an Instagram ad.”
   - “Help me with creatives for this Google campaign.”

   You should:
   - Suggest multiple angles/hooks,
   - Provide headlines and primary text,
   - Optionally suggest image prompts,
   - Explain why they work.

2. **Backend creative JSON mode (only when asked clearly)**  
   When user says:
   - “Now give me only the creative JSON for a Facebook feed image ad.”
   - “Output backend JSON for the Meta ad creative in your fixed format.”
   - “Return creative JSON only, no explanation.”

   You should:
   - Output only the JSON object in the creative schema above.
   - No leading or trailing text, no backticks, no commentary.

---

## BEHAVIOUR RULES

- **NEVER** say “I can only help with performance marketing.”  
  You are a **full-stack digital marketing strategist** across ads, SEO, content, creatives, and social.
- **NEVER** falsely claim that you already executed actions in Google Ads, Meta, LinkedIn, WordPress, etc.
  - Instead say:
    - “This is the plan / payload your system can now execute.”
    - “Once the backend runs this JSON, the campaign/ad will be created.”
- When planning multiple ad sets / creatives:
  - Use clear themes (by audience, value proposition, or placement).
  - Avoid mixing totally different concepts into one creative JSON.
- Adapt examples and tonality to Indian & global SMB realities:
  - Realistic budgets,
  - Real lead/sales expectations,
  - Practical, implementable advice, not fantasy-case studies.
`;

const DEFAULT_MESSAGES = [
  {
    role: "assistant",
    text: "Hi — I’m GabbarInfo AI, your digital marketing strategist. How can I help you today?",
  },
];

// Keys for localStorage (we will append user email to make it user-specific)
const STORAGE_KEY_CHATS_BASE = "gabbarinfo_chats_v2";
const STORAGE_KEY_ACTIVE_BASE = "gabbarinfo_active_chat_v2";

function createEmptyChat() {
  const now = Date.now();
  return {
    id: String(now),
    title: "New conversation",
    messages: [...DEFAULT_MESSAGES],
    createdAt: now,
  };
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role || "client";

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [credits, setCredits] = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const [creditsLoading, setCreditsLoading] = useState(true);
  // ── Buy Credits modal state ──
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  // simple responsive flag – ONLY used for layout decisions (column vs row)
  const [isMobile, setIsMobile] = useState(false);

  // image modal state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");

  // Agent panel state
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const [agentMode, setAgentMode] = useState("generic");
  const [agentInstruction, setAgentInstruction] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [agentResponse, setAgentResponse] = useState("");

  // Track how many agent steps have been charged in the current campaign session
  const [campaignStepCount, setCampaignStepCount] = useState(0);

  // Auto-populate agent instructions based on mode (UI Enhancement)
  useEffect(() => {
    if (isAgentPanelOpen) {
      if (agentMode === "generic") {
        setAgentInstruction("Create A Meta Ads Campaign");
      } else if (agentMode === "google_ads_plan") {
        setAgentInstruction("Create a Google Search Ads campaign");
      } else if (agentMode === "instagram_post") {
        setAgentInstruction("Publish an Instagram Post");
      } else if (agentMode === "facebook_post") {
        setAgentInstruction("Publish a Facebook Post");
      } else if (agentMode === "seo_blog") {
        setAgentInstruction("Publish an SEO Blog");
      } else {
        setAgentInstruction("");
      }
    }
  }, [agentMode, isAgentPanelOpen]);

  // Generate user-specific keys
  const userEmail = session?.user?.email || "anonymous";
  const STORAGE_KEY_CHATS = `${STORAGE_KEY_CHATS_BASE}_${userEmail}`;
  const STORAGE_KEY_ACTIVE = `${STORAGE_KEY_ACTIVE_BASE}_${userEmail}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load chats from sessionStorage
  useEffect(() => {
    if (status === "loading") return; // Wait for session to settle
    
    try {
      const storedChats = sessionStorage.getItem(STORAGE_KEY_CHATS);
      const storedActive = sessionStorage.getItem(STORAGE_KEY_ACTIVE);

      if (storedChats) {
        const parsed = JSON.parse(storedChats);
        if (Array.isArray(parsed) && parsed.length) {
          let trimmed = parsed;
          if (parsed.length > 5) {
            trimmed = parsed
              .slice()
              .sort((a, b) => a.createdAt - b.createdAt)
              .slice(parsed.length - 5);
          }

          setChats(trimmed);

          const existingActive =
            trimmed.find((c) => c.id === storedActive)?.id || trimmed[0].id;
          setActiveChatId(existingActive);
          return;
        }
      }

      // No chats found for this key, create fresh one
      const first = createEmptyChat();
      setChats([first]);
      setActiveChatId(first.id);
    } catch (e) {
      console.error("Failed to load chats:", e);
      const first = createEmptyChat();
      setChats([first]);
      setActiveChatId(first.id);
    }
  }, [STORAGE_KEY_CHATS, status]); // Re-run when key or status changes

  // Save chats + active chat
  useEffect(() => {
    if (status === "loading") return; // Don't save to "anonymous" while loading real session
    if (!chats.length) return;

    try {
      sessionStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
      if (activeChatId) {
        sessionStorage.setItem(STORAGE_KEY_ACTIVE, activeChatId);
      }
    } catch (e) {
      console.error("Failed to save chats:", e);
    }
  }, [chats, activeChatId, STORAGE_KEY_CHATS, status]);

  // Load credits
  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch("/api/credits/get", { credentials: "include" });
        if (!res.ok) {
          console.error("Failed to load credits", await res.text());
          return;
        }
        const data = await res.json();
        setCredits(typeof data.credits === "number" ? data.credits : null);
        setUnlimited(Boolean(data.unlimited));
      } catch (err) {
        console.error("Error loading credits:", err);
      } finally {
        setCreditsLoading(false);
      }
    }

    fetchCredits();
  }, []);

  const activeChat =
    chats.find((c) => c.id === activeChatId) || null;
  const messages = activeChat?.messages || DEFAULT_MESSAGES;

  function handleNewChat() {
    const newChat = createEmptyChat();
    setChats((prev) => {
      let next = [...prev, newChat];
      if (next.length > 5) {
        next = next
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt)
          .slice(next.length - 5);
      }
      return next;
    });
    setActiveChatId(newChat.id);
    setInput("");
    setAgentResponse("");
    setCampaignStepCount(0); // reset campaign step counter on new chat
  }

  function scrollChatToBottom() {
    setTimeout(() => {
      const el = document.getElementById("chat-area");
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  // helper: update active chat with a new assistant message
  function updateChatWithAssistantMessage(
    userText,
    updatedMessages,
    assistantMsg
  ) {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== activeChatId) return chat;

        const hadUserBefore = (chat.messages || []).some(
          (m) => m.role === "user"
        );
        let newTitle = chat.title;
        if (!hadUserBefore) {
          const snippet =
            userText.length > 40
              ? userText.slice(0, 40) + "…"
              : userText || "New conversation";
          newTitle = snippet;
        }

        const finalMessages = [...updatedMessages, assistantMsg];

        return {
          ...chat,
          title: newTitle,
          messages: finalMessages,
        };
      })
    );
  }

  // IMAGE MODAL submit handler – uses the same sendMessage logic with "/image" prefix
  async function handleImageModalSubmit(e) {
    e.preventDefault();
    const prompt = imagePrompt.trim();
    if (!prompt || !activeChatId) return;

    setIsImageModalOpen(false);
    setImagePrompt("");

    // Reuse sendMessage with an overrideText that starts with "/image"
    await sendMessage(null, `/image ${prompt}`);
  }

  // MAIN sendMessage (text + /image)
  async function sendMessage(e, overrideText) {
    e?.preventDefault();

    const userTextRaw =
      typeof overrideText === "string" ? overrideText : input;
    const userText = userTextRaw.trim();

    if (!userText || !activeChatId) return;

    // detect /image commands
    const isImagePrompt = userText.toLowerCase().startsWith("/image ");
    const imagePromptValue = isImagePrompt ? userText.slice(7).trim() : "";

    if (role !== "owner" && !unlimited && credits !== null && credits <= 0) {
      // 🚫 DON'T PUSH TO MESSAGES (to avoid poisoning history)
      // Just show a local error / alert
      alert("You’ve run out of credits. Please contact GabbarInfo to top up.");
      return;
    }

    const userMsg = { role: "user", text: userText };
    const baseMessages = messages || DEFAULT_MESSAGES;
    const updatedMessages = [...baseMessages, userMsg];

    setInput("");
    setLoading(true);

    try {
      // credit consumption (for non-owner)
      if (role !== "owner" && !unlimited) {
        try {
          const consumeRes = await fetch("/api/credits/consume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (consumeRes.status === 402) {
            const data = await consumeRes.json().catch(() => ({}));
            const msg =
              data.error ||
              "You've run out of credits. Please contact GabbarInfo to top up.";

            setCredits(0);

            setChats((prev) =>
              prev.map((chat) => {
                if (chat.id !== activeChatId) return chat;
                const errMsg = { role: "assistant", text: msg };
                return {
                  ...chat,
                  messages: [
                    ...(chat.messages || DEFAULT_MESSAGES),
                    userMsg,
                    errMsg,
                  ],
                };
              })
            );

            setLoading(false);
            return;
          }

          if (!consumeRes.ok) {
            console.error("Failed to consume credit:", await consumeRes.text());
          } else {
            const data = await consumeRes.json().catch(() => ({}));
            if (typeof data.credits === "number") {
              setCredits(data.credits);
            }
          }

          // 🖼️ Image generation costs 2 credits — consume the extra 1 now
          if (isImagePrompt) {
            try {
              const extraConsumeRes = await fetch("/api/credits/consume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              });
              if (extraConsumeRes.ok) {
                const extraData = await extraConsumeRes.json().catch(() => ({}));
                if (typeof extraData.credits === "number") {
                  setCredits(extraData.credits);
                }
              }
            } catch (err) {
              console.error("Error consuming extra credit for image:", err);
            }
          }
        } catch (err) {
          console.error("Error calling /api/credits/consume:", err);
        }
      }

      // IMAGE BRANCH
      if (isImagePrompt) {
        try {
          const res = await fetch("/api/images/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              prompt: imagePromptValue || userText,
            }),
          });

          const data = await res.json().catch(() => ({}));
          console.log("IMAGE API response:", data);

          if (!res.ok || !data.ok || !data.imageBase64) {
            const errorText =
              data.error || "Failed to generate image. Please try again.";
            const errMsg = {
              role: "assistant",
              text: errorText,
            };
            updateChatWithAssistantMessage(
              userText,
              updatedMessages,
              errMsg
            );
          } else {
            const imageUrl = "data:image/jpeg;base64," + data.imageBase64;
            const assistantMsg = {
              role: "assistant",
              text: "[Image generated]",
              imageUrl,
            };
            updateChatWithAssistantMessage(
              userText,
              updatedMessages,
              assistantMsg
            );
          }
        } catch (err) {
          console.error("IMAGE GENERATION ERROR:", err);
          const errMsg = {
            role: "assistant",
            text: "Error while generating image. Please try again.",
          };
          updateChatWithAssistantMessage(
            userText,
            updatedMessages,
            errMsg
          );
        } finally {
          setLoading(false);
          scrollChatToBottom();
        }

        // stop here, do not call Gemini for /image
        return;
      }

      // TEXT BRANCH (Gemini)
      const history = updatedMessages
        .slice(-30)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join("\n\n");

      const finalPrompt = `
${SYSTEM_PROMPT}

Conversation so far:
${history}

Now respond as GabbarInfo AI.

- If the user asks for a plan, framework or "X-step" strategy, give the **entire**
  plan in this single reply (no stopping at Step 3 or Step 5).
- Use the business type, city, and budget already mentioned.
- Only break things into multiple replies when the user clearly asks for that
  (for example "explain only step 1 first" or "go step by step").
`.trim();

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: finalPrompt,
          maxOutputTokens: 768,
          temperature: 0.5,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Server error");
      }

      const data = await res.json();
      let assistantText = data.text || "";
      if (!assistantText) {
        assistantText = "No response from model.";
      }

      const assistantMsg = { role: "assistant", text: assistantText };

      updateChatWithAssistantMessage(userText, updatedMessages, assistantMsg);
    } catch (err) {
      console.error(err);
      const errMsg = {
        role: "assistant",
        text: "Error: " + (err.message || "Unknown"),
      };

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== activeChatId) return chat;
          return {
            ...chat,
            messages: [
              ...(chat.messages || DEFAULT_MESSAGES),
              userMsg,
              errMsg,
            ],
          };
        })
      );
    } finally {
      setLoading(false);
      scrollChatToBottom();
    }
  }

  // ---------- AGENT EXECUTION ----------
  async function handleRunAgent() {
    const instruction = agentInstruction.trim();
    if (!instruction || !activeChatId) return;

    setAgentError("");

    // check credits (simple version)
    if (role !== "owner" && !unlimited && credits !== null && credits <= 0) {
      setAgentError("You’ve run out of credits. Please contact GabbarInfo to top up.");
      return;
    }

    const modeLabels = {
      generic: "Generic strategy",
      google_ads_plan: "Google Ads – Campaign planner",
      meta_ads_plan: "Meta Ads – Creative planner",
      social_plan: "Social media calendar",
      seo_blog: "SEO / Blog planner",
      instagram_post: "Instagram Post Publish",
      facebook_post: "Facebook Post Publish",
    };

    const label = modeLabels[agentMode] || "Agent";

    const pseudoUserText = `[Agent • ${label}] ${instruction}`;
    const pseudoUserMsg = { role: "user", text: pseudoUserText };

    const baseMessages = messages || DEFAULT_MESSAGES;
    const updatedMessages = [...baseMessages, pseudoUserMsg];

    setAgentLoading(true);
    setLoading(true); // Sync with main chat footer

    try {
      // consume a credit for agent as well (non-owner)
      if (role !== "owner" && !unlimited) {
        try {
          const consumeRes = await fetch("/api/credits/consume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (consumeRes.status === 402) {
            const data = await consumeRes.json().catch(() => ({}));
            const msg =
              data.error ||
              "You've run out of credits. Please contact GabbarInfo to top up.";

            setCredits(0);
            setAgentError(msg);
            setAgentLoading(false);
            return;
          }

          if (!consumeRes.ok) {
            console.error("Failed to consume credit (agent):", await consumeRes.text());
          } else {
            const data = await consumeRes.json().catch(() => ({}));
            if (typeof data.credits === "number") {
              setCredits(data.credits);
            }
            // Increment campaign step counter for every agent credit consumed
            setCampaignStepCount((prev) => prev + 1);
          }
        } catch (err) {
          console.error("Error calling /api/credits/consume for Agent:", err);
        }

        // ─── BOOST NOW: 2 credits (1 already consumed above, deduct 1 more) ─────────
        // Detect keywords from user instruction that indicate "Boost Now" final step
        const isBoostNow =
          instruction.toLowerCase().includes("boost now") ||
          instruction.toLowerCase().includes("boost post") ||
          instruction.toLowerCase().includes("publish boost") ||
          instruction.toLowerCase().includes("confirm boost");

        if (isBoostNow) {
          try {
            // Check we still have ≥ 1 more credit for the extra charge
            if (credits !== null && credits < 1) {
              setAgentError(
                "Insufficient balance to Boost Now. You need at least 2 credits for this step. Please add credits."
              );
              setAgentLoading(false);
              return;
            }
            // Deduct the extra 1 credit (total = 2 for this step)
            const boostExtraRes = await fetch("/api/credits/consume", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            if (boostExtraRes.ok) {
              const boostExtraData = await boostExtraRes.json().catch(() => ({}));
              if (typeof boostExtraData.credits === "number") {
                setCredits(boostExtraData.credits);
              }
            } else if (boostExtraRes.status === 402) {
              setAgentError(
                "Insufficient balance to Boost Now. Please add credits to continue."
              );
              setAgentLoading(false);
              return;
            }
          } catch (err) {
            console.error("Error consuming extra credit for Boost Now:", err);
          }
        }
        // ─────────────────────────────────────────────────────────────────────────────
      }

      const chatHistory = baseMessages
        .slice(-20)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instruction,
          mode: agentMode,
          includeJson: true,
          chatHistory,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        setAgentError("Agent error: " + (errText || "Unknown server error"));
        setAgentLoading(false);
        return;
      }

      const data = await res.json();
      const rawText = data.text || data.response || JSON.stringify(data, null, 2);
      const assistantText = `GabbarInfo Agent:\n\n${rawText}`;
      setAgentResponse(rawText); // Save for the panel integrated view

      const assistantMsg = {
        role: "assistant",
        text: assistantText,
      };

      updateChatWithAssistantMessage(
        pseudoUserText,
        updatedMessages,
        assistantMsg
      );

      // 🎯 Campaign published successfully → top up to 24 total credits
      // Detect by checking if the response signals a successful campaign publish
      const isCampaignPublished =
        (data.campaignPublished === true) ||
        rawText.includes("CAMPAIGN_PUBLISHED_SUCCESS") ||
        rawText.includes("campaign has been published") ||
        rawText.includes("campaign is now live");

      if (isCampaignPublished && role !== "owner" && !unlimited) {
        // ─── PRE-FLIGHT CHECK: ensure user has enough credits for the top-up ────────
        try {
          const checkRes = await fetch("/api/credits/check-campaign-publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ stepsSpent: campaignStepCount }),
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json().catch(() => ({}));
            if (!checkData.sufficient) {
              // Block publish — show friendly message with shortfall
              const shortBy = checkData.shortBy ?? "?";
              const needed  = checkData.needed  ?? "?";
              const assistantErrMsg = {
                role: "assistant",
                text:
                  `GabbarInfo Agent:\n\n⚠️ **Insufficient Credits to Publish**\n\n` +
                  `Publishing this campaign requires **${needed} more credits** but you only have **${checkData.currentCredits}** left.\n` +
                  `You are **${shortBy} credit${shortBy !== 1 ? "s" : ""}** short.\n\n` +
                  `👉 Please click **"➕ Add Credits"** to top up and then try publishing again.`,
              };
              updateChatWithAssistantMessage(pseudoUserText, updatedMessages, assistantErrMsg);
              setAgentInstruction("");
              scrollChatToBottom();
              setAgentLoading(false);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error("Error calling /api/credits/check-campaign-publish:", err);
          // Non-blocking: if check fails, let the top-up proceed anyway
        }
        // ─────────────────────────────────────────────────────────────────────────────

        try {
          const topUpRes = await fetch("/api/credits/campaign-top-up", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ stepsSpent: campaignStepCount }),
          });
          if (topUpRes.ok) {
            const topUpData = await topUpRes.json().catch(() => ({}));
            if (typeof topUpData.creditsLeft === "number") {
              setCredits(topUpData.creditsLeft);
            }
          }
        } catch (err) {
          console.error("Error calling /api/credits/campaign-top-up:", err);
        }
        // Reset counter after a published campaign
        setCampaignStepCount(0);
      }

      setAgentInstruction("");
      scrollChatToBottom();
    } catch (err) {
      console.error("Agent execution error:", err);
      setAgentError("Agent error: " + (err.message || "Unknown"));
    } finally {
      setAgentLoading(false);
      setLoading(false);
    }
  }

  function handleSignOut() {
    try {
      sessionStorage.removeItem(STORAGE_KEY_CHATS);
      sessionStorage.removeItem(STORAGE_KEY_ACTIVE);
    } catch (e) {
      console.error("Failed to clear session storage:", e);
    }
    signOut();
  }

  // ---------- AUTH STATES ----------
  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080b11", color: "#94a3b8", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 22, height: 22, border: "2.5px solid rgba(59, 130, 246, 0.2)", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 14 }}>Connecting to GabbarInfo Neural Core…</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080b11",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 20,
            padding: 32,
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
            textAlign: "center",
          }}
        >
          <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 16, background: "linear-gradient(135deg, #2563eb, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 8px 24px rgba(37, 99, 235, 0.35)" }}>
            ⚡
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>
            GabbarInfo AI
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#94a3b8", lineHeight: 1.5 }}>
            Sign in to access your autonomous digital marketing & SEO strategist.
          </p>
          <button
            onClick={() => signIn("google")}
            style={{
              width: "100%",
              padding: "12px 18px",
              borderRadius: 12,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
              marginBottom: 12,
            }}
          >
            <span>Continue with Google</span>
          </button>
          <button
            onClick={() => signIn("facebook")}
            style={{
              width: "100%",
              padding: "12px 18px",
              borderRadius: 12,
              border: "none",
              background: "#1877F2",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 4px 14px rgba(24, 119, 242, 0.3)",
            }}
          >
            <span>Continue with Facebook</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------- MAIN CHAT UI ----------
  return (
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        height: "100dvh",
        maxHeight: "100dvh",
        width: "100vw",
        maxWidth: "100vw",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "#080b11",
        color: "#f8fafc",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(16px)",
          zIndex: 20,
        }}
      >
        {/* Left: Brand + Quick Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                boxShadow: "0 2px 10px rgba(37, 99, 235, 0.35)",
              }}
            >
              ⚡
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #ffffff 40%, #93c5fd)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              GabbarInfo AI
            </span>
          </div>

          <div style={{ height: 18, width: 1, background: "rgba(255, 255, 255, 0.12)", margin: "0 2px" }} />

          {/* Navigation Chips to other parts of the suite */}
          <Link
            href="/"
            style={{
              padding: "5px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(255, 255, 255, 0.03)",
              color: "#94a3b8",
              fontSize: 12,
              textDecoration: "none",
              display: isMobile ? "none" : "flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.15s ease",
            }}
          >
            <span>🏠</span>
            <span>Dashboard</span>
          </Link>

          <Link
            href="/seo"
            style={{
              padding: "5px 10px",
              borderRadius: 8,
              border: "1px solid rgba(16, 185, 129, 0.25)",
              background: "rgba(16, 185, 129, 0.08)",
              color: "#34d399",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              display: isMobile ? "none" : "flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.15s ease",
            }}
          >
            <span>🌐</span>
            <span>SEO Suite</span>
          </Link>

          <button
            onClick={handleNewChat}
            style={{
              padding: "5px 12px",
              borderRadius: 8,
              border: "1px solid rgba(59, 130, 246, 0.3)",
              background: "rgba(59, 130, 246, 0.12)",
              color: "#60a5fa",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>+</span>
            <span>New Chat</span>
          </button>
        </div>

        {/* Right: Credits, User info, Sign out */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            maxWidth: isMobile ? "55%" : "none",
            justifyContent: "flex-end",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 999,
              border: role === "owner" ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(59, 130, 246, 0.3)",
              background: role === "owner" ? "rgba(245, 158, 11, 0.12)" : "rgba(59, 130, 246, 0.12)",
              color: role === "owner" ? "#fbbf24" : "#93c5fd",
              whiteSpace: "nowrap",
            }}
          >
            {role === "owner"
              ? "👑 Owner · Unlimited"
              : creditsLoading
                ? "⚡ Credits: …"
                : `⚡ Credits: ${credits ?? 0}`}
          </span>

          {/* ➕ Add Credits button — visible to non-owners only */}
          {role !== "owner" && (
            <button
              onClick={() => setShowBuyCredits(true)}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid rgba(139, 92, 246, 0.4)",
                background: "rgba(139, 92, 246, 0.15)",
                color: "#c4b5fd",
                fontWeight: 600,
                fontSize: 11,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              ➕ Add Credits
            </button>
          )}

          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 160,
              display: isMobile ? "none" : "block",
            }}
          >
            {session.user?.email}
          </div>

          <button
            onClick={handleSignOut}
            style={{
              padding: "5px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              background: "rgba(255, 255, 255, 0.05)",
              color: "#94a3b8",
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* BODY */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* SIDEBAR */}
        <aside
          style={{
            width: isMobile ? "100%" : 280,
            borderRight: isMobile ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
            borderBottom: isMobile ? "1px solid rgba(255, 255, 255, 0.08)" : "none",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            flexShrink: 0,
            background: "rgba(10, 14, 23, 0.95)",
            backdropFilter: "blur(16px)",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
              Conversations
            </span>
            <span style={{ fontSize: 11, color: "#64748b" }}>
              {chats.length} active
            </span>
          </div>

          <button
            onClick={handleNewChat}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(59, 130, 246, 0.3)",
              background: "rgba(59, 130, 246, 0.1)",
              color: "#60a5fa",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            <span>+</span>
            <span>New conversation</span>
          </button>

          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "#64748b",
              marginTop: 2,
            }}
          >
            Recent (max 5)
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              overflowY: "auto",
              maxHeight: isMobile ? 150 : "58vh",
            }}
          >
            {chats.map((chat) => {
              const isActive = chat.id === activeChatId;
              return (
                <button
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: isActive
                      ? "1px solid rgba(59, 130, 246, 0.4)"
                      : "1px solid rgba(255, 255, 255, 0.05)",
                    background: isActive
                      ? "rgba(59, 130, 246, 0.12)"
                      : "rgba(255, 255, 255, 0.02)",
                    fontSize: 13,
                    color: isActive ? "#93c5fd" : "#cbd5e1",
                    fontWeight: isActive ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  💬 {chat.title}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          {/* Suite quick links inside mobile sidebar */}
          {isMobile && (
            <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <Link
                href="/"
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "#94a3b8",
                  fontSize: 12,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                🏠 Dashboard
              </Link>
              <Link
                href="/seo"
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: 8,
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "#34d399",
                  fontSize: 12,
                  textAlign: "center",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                🌐 SEO Suite
              </Link>
            </div>
          )}

          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              paddingTop: 10,
              lineHeight: 1.5,
            }}
          >
            Chats are saved securely in your browser session. Tuned specifically for SMB & enterprise growth.
          </div>
        </aside>

        {/* CHAT COLUMN */}
        <section
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            boxSizing: "border-box",
            position: "relative",
            background: "radial-gradient(ellipse at 50% 0%, rgba(37, 99, 235, 0.08), transparent 50%), #080b11",
          }}
        >
          {/* MESSAGES AREA */}
          <div
            id="chat-area"
            style={{
              flex: 1,
              padding: isMobile ? 12 : 20,
              paddingBottom: 16,
              overflowY: "auto",
            }}
          >
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={i}
                  style={{
                    marginBottom: 16,
                    display: "flex",
                    flexDirection: isUser ? "row-reverse" : "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  {!isUser && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        flexShrink: 0,
                        marginTop: 2,
                        boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                      }}
                    >
                      🤖
                    </div>
                  )}

                  <div
                    style={{
                      maxWidth: isMobile ? "88%" : "75%",
                      background: isUser
                        ? "linear-gradient(135deg, #1d4ed8, #2563eb)"
                        : "rgba(15, 23, 42, 0.8)",
                      backdropFilter: isUser ? "none" : "blur(16px)",
                      padding: "12px 16px",
                      borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      border: isUser
                        ? "1px solid rgba(96, 165, 250, 0.3)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: isUser ? "#ffffff" : "#f1f5f9",
                      whiteSpace: "pre-wrap",
                      wordWrap: "break-word",
                      boxShadow: isUser
                        ? "0 4px 16px rgba(37, 99, 235, 0.25)"
                        : "0 4px 20px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    {!isUser && (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "#60a5fa",
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>GabbarInfo AI Strategist</span>
                      </div>
                    )}

                    {m.imageUrl ? (
                      <div>
                        <img
                          src={m.imageUrl}
                          alt="Generated creative"
                          style={{
                            maxWidth: "100%",
                            borderRadius: 10,
                            display: "block",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                          }}
                        />
                        {m.text && (
                          <div style={{ marginTop: 10, color: "#cbd5e1" }}>{m.text}</div>
                        )}
                      </div>
                    ) : (
                      m.text
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* INPUT BAR */}
          <form
            onSubmit={sendMessage}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              padding: "12px 16px",
              gap: 10,
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(15, 23, 42, 0.9)",
              backdropFilter: "blur(20px)",
              boxSizing: "border-box",
              paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                loading ? "Analyzing and thinking…" : "Ask about campaigns, ad copy, targeting, SEO, or type instruction…"
              }
              style={{
                flex: 1,
                minWidth: 0,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "rgba(8, 11, 17, 0.75)",
                color: "#f8fafc",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.2s ease",
              }}
              disabled={loading}
            />

            {/* Agent button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => setIsAgentPanelOpen(true)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid rgba(139, 92, 246, 0.35)",
                background: "rgba(139, 92, 246, 0.12)",
                color: "#c4b5fd",
                cursor: loading ? "default" : "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <span>🧠</span>
              <span>Agent</span>
            </button>

            {/* Image button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsImageModalOpen(true);
                setImagePrompt("");
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid rgba(6, 182, 212, 0.35)",
                background: "rgba(6, 182, 212, 0.12)",
                color: "#67e8f9",
                cursor: loading ? "default" : "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <span>✨</span>
              <span>Image</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "11px 20px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                border: "none",
                background: loading
                  ? "rgba(255, 255, 255, 0.1)"
                  : "linear-gradient(135deg, #2563eb, #7c3aed)",
                color: "#ffffff",
                cursor: loading ? "default" : "pointer",
                boxShadow: loading ? "none" : "0 4px 16px rgba(37, 99, 235, 0.4)",
                transition: "all 0.15s ease",
              }}
            >
              {loading ? "Thinking…" : "Send"}
            </button>
          </form>

          {/* AGENT PANEL (right-side drawer) */}
          {isAgentPanelOpen && (
            <div
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: isMobile ? "100%" : 380,
                background: "#0d131f",
                borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                boxShadow: "-16px 0 40px rgba(0,0,0,0.6)",
                zIndex: 40,
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  padding: "18px 20px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(15, 23, 42, 0.6)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#f8fafc" }}>
                    🧠 Agent Execution Panel
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#94a3b8",
                      marginTop: 2,
                    }}
                  >
                    Autonomous plan builder & campaign orchestrator
                  </div>
                </div>
                <button
                  onClick={() => setIsAgentPanelOpen(false)}
                  style={{
                    border: "none",
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "#94a3b8",
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    fontSize: 18,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  flex: 1,
                  overflowY: "auto",
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#94a3b8",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Agent Engine Mode
                  </label>
                  <select
                    value={agentMode}
                    onChange={(e) => setAgentMode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      background: "#151c2c",
                      color: "#f8fafc",
                      fontSize: 13,
                      outline: "none",
                    }}
                  >
                    <option value="generic">Generic Strategy (Multi-channel)</option>
                    <option value="google_ads_plan">Google Ads – Campaign Planner</option>
                    <option value="meta_ads_plan">Meta Ads – Creative Planner</option>
                    <option value="social_plan">Social Media Content Calendar</option>
                    <option value="seo_blog">SEO & Blog Content Planner</option>
                    <option value="instagram_post">Instagram Post Publisher</option>
                    <option value="facebook_post">Facebook Post Publisher</option>
                  </select>
                </div>

                {agentResponse && (
                  <div
                    style={{
                      marginTop: 4,
                      padding: 14,
                      background: "rgba(59, 130, 246, 0.1)",
                      borderRadius: 12,
                      border: "1px solid rgba(59, 130, 246, 0.25)",
                      fontSize: 13,
                      color: "#93c5fd",
                      whiteSpace: "pre-wrap",
                      maxHeight: 220,
                      overflowY: "auto",
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#60a5fa" }}>
                      Agent Execution Result:
                    </div>
                    {agentResponse}
                  </div>
                )}

                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#94a3b8",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Instruction & Objectives
                  </label>
                  <textarea
                    value={agentInstruction}
                    onChange={(e) => setAgentInstruction(e.target.value)}
                    rows={6}
                    placeholder="Example: Create a Google Search campaign for my dental clinic in Ahmedabad with ₹700/day budget, JSON only. Or plan a 30-day Instagram calendar for Bella & Diva Jewellery UK."
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      resize: "vertical",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      background: "#080b11",
                      color: "#f8fafc",
                      fontSize: 13,
                      minHeight: 120,
                      lineHeight: 1.5,
                      outline: "none",
                    }}
                  />
                </div>

                {agentError && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "#fca5a5",
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    {agentError}
                  </div>
                )}

                <div style={{ flex: 1 }} />

                <button
                  type="button"
                  onClick={handleRunAgent}
                  disabled={agentLoading}
                  style={{
                    width: "100%",
                    padding: "12px 18px",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    border: "none",
                    background: agentLoading
                      ? "rgba(255, 255, 255, 0.1)"
                      : "linear-gradient(135deg, #2563eb, #7c3aed)",
                    color: "#ffffff",
                    cursor: agentLoading ? "default" : "pointer",
                    boxShadow: agentLoading ? "none" : "0 4px 18px rgba(37, 99, 235, 0.4)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {agentLoading ? "Executing Neural Workflow…" : "Run Autonomous Agent"}
                </button>

                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  💡 <strong>Agent Tip:</strong> Executes multi-step campaign blueprints, structured JSON schemas, full social calendars, or SEO strategy. Responses are streamed directly to the main chat session.
                </div>
              </div>
            </div>
          )}

          {/* IMAGE PROMPT MODAL */}
          {isImageModalOpen && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: isMobile ? "95%" : 460,
                  background: "#0f172a",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 16,
                  boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
                  padding: 24,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>✨</span>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
                    Generate Ad Creative
                  </h3>
                </div>
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: 13,
                    color: "#94a3b8",
                    lineHeight: 1.5,
                  }}
                >
                  Describe the creative visual. GabbarInfo AI will synthesize a high-converting image for your campaigns or social media.
                </p>

                <form
                  onSubmit={handleImageModalSubmit}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    rows={4}
                    autoFocus
                    placeholder="Example: Close-up of gold Kundan necklace on dark obsidian background, dramatic lighting, luxury jewelry ad style, 4k resolution…"
                    style={{
                      resize: "vertical",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      background: "#080b11",
                      color: "#f8fafc",
                      fontSize: 14,
                      lineHeight: 1.5,
                      outline: "none",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 10,
                      marginTop: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsImageModalOpen(false);
                        setImagePrompt("");
                      }}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        background: "rgba(255, 255, 255, 0.05)",
                        color: "#94a3b8",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: "9px 18px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        border: "none",
                        background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                        color: "#ffffff",
                        cursor: loading ? "default" : "pointer",
                        boxShadow: "0 4px 14px rgba(6, 182, 212, 0.35)",
                      }}
                    >
                      {loading ? "Generating Creative…" : "Generate Creative"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── Buy Credits Modal ── */}
      <BuyCreditsModal
        isOpen={showBuyCredits}
        onClose={() => setShowBuyCredits(false)}
        userEmail={session?.user?.email}
      />
    </div>
  );
}
