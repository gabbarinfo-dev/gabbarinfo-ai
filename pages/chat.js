// pages/chat.js
"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

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

const STORAGE_KEY_CHATS = "gabbarinfo_chats_v1";
const STORAGE_KEY_ACTIVE = "gabbarinfo_active_chat_v1";

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

  // Meta Boost State
  const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
  const [boostPages, setBoostPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [boostPosts, setBoostPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState("");
  const [boostGoal, setBoostGoal] = useState("PAGE_POST_ENGAGEMENT");
  const [boostBudget, setBoostBudget] = useState(500);
  const [boostDuration, setBoostDuration] = useState(5);
  const [boostLoading, setBoostLoading] = useState(false);
  const [boostResult, setBoostResult] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load chats from localStorage
  useEffect(() => {
    try {
      const storedChats = localStorage.getItem(STORAGE_KEY_CHATS);
      const storedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);

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

      const first = createEmptyChat();
      setChats([first]);
      setActiveChatId(first.id);
    } catch (e) {
      console.error("Failed to load chats:", e);
      const first = createEmptyChat();
      setChats([first]);
      setActiveChatId(first.id);
    }
  }, []);

  // Save chats + active chat
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
      if (activeChatId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE, activeChatId);
      }
    } catch (e) {
      console.error("Failed to save chats:", e);
    }
  }, [chats, activeChatId]);

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
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== activeChatId) return chat;
          const errMsg = {
            role: "assistant",
            text: "You’ve run out of credits. Please contact GabbarInfo to top up.",
          };
          return {
            ...chat,
            messages: [...(chat.messages || DEFAULT_MESSAGES), errMsg],
          };
        })
      );
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
              "You’ve run out of credits. Please contact GabbarInfo to top up.";

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

  // ---------- META BOOST LOGIC ----------
  async function fetchBoostPages() {
    setBoostLoading(true);
    setBoostResult("");
    try {
      const email = session?.user?.email;
      if (!email) throw new Error("User email not found");
      const res = await fetch(`/api/meta/boost/list-pages?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBoostPages(data.pages || []);
    } catch (err) {
      setBoostResult("Error fetching pages: " + err.message);
    } finally {
      setBoostLoading(false);
    }
  }

  async function fetchBoostPosts(pageId) {
    if (!pageId) return;
    setBoostLoading(true);
    setBoostResult("");
    setBoostPosts([]);
    try {
      const email = session?.user?.email;
      if (!email) throw new Error("User email not found");
      const res = await fetch(`/api/meta/boost/list-posts?page_id=${pageId}&email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBoostPosts(data.posts || []);
    } catch (err) {
      setBoostResult("Error fetching posts: " + err.message);
    } finally {
      setBoostLoading(false);
    }
  }

  async function handleBoostSubmit() {
    if (!selectedPage || !selectedPost) {
        setBoostResult("Please select a page and a post.");
        return;
    }
    setBoostLoading(true);
    setBoostResult("");
    try {
      const email = session?.user?.email;
      if (!email) throw new Error("User email not found");
      
      const res = await fetch("/api/meta/boost/create-boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            page_id: selectedPage,
            post_id: selectedPost,
            goal: boostGoal,
            budget: boostBudget,
            duration: boostDuration,
            email
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        const errDetail = data.details ? JSON.parse(data.details).error.message : data.error;
        throw new Error(errDetail || "Unknown error");
      }
      
      setBoostResult("✅ Boost created successfully! ID: " + (data.data?.id || "Unknown"));
    } catch (err) {
      setBoostResult("❌ Error creating boost: " + err.message);
    } finally {
      setBoostLoading(false);
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
    };

    const label = modeLabels[agentMode] || "Agent";

    const pseudoUserText = `[Agent • ${label}] ${instruction}`;
    const pseudoUserMsg = { role: "user", text: pseudoUserText };

    const baseMessages = messages || DEFAULT_MESSAGES;
    const updatedMessages = [...baseMessages, pseudoUserMsg];

    setAgentLoading(true);

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
              "You’ve run out of credits. Please contact GabbarInfo to top up.";

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
          }
        } catch (err) {
          console.error("Error calling /api/credits/consume for Agent:", err);
        }
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

      const assistantMsg = {
        role: "assistant",
        text: assistantText,
      };

      updateChatWithAssistantMessage(
        pseudoUserText,
        updatedMessages,
        assistantMsg
      );

      setAgentInstruction("");
      scrollChatToBottom();
    } catch (err) {
      console.error("Agent execution error:", err);
      setAgentError("Agent error: " + (err.message || "Unknown"));
    } finally {
      setAgentLoading(false);
    }
  }

  // ---------- AUTH STATES ----------
  if (status === "loading") {
    return <div style={{ padding: 40 }}>Checking session…</div>;
  }

  if (!session) {
    return (
      <div style={{ fontFamily: "Inter, Arial", padding: 40 }}>
        <h1>GabbarInfo AI</h1>
        <p>Please sign in to use GabbarInfo AI.</p>
        <button
          onClick={() => signIn("google")}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
        <div style={{ height: 8 }} />
        <button
          onClick={() => signIn("facebook")}
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#1877F2",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Continue with Facebook
        </button>
      </div>
    );
  }

  // ---------- MAIN CHAT UI ----------
  return (
    <div
      style={{
        fontFamily: "Inter, Arial",
        height: "100dvh",
        maxHeight: "100dvh",
        width: "100vw",
        maxWidth: "100vw",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "#fafafa",
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
          padding: 12,
          paddingLeft: isMobile ? 12 : 18,
          paddingRight: isMobile ? 12 : 18,
          borderBottom: "1px solid #eee",
          background: "#fff",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong>GabbarInfo AI</strong>
          <span>— Chat</span>
          <button
            onClick={handleNewChat}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #ddd",
              fontSize: 12,
              cursor: "pointer",
              background: "#fafafa",
            }}
          >
            New chat
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            maxWidth: isMobile ? "55%" : "none",
            justifyContent: "flex-end",
          }}
        >
          <span
            style={{
              fontSize: 11,
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: role === "owner" ? "#ffe8cc" : "#e8f0fe",
              color: role === "owner" ? "#8a3c00" : "#174ea6",
              whiteSpace: "nowrap",
            }}
          >
            {role === "owner"
              ? "Owner · Unlimited"
              : creditsLoading
                ? "Client · Credits: …"
                : `Client · Credits: ${credits ?? 0}`}
          </span>

          <div
            style={{
              fontSize: 12,
              color: "#333",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {session.user?.email}
          </div>

          <button
            onClick={() => signOut()}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              fontSize: 12,
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
            width: isMobile ? "100%" : 260,
            borderRight: isMobile ? "none" : "1px solid #eee",
            borderBottom: isMobile ? "1px solid #eee" : "none",
            padding: 12,
            paddingTop: 10,
            paddingBottom: 10,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
            background: "#fff",
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15 }}>Conversations</div>

          <button
            onClick={handleNewChat}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f5f5f5",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            + New chat
          </button>

          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "#999",
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
              maxHeight: isMobile ? 150 : "60vh",
            }}
          >
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border:
                    chat.id === activeChatId
                      ? "1px solid #d2e3fc"
                      : "1px solid #eee",
                  background:
                    chat.id === activeChatId ? "#e8f0fe" : "#ffffff",
                  fontSize: 13,
                  color: "#174ea6",
                  cursor: "pointer",
                }}
              >
                {chat.title}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <div
            style={{
              fontSize: 11,
              color: "#aaa",
              borderTop: "1px solid #f0f0f0",
              paddingTop: 8,
            }}
          >
            Chats are stored only in your browser. <br />
            GabbarInfo AI is tuned for digital marketing.
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
          }}
        >
          {/* MESSAGES AREA */}
          <div
            id="chat-area"
            style={{
              flex: 1,
              padding: 12,
              paddingBottom: 8,
              overflowY: "auto",
              background: "#fafafa",
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 10,
                  display: "flex",
                  flexDirection: m.role === "user" ? "row-reverse" : "row",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    background: m.role === "user" ? "#DCF8C6" : "#fff",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #e6e6e6",
                    fontSize: 14,
                    whiteSpace: "pre-wrap",
                    wordWrap: "break-word",
                  }}
                >
                  {m.imageUrl ? (
                    <>
                      <img
                        src={m.imageUrl}
                        alt="Generated creative"
                        style={{
                          maxWidth: "100%",
                          borderRadius: 6,
                          display: "block",
                        }}
                      />
                      {m.text && (
                        <div style={{ marginTop: 6 }}>{m.text}</div>
                      )}
                    </>
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* INPUT BAR */}
          <form
            onSubmit={sendMessage}
            style={{
              flexShrink: 0,
              display: "flex",
              padding: 10,
              gap: 8,
              borderTop: "1px solid #eee",
              background: "#fff",
              boxSizing: "border-box",
              // extra bottom padding so buttons don't hide behind mobile nav bar
              paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                loading ? "Waiting for response..." : "Ask anything..."
              }
              style={{
                flex: 1,
                minWidth: 0,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14,
              }}
              disabled={loading}
            />

            {/* Agent button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => setIsAgentPanelOpen(true)}
              style={{
                padding: "10px 10px",
                borderRadius: 8,
                fontSize: 14,
                border: "1px solid #ddd",
                background: "#f5f5f5",
                cursor: loading ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              🧠 Agent
            </button>

            {/* Image button (short label) */}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsImageModalOpen(true);
                setImagePrompt("");
              }}
              style={{
                padding: "8px 10px",          // a bit slimmer
                borderRadius: 8,
                fontSize: 13,                 // slightly smaller text
                border: "1px solid #ddd",
                background: "#f5f5f5",
                cursor: loading ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ✨ Image
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 14,
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
                width: isMobile ? "100%" : 360,
                background: "#ffffff",
                boxShadow: "-4px 0 12px rgba(0,0,0,0.12)",
                zIndex: 40,
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  padding: 16,
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    Agent panel
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginTop: 2,
                    }}
                  >
                    Plan campaigns, creatives, SEO & more.
                  </div>
                </div>
                <button
                  onClick={() => setIsAgentPanelOpen(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  flex: 1,
                  overflowY: "auto",
                }}
              >
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    color: "#555",
                  }}
                >
                  Mode
                </label>
                <select
                  value={agentMode}
                  onChange={(e) => setAgentMode(e.target.value)}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    fontSize: 13,
                  }}
                >
                  <option value="generic">Generic strategy (mixed)</option>
                  <option value="google_ads_plan">
                    Google Ads – Campaign planner
                  </option>
                  <option value="meta_ads_plan">
                    Meta Ads – Creative planner
                  </option>
                  <option value="social_plan">Social Media calendar</option>
                  <option value="seo_blog">SEO / Blog planner</option>
                  <option value="instagram_post">Instagram Post Publish</option>
                </select>

                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    color: "#555",
                    marginTop: 8,
                  }}
                >
                  Instruction
                </label>
                <textarea
                  value={agentInstruction}
                  onChange={(e) => setAgentInstruction(e.target.value)}
                  rows={6}
                  placeholder="Example: Create a Google Search campaign for my dental clinic in Ahmedabad with ₹700/day budget, JSON only. Or plan a 30-day Instagram calendar for Bella & Diva Jewellery UK."
                  style={{
                    resize: "vertical",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    fontSize: 13,
                    minHeight: 120,
                  }}
                />

                {agentError && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#b00020",
                      background: "#fde7e9",
                      borderRadius: 6,
                      padding: 8,
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
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 14,
                    border: "none",
                    background: "#1a73e8",
                    color: "#fff",
                    cursor: agentLoading ? "default" : "pointer",
                    marginTop: 8,
                  }}
                >
                  {agentLoading ? "Running Agent…" : "Run Agent"}
                </button>

                <div
                  style={{
                    fontSize: 11,
                    color: "#777",
                    marginTop: 6,
                  }}
                >
                  Tip: Use Agent for bigger tasks like full campaign plans,
                  JSON payloads, social calendars or SEO briefs. The answer will
                  appear in the main chat as a <b>GabbarInfo Agent</b> message.
                </div>
              </div>
            </div>
          )}

          {/* BOOST MODAL */}
          {isBoostModalOpen && (
            <div
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: isMobile ? "100%" : 360,
                background: "#ffffff",
                boxShadow: "-4px 0 12px rgba(0,0,0,0.12)",
                zIndex: 45,
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
              }}
            >
               <div
                style={{
                  padding: 16,
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    Boost Page Post
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginTop: 2,
                    }}
                  >
                    Promote Facebook posts directly.
                  </div>
                </div>
                <button
                  onClick={() => setIsBoostModalOpen(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: 1, overflowY: "auto" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>1. Select Page</div>
                <div style={{ display: "flex", gap: 5 }}>
                  <select
                    value={selectedPage}
                    onChange={(e) => {
                      setSelectedPage(e.target.value);
                      fetchBoostPosts(e.target.value);
                    }}
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                  >
                    <option value="">-- Select Page --</option>
                    {boostPages.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={fetchBoostPages}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#f0f0f0", cursor: "pointer" }}
                  >
                    ↻
                  </button>
                </div>

                {selectedPage && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 5 }}>2. Select Post (Last 3 Eligible)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {boostPosts.length === 0 && !boostLoading && (
                        <div style={{ fontSize: 12, color: "#777" }}>No eligible posts found or loading...</div>
                      )}
                      {boostPosts.map((post) => (
                        <label
                          key={post.id}
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            fontSize: 12,
                            border: "1px solid #eee",
                            padding: 6,
                            borderRadius: 6,
                            cursor: "pointer",
                            background: selectedPost === post.id ? "#e8f0fe" : "transparent"
                          }}
                        >
                          <input
                            type="radio"
                            name="boost_post"
                            value={post.id}
                            checked={selectedPost === post.id}
                            onChange={() => setSelectedPost(post.id)}
                          />
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {post.message ? (post.message.length > 30 ? post.message.slice(0,30)+"..." : post.message) : "[No text]"} <br />
                            <span style={{ color: "#999", fontSize: 10 }}>
                              {new Date(post.created_time).toLocaleDateString()}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {selectedPost && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 5 }}>3. Boost Settings</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#666" }}>Budget (INR)</label>
                        <input
                          type="number"
                          value={boostBudget}
                          onChange={(e) => setBoostBudget(e.target.value)}
                          style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ddd" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#666" }}>Duration (Days)</label>
                        <input
                          type="number"
                          value={boostDuration}
                          onChange={(e) => setBoostDuration(e.target.value)}
                          style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ddd" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#666" }}>Goal</label>
                      <select
                        value={boostGoal}
                        onChange={(e) => setBoostGoal(e.target.value)}
                        style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ddd" }}
                      >
                        <option value="PAGE_POST_ENGAGEMENT">Engagement</option>
                        <option value="LINK_CLICKS">Link Clicks</option>
                        <option value="MESSAGES">Messages</option>
                      </select>
                    </div>

                    <button
                      onClick={handleBoostSubmit}
                      disabled={boostLoading}
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        border: "none",
                        background: "#1a73e8",
                        color: "#fff",
                        cursor: boostLoading ? "default" : "pointer",
                      }}
                    >
                      {boostLoading ? "Boosting..." : "Boost Post Now"}
                    </button>
                  </>
                )}

                {boostResult && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 8,
                      background: boostResult.startsWith("✅") ? "#e6fffa" : "#fff5f5",
                      color: boostResult.startsWith("✅") ? "#006644" : "#c53030",
                      borderRadius: 6,
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word"
                    }}
                  >
                    {boostResult}
                  </div>
                )}
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
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
              }}
            >
              <div
                style={{
                  width: isMobile ? "90%" : 420,
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                  padding: 16,
                  boxSizing: "border-box",
                }}
              >
                <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>
                  Generate ad creative
                </h3>
                <p
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: 13,
                    color: "#555",
                  }}
                >
                  Describe the image you want. I’ll generate a DALL·E creative
                  for you.
                </p>

                <form
                  onSubmit={handleImageModalSubmit}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    rows={4}
                    autoFocus
                    placeholder="Example: Close-up of gold Kundan necklace on black background, soft spotlight, high contrast, for Instagram ad…"
                    style={{
                      resize: "vertical",
                      padding: 8,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      fontSize: 14,
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 8,
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
                        padding: "8px 12px",
                        borderRadius: 8,
                        fontSize: 13,
                        border: "1px solid #ddd",
                        background: "#f5f5f5",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    >
                      {loading ? "Generating…" : "Generate"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
