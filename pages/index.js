"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const SYSTEM_PROMPT = `
You are **GabbarInfo AI**, a senior digital marketing strategist.

SCOPE
- You only help with performance marketing: Google Ads, Meta (Facebook/Instagram) Ads,
  YouTube Ads, landing pages, funnels, copy/creatives, tracking, and analytics.
- If the user asks something outside marketing, you may give a short helpful reply
  but then gently steer the conversation back to digital marketing.

STYLE
- Friendly, confident consultant – not a robot, not overly formal.
- Prioritise clarity and practicality over theory.
- Use numbered steps and bullet points wherever possible.
- Avoid long generic introductions. Get to the useful part quickly.

CONVERSATION RULES
- Always stay consistent with details already given in the conversation
  (business type, city, budget, goals, past campaigns, etc.).
- By default, answer in **one complete reply** – like ChatGPT.
- If you say you will give "X steps" (e.g. a 7-step plan), you **must list all steps**
  in that same reply from Step 1 to Step X.
- Only go step-by-step across multiple messages when the user **explicitly asks**
  for that (e.g. "tell me only step 1 first", "explain step 3 in detail").
- When the user is vague (e.g. "I want more leads"), ask 2–4 sharp questions
  to understand business, location, budget, and goals before giving a strategy.
`;

const DEFAULT_MESSAGES = [
  {
    role: "assistant",
    text: "Hi — I’m GabbarInfo AI, your digital marketing strategist. How can I help you today?",
  },
];

export default function Home() {
  const { data: session, status } = useSession();

  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
  try {
    const saved = localStorage.getItem("gabbarinfo_chat");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        setMessages(parsed);
      }
    }
  } catch (e) {
    console.error("Failed to load saved chat:", e);
  }
}, []);

  useEffect(() => {
  try {
    localStorage.setItem("gabbarinfo_chat", JSON.stringify(messages));
  } catch (e) {
    console.error("Failed to save chat:", e);
  }
}, [messages]);
  
  async function sendMessage(e) {
    e?.preventDefault();

    const userText = input.trim();
    if (!userText) return;

    const userMsg = { role: "user", text: userText };

    // Add user message in UI
    setMessages((m) => [...m, userMsg].slice(-11));
    setInput("");
    setLoading(true);

  try {
  // Keep larger history so model never loses context
  const history = [...messages, userMsg]
    .slice(-30)   // <-- THE FIX
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

      const assistant = { role: "assistant", text: assistantText };
      setMessages((m) => [...m, assistant].slice(-11));
    } catch (err) {
      console.error(err);
      const errMsg = {
        role: "assistant",
        text: "Error: " + (err.message || "Unknown"),
      };
      setMessages((m) => [...m, errMsg].slice(-11));
    } finally {
      setLoading(false);
      setTimeout(() => {
        const el = document.getElementById("chat-area");
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    }
  }

  if (status === "loading") {
    return <div style={{ padding: 40 }}>Checking session…</div>;
  }

  if (!session) {
    return (
      <div style={{ fontFamily: "Inter, Arial", padding: 40 }}>
        <h1>Sign in to continue</h1>
        <p>Sign in with Google to use the chat interface.</p>
        <button
          onClick={() => signIn("google")}
          style={{
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

  return (
    <div
      style={{
        fontFamily: "Inter, Arial",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderBottom: "1px solid #eee",
  }}
>
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <strong>GabbarInfo AI</strong> — Chat

    {/* NEW CHAT BUTTON */}
    <button
      onClick={() => {
        setMessages(DEFAULT_MESSAGES);
        try {
          localStorage.removeItem("gabbarinfo_chat");
        } catch (e) {
          console.error("Failed to clear saved chat:", e);
        }
      }}
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

  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <div style={{ fontSize: 13, color: "#333" }}>
      {session.user?.email}
    </div>
    <button
      onClick={() => signOut()}
      style={{ padding: "6px 10px", borderRadius: 6 }}
    >
      Sign out
    </button>
  </div>
</header>

      <main style={{ display: "flex", flex: 1 }}>
        <aside
          style={{
            width: 260,
            borderRight: "1px solid #eee",
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Conversations</div>
          <div style={{ color: "#666" }}>
            This demo uses Gemini (server-side). Type to start a conversation.
          </div>
        </aside>

        <section style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div
            id="chat-area"
            style={{
              flex: 1,
              padding: 20,
              overflow: "auto",
              background: "#fafafa",
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 12,
                  display: "flex",
                  flexDirection: m.role === "user" ? "row-reverse" : "row",
                }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    background: m.role === "user" ? "#DCF8C6" : "#fff",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #e6e6e6",
                  }}
                >
                  <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>
                    {m.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={sendMessage}
            style={{
              display: "flex",
              padding: 12,
              gap: 8,
              borderTop: "1px solid #eee",
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
                padding: 12,
                borderRadius: 8,
                border: "1px solid #ddd",
              }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ padding: "10px 14px", borderRadius: 8 }}
            >
              {loading ? "Thinking…" : "Send"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
