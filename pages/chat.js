// pages/chat.js
"use client";

import { useEffect, useState } from "react";
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
      // Consume credit for clients
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

  // Auth states
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
          }}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  // MAIN CHAT UI
  return (
    <div
      style={{
        fontFamily: "Inter, Arial",
        height: "100vh",
        maxHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#fafafa",
      }}
    >
      {/* Header */}
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          padding: 12,
          borderBottom: "1px solid #eee",
          background: "#fff",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <strong>GabbarInfo AI</strong> — Chat
          <button
            onClick={handleNewChat}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #ddd",
              fontSize: 12,
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
            flexWrap: "wrap",
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
            }}
          >
            {role === "owner"
              ? "Owner · Unlimited"
              : creditsLoading
              ? "Client · Credits: …"
              : `Client · Credits: ${credits ?? 0}`}
          </span>

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

      {/* Main layout */}
      <main
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          width: "100%",
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            width: 260,
            maxWidth: "40%",
            borderRight: "1px solid #eee",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
            background: "#fff",
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
              maxHeight: "60vh",
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

        {/* Chat area */}
        <section
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <div
            id="chat-area"
            style={{
              flex: 1,
              padding: 20,
              overflowY: "auto",
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
              flexShrink: 0,
              display: "flex",
              padding: 12,
              gap: 8,
              borderTop: "1px solid #eee",
              background: "#fff",
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
