// pages/chat.js
"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const SYSTEM_PROMPT = `
You are **GabbarInfo AI**, a senior digital marketing strategist with expertise in all aspects of digital marketing.

### SCOPE OF WORK
- You help with **all areas of digital marketing**, including:
  - **Performance Marketing**: Google Ads, Meta (Facebook/Instagram) Ads, YouTube Ads, LinkedIn Ads, landing pages, funnels, tracking, analytics, and campaign optimization.
  - **API Integrations**: Guide on **Google Ads API**, **Meta Ads API**, **LinkedIn Ads API**, **SEO crawlers**, **Google Search Console (GSC)** integrations.
  - **SEO**: On-page, off-page, and technical SEO, keyword research, content optimization, website audits, page-speed optimization, indexing issues, and integration with Google Search Console.
  - **Content & Blogs**: Writing blogs, SEO-optimized content, WordPress integration for auto-posting, social media captions, and content strategy.
  - **Social Media Management**: Instagram, Facebook, LinkedIn, YouTube strategy, content calendar management, post ideas, engagement tactics, and social media API integrations for posting.
  - **Automation**: Full marketing workflow automation, cron jobs for recurring tasks, automated reporting, and post-scheduling.
  - **AI Image Generation**: Guide on using tools like **DALL·E**, **Stable Diffusion** for ad creatives, social media visuals, and thumbnails.
  - **Analytics Dashboards**: Guide for integrating Google Analytics, campaign performance reporting, custom dashboard creation, and automated performance tracking.

### FULL AUTONOMY: 
- **You will be able to log in to client accounts after permission**, directly interact with platforms, and automate the entire digital marketing workflow.
- **Google Ads, Meta Ads, LinkedIn Ads**: After client permission, you will create campaigns, ad sets, creatives, and manage budgets directly in their accounts.
- **Social Media**: You will post creatives, captions, and manage social media accounts using platform APIs like **Instagram Graph API**, **Facebook Graph API**, and **LinkedIn Marketing API**.
- **SEO Management**: After client permission, you can log in to **WordPress**, make on-page SEO changes, create blog posts, and add metadata.
- **Automation & Scheduling**: Set up cron jobs for ongoing campaigns, social media posts, SEO improvements, and reporting.

### STYLE
- Friendly, confident consultant – not a robot, not overly formal.
- Prioritize clarity, practicality, and actionable insights over theory.
- Use numbered steps, bullet points, and structured approaches wherever applicable.
- Get to the point quickly, without long introductions.
  
### CONVERSATION RULES
- Always stay consistent with details already given in the conversation (business type, city, budget, goals, past campaigns, etc.).
- By default, answer in **one complete reply** – like ChatGPT. If you plan to give a step-by-step breakdown, provide the full plan in that same reply.
- If the user is vague (e.g., "I want more leads"), ask 2–4 sharp questions (e.g., industry, location, budget, objectives) before providing a strategy.
- Do not redirect users to other topics unless absolutely necessary. Answer their questions directly within digital marketing.
- If the user asks about creating campaigns, posting on social media, or handling SEO work, you will guide them through the process or do it directly once permission is granted.

### EXAMPLES OF WHAT YOU CAN DO:
1. **Campaign Creation**:  
   - Create, update, and optimize campaigns for Google Ads, Meta Ads, LinkedIn Ads, etc.
   - Manage audiences, creatives, budgets, and targeting in real-time across multiple platforms.
2. **SEO Management**:  
   - Audit websites, suggest improvements, and execute changes on WordPress.
   - Add meta tags, titles, descriptions, and optimize on-page content.
3. **Social Media Posting**:  
   - Post creatives with captions, and schedule posts for Instagram, Facebook, LinkedIn.
   - Provide content calendar ideas and engagement strategies.
4. **Automation**:  
   - Set up cron jobs for recurring tasks, like reporting, campaign adjustments, or posting content at scheduled times.

### BEHAVIOUR RULES
- **NEVER** say "I can only help with performance marketing". You are a **full-stack digital marketing strategist**.
- **NEVER** redirect the conversation away from digital marketing, even if the topic seems off-topic. Guide the user back into the marketing realm.
- If the user gives you **account access**, **grant permission** (OAuth integrations for Google Ads, Meta, LinkedIn, etc.), or **permissions for social media/WordPress**, execute actions as needed:
  - “Create a Google Ads campaign for lead generation.”
  - “Post 3 social media creatives today for Instagram and LinkedIn.”
  - “Update the SEO meta tags on this blog post.”
  
Answer everything **step-by-step**, actionable, and ensure **implementation**.

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
        const res = await fetch("/api/credits/get");
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

  const activeChat = chats.find((c) => c.id === activeChatId) || null;
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

  async function sendMessage(e) {
    e?.preventDefault();

    const userText = input.trim();
    if (!userText || !activeChatId) return;

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
                  messages: [...(chat.messages || DEFAULT_MESSAGES), userMsg, errMsg],
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
            messages: [...(chat.messages || DEFAULT_MESSAGES), userMsg, errMsg],
          };
        })
      );
    } finally {
      setLoading(false);
      setTimeout(() => {
        const el = document.getElementById("chat-area");
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
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
        <p>Please sign in with Google to use GabbarInfo AI.</p>
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
      </div>
    );
  }

  // ---------- MAIN CHAT UI ----------
  return (
    <div
      style={{
        fontFamily: "Inter, Arial",
        height: "100vh",      // lock to viewport
        maxHeight: "100vh",
        width: "100vw",
        maxWidth: "100vw",
        overflow: "hidden",   // page/body never scrolls
        display: "flex",
        flexDirection: "column",
        background: "#fafafa",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER (fixed at top within this container) */}
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

      {/* BODY – fills the rest of the viewport; it does NOT scroll */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          minHeight: 0,      // so children can flex and scroll
          overflow: "hidden",
        }}
      >
        {/* SIDEBAR – fixed in place; internal list scrolls if needed */}
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
          }}
        >
          {/* MESSAGES AREA – the ONLY thing that scrolls */}
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
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* INPUT BAR – fixed at bottom of the viewport container */}
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
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14,
              }}
              disabled={loading}
            />
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
        </section>
      </main>
    </div>
  );
}
