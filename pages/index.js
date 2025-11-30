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
- If you say you will give "X steps" (e.g. a 7-step plan), you **must list ALL steps**
  in that same reply from Step 1 to Step X. Never stop after only Step 1 or Step 2.
- If you mention "7-step", "7 step", "7-point", "7 point", or similar, you MUST output
  exactly 7 clearly numbered steps in that reply, unless the user explicitly asks
  to go one step at a time.
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

// Helper: create a fresh empty chat
function createEmptyChat() {
  const now = Date.now();
  return {
    id: String(now),
    title: "New conversation",
    messages: [...DEFAULT_MESSAGES],
    createdAt: now,
  };
}

export default function Home() {
  const { data: session, status } = useSession();

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const role = session?.user?.role || "client";

  // Load chats on first render
  useEffect(() => {
    try {
      const storedChats = localStorage.getItem(STORAGE_KEY_CHATS);
      const storedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);

      if (storedChats) {
        const parsed = JSON.parse(storedChats);
        if (Array.isArray(parsed) && parsed.length) {
          // If there are more than 5 (old data), keep only last 5
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

      // No stored chats -> create first one
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

  // Save chats + active chat to localStorage whenever they change
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

  const activeChat = chats.find((c) => c.id === activeChatId) || null;
  const messages = activeChat?.messages || DEFAULT_MESSAGES;

  // Create a brand new chat (and keep only last 5)
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

  // Send user message -> ask backend -> save into current chat
  async function sendMessage(e) {
    e?.preventDefault();

    const userText = input.trim();
    if (!userText || !activeChatId) return;

    const userMsg = { role: "user", text: userText };

    // Start from current messages of this chat
    const baseMessages = messages || DEFAULT_MESSAGES;
    const updatedMessages = [...baseMessages, userMsg];

    setInput("");
    setLoading(true);

    try {
      // Keep larger text history for the prompt (last 30 turns)
      const history = updatedMessages
        .slice(-30)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join("\n\n");

      const finalPrompt = `
${SYSTEM_PROMPT}

Conversation so far:
${history}

Now respond as GabbarInfo AI.

OUTPUT RULES (CRITICAL)
- If the user asks for a plan, framework or "X-step" strategy, you must give the **entire**
  plan in this single reply.
- If you write something like "Here is a 7-step strategy" or "7-step plan", you must output
  **all 7 steps** clearly numbered (Step 1, Step 2, ..., Step 7) in this same message.
- Never stop after only Step 1 or Step 2 unless the user explicitly asked you to stop early.
- Only break things into multiple replies when the user clearly asks for that
  (for example "explain only step 1 first" or "go step by step").
- Otherwise, always give your best, fully-finished answer in one reply.
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

      // Update chats state: update only the active chat
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== activeChatId) return chat;

          // Determine title: if this is first user message, use it as chat title
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
            messages: [...(chat.messages || DEFAULT_MESSAGES), errMsg],
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

  // ---- UI ----

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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Role pill */}
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
            {role === "owner" ? "Owner" : "Client"}
          </span>

          {/* Email */}
          <div style={{ fontSize: 13, color: "#333" }}>
            {session.user?.email}
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut()}
            style={{ padding: "6px 10px", borderRadius: 6 }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main style={{ display: "flex", flex: 1 }}>
        {/* SIDEBAR WITH MULTIPLE CHATS */}
        <aside
          style={{
            width: 260,
            borderRight: "1px solid #eee",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
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
                      : "1px solid "#eee",
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

        {/* MAIN CHAT AREA */}
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
